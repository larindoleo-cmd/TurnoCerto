-- ============================================================================
-- MIGRATION: 20261108120000_biometria_facial_ft_seguranca_gps.sql
-- TurnoCerto - Auto-suficiente: Criação Segura de Tabelas, Biometria Facial, 
-- Plantões FT e Proteção Anti-Fraude de GPS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. GARANTE A EXISTÊNCIA DAS TABELAS BÁSICAS (EVITA ERRO 42P01)
-- ----------------------------------------------------------------------------

-- Tabela de Condomínios / Postos
CREATE TABLE IF NOT EXISTS public.condominios (
  id TEXT PRIMARY KEY DEFAULT ('cond-' || substr(md5(random()::text), 1, 12)),
  nome TEXT NOT NULL,
  endereco TEXT,
  cep TEXT,
  cidade TEXT,
  estado TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  raio_gps_metros INTEGER DEFAULT 150,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Colaboradores
CREATE TABLE IF NOT EXISTS public.colaboradores (
  id TEXT PRIMARY KEY DEFAULT ('colab-' || substr(md5(random()::text), 1, 12)),
  nome TEXT NOT NULL,
  email TEXT,
  cpf TEXT,
  telefone TEXT,
  cargo TEXT,
  role TEXT NOT NULL DEFAULT 'funcionario' CHECK (role IN ('admin', 'supervisor', 'funcionario')),
  condominio_id TEXT,
  turno_inicio TEXT DEFAULT '07:00',
  turno_fim TEXT DEFAULT '19:00',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Profiles de Usuários (Auth Sync)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  nome TEXT,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'funcionario' CHECK (role IN ('admin', 'supervisor', 'funcionario')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. TABELA DE EVENTOS DE PONTO ELETRÔNICO BIOMÉTRICO (PORTARIA 671 MTE)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ponto_eventos (
  id TEXT PRIMARY KEY DEFAULT ('pe-' || substr(md5(random()::text), 1, 12)),
  colaborador_id TEXT NOT NULL,
  auth_user_id UUID,
  posto_id TEXT,
  tipo_evento TEXT NOT NULL CHECK (tipo_evento IN ('entrada', 'saida_intervalo', 'retorno_intervalo', 'saida')),
  server_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  accuracy_m DOUBLE PRECISION,
  geofence_status TEXT NOT NULL DEFAULT 'dentro_do_raio' CHECK (geofence_status IN ('dentro_do_raio', 'fora_do_raio', 'gps_indisponivel', 'pendente')),
  distance_m DOUBLE PRECISION,
  credential_id TEXT,
  foto_biometria_url TEXT,
  plantoes_ft INTEGER DEFAULT 0,
  metodo_autenticacao TEXT NOT NULL DEFAULT 'biometria_facial' CHECK (metodo_autenticacao IN ('biometria_facial', 'biometria_passkey', 'autenticador_dispositivo', 'excecao_autorizada')),
  verification_status TEXT NOT NULL DEFAULT 'confirmado',
  idempotency_key TEXT UNIQUE NOT NULL,
  comprovante_numero TEXT NOT NULL,
  motivo_excecao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Adiciona colunas caso a tabela já existisse anteriormente
ALTER TABLE public.ponto_eventos
  ADD COLUMN IF NOT EXISTS foto_biometria_url TEXT,
  ADD COLUMN IF NOT EXISTS plantoes_ft INTEGER DEFAULT 0;

-- Índices de busca rápida e auditoria
CREATE INDEX IF NOT EXISTS idx_ponto_eventos_colab ON public.ponto_eventos(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_ponto_eventos_data ON public.ponto_eventos(server_timestamp);
CREATE INDEX IF NOT EXISTS idx_ponto_eventos_idem ON public.ponto_eventos(idempotency_key);

-- ----------------------------------------------------------------------------
-- 3. TABELA DE HOLERITES COM PLANTÕES FT (FOLGA TRABALHADA)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.holerites (
  id TEXT PRIMARY KEY DEFAULT ('hol-' || substr(md5(random()::text), 1, 12)),
  colaborador_id TEXT NOT NULL,
  mes_referencia TEXT NOT NULL,
  ano_referencia INTEGER NOT NULL,
  salario_base NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  horas_extras_50 NUMERIC(10,2) DEFAULT 0.00,
  valor_horas_extras NUMERIC(10,2) DEFAULT 0.00,
  plantoes_ft INTEGER DEFAULT 0,
  valor_ft NUMERIC(10,2) DEFAULT 0.00,
  adicional_noturno NUMERIC(10,2) DEFAULT 0.00,
  adicional_periculosidade NUMERIC(10,2) DEFAULT 0.00,
  vale_transporte NUMERIC(10,2) DEFAULT 0.00,
  vale_refeicao NUMERIC(10,2) DEFAULT 0.00,
  inss NUMERIC(10,2) DEFAULT 0.00,
  irrf NUMERIC(10,2) DEFAULT 0.00,
  total_vencimentos NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  total_descontos NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  salario_liquido NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'disponivel',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.holerites
  ADD COLUMN IF NOT EXISTS plantoes_ft INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_ft NUMERIC(10,2) DEFAULT 0.00;

-- Converte horas extras antigas para plantões FT de forma segura
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'holerites' AND column_name = 'horas_extras_50') THEN
    UPDATE public.holerites
    SET
      plantoes_ft = COALESCE(plantoes_ft, ROUND(horas_extras_50 / 6)::INTEGER, 2),
      valor_ft = COALESCE(valor_ft, valor_horas_extras, 0.00)
    WHERE plantoes_ft IS NULL OR plantoes_ft = 0;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. SEGURANÇA E PROTEÇÃO ANTI-FRAUDE NA CALIBRAÇÃO DE GPS DE CONDOMÍNIOS
-- Regra: Apenas Administrador e Supervisor podem alterar latitude/longitude/raio
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_condominio_gps_security()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Se as coordenadas ou raio não foram alterados, permite normalmente
  IF (OLD.latitude IS NOT DISTINCT FROM NEW.latitude AND
      OLD.longitude IS NOT DISTINCT FROM NEW.longitude AND
      OLD.raio_gps_metros IS NOT DISTINCT FROM NEW.raio_gps_metros) THEN
    RETURN NEW;
  END IF;

  -- Se for processo de manutenção local / postgres superuser, permite
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  -- Verifica papel do usuário autenticado no profiles ou colaboradores
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;

  IF v_role IS NULL THEN
    SELECT role INTO v_role
    FROM public.colaboradores
    WHERE id::text = auth.uid()::text OR email = auth.email()
    LIMIT 1;
  END IF;

  -- Bloqueio estrito para funcionários
  IF v_role NOT IN ('admin', 'supervisor') THEN
    RAISE EXCEPTION 'Acesso Negado: A calibração de GPS do posto só pode ser realizada por Administradores e Supervisores para evitar fraudes.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_condominio_gps_security ON public.condominios;
CREATE TRIGGER trg_condominio_gps_security
BEFORE UPDATE OF latitude, longitude, raio_gps_metros ON public.condominios
FOR EACH ROW
EXECUTE FUNCTION public.check_condominio_gps_security();

-- ----------------------------------------------------------------------------
-- 5. POLÍTICAS DE RLS (SEGURANÇA POR LINHA) EM ponto_eventos
-- ----------------------------------------------------------------------------

ALTER TABLE public.ponto_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Colaborador visualiza seus proprios pontos" ON public.ponto_eventos;
CREATE POLICY "Colaborador visualiza seus proprios pontos"
ON public.ponto_eventos FOR SELECT
TO authenticated
USING (
  colaborador_id = (SELECT id FROM public.colaboradores WHERE email = auth.jwt() ->> 'email' LIMIT 1)
  OR auth_user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'supervisor'))
);

DROP POLICY IF EXISTS "Colaborador insere seu proprio ponto" ON public.ponto_eventos;
CREATE POLICY "Colaborador insere seu proprio ponto"
ON public.ponto_eventos FOR INSERT
TO authenticated
WITH CHECK (
  colaborador_id = (SELECT id FROM public.colaboradores WHERE email = auth.jwt() ->> 'email' LIMIT 1)
  OR auth_user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'supervisor'))
);

-- Ponto eletrônico é imutável: Proíbe UPDATE e DELETE
DROP POLICY IF EXISTS "Ponto imutavel sem update" ON public.ponto_eventos;
DROP POLICY IF EXISTS "Ponto imutavel sem delete" ON public.ponto_eventos;

-- ----------------------------------------------------------------------------
-- 6. BUCKET DE STORAGE PARA FOTOS DE BIOMETRIA FACIAL (PORTARIA 671 MTE)
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('fotos-biometria-ponto', 'fotos-biometria-ponto', false)
    ON CONFLICT (id) DO NOTHING;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL; -- Ignora caso storage já esteja gerenciado via dashboard
END $$;
