-- ================================================================================
-- TurnoCerto: Estrutura Completa da Tabela de Colaboradores (Supabase / PostgreSQL)
-- Inclui: Identidade, eSocial, Posto/Escala, Dados Bancários, Benefícios (VR, VA, FT, Bônus)
-- e Políticas de Segurança RLS (Row Level Security)
-- ================================================================================

-- 1. Habilitar extensões para geração de UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tabela de Condomínios / Postos (Garante existência antes da Foreign Key)
CREATE TABLE IF NOT EXISTS public.condominios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'Residencial',
  cnpj TEXT,
  endereco TEXT,
  bairro TEXT,
  cidade TEXT,
  lat DOUBLE PRECISION NOT NULL DEFAULT -23.5505,
  lng DOUBLE PRECISION NOT NULL DEFAULT -46.6333,
  latitude DOUBLE PRECISION NOT NULL DEFAULT -23.5505,
  longitude DOUBLE PRECISION NOT NULL DEFAULT -46.6333,
  raio_tolerancia_metros INTEGER NOT NULL DEFAULT 150,
  raio_metros INTEGER NOT NULL DEFAULT 50,
  contato_emergencia TEXT,
  tipo_posto TEXT DEFAULT 'portaria_24h',
  supervisor TEXT,
  vagas_contratadas INTEGER DEFAULT 2,
  status TEXT DEFAULT 'operacional',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de Colaboradores / Perfis (public.colaboradores e espelho em public.profiles)
-- Pode ser usada tanto como tabela independente (colaboradores) quanto vinculada a auth.users (profiles)
CREATE TABLE IF NOT EXISTS public.colaboradores (
  id TEXT PRIMARY KEY DEFAULT ('colab-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 6)),
  
  -- Etapa 1: Identidade & Ponto Facial
  nome TEXT NOT NULL,
  cpf TEXT UNIQUE,
  rg TEXT,
  data_nascimento DATE,
  telefone TEXT,
  foto_url TEXT,
  matricula TEXT,

  -- Etapa 2: Documentação Legal & eSocial / Endereço Inteligente
  pis TEXT,
  ctps TEXT,
  nome_mae TEXT,
  cep TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade_uf TEXT,
  endereco TEXT,

  -- Etapa 3: Alocação no Posto & Escala de Trabalho
  condominio_id TEXT,
  cargo TEXT NOT NULL DEFAULT 'Porteiro',
  tipo_jornada TEXT NOT NULL DEFAULT '12x36', -- '12x36', '6x1', '5x2'
  turno_inicio TIME DEFAULT '07:00:00',
  turno_fim TIME DEFAULT '19:00:00',
  data_admissao DATE DEFAULT CURRENT_DATE,
  salario_base NUMERIC(10, 2) NOT NULL DEFAULT 2150.00,
  status TEXT NOT NULL DEFAULT 'no_posto', -- 'no_posto', 'folga', 'falta', 'afastado'

  -- Etapa 4: Dados Bancários & PIX
  pix TEXT,
  banco TEXT DEFAULT '341 - Itaú Unibanco S.A.',
  agencia TEXT,
  conta TEXT,

  -- Etapa 4: Benefícios e Adicionais (VR, VA, Extra FT e Bônus com regra de assiduidade)
  recebe_vt BOOLEAN NOT NULL DEFAULT TRUE,
  recebe_vr BOOLEAN NOT NULL DEFAULT TRUE,
  valor_vr NUMERIC(10, 2) NOT NULL DEFAULT 28.50, -- Valor da diária de refeição
  recebe_va BOOLEAN NOT NULL DEFAULT TRUE,
  valor_va NUMERIC(10, 2) NOT NULL DEFAULT 220.00, -- Cesta alimentação mensal
  valor_extra_ft NUMERIC(10, 2) NOT NULL DEFAULT 160.00, -- Diária de dobra/cobertura FT
  valor_bonus NUMERIC(10, 2) NOT NULL DEFAULT 0.00, -- Bônus assiduidade (pago apenas sem falta/atestado)
  
  -- Auditoria
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Bloco de Migração Dinâmica para a tabela 'public.profiles' já existente no Supabase
-- (Garante que a tabela profiles receba exatamente todas as colunas sem conflitos de tipo)
DO $$
BEGIN
  -- Identidade
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'nome') THEN
    ALTER TABLE public.profiles ADD COLUMN nome TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'rg') THEN
    ALTER TABLE public.profiles ADD COLUMN rg TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'data_nascimento') THEN
    ALTER TABLE public.profiles ADD COLUMN data_nascimento DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'telefone') THEN
    ALTER TABLE public.profiles ADD COLUMN telefone TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'foto_url') THEN
    ALTER TABLE public.profiles ADD COLUMN foto_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'matricula') THEN
    ALTER TABLE public.profiles ADD COLUMN matricula TEXT;
  END IF;

  -- eSocial e Endereço
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'pis') THEN
    ALTER TABLE public.profiles ADD COLUMN pis TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'ctps') THEN
    ALTER TABLE public.profiles ADD COLUMN ctps TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'nome_mae') THEN
    ALTER TABLE public.profiles ADD COLUMN nome_mae TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'endereco') THEN
    ALTER TABLE public.profiles ADD COLUMN endereco TEXT;
  END IF;

  -- Posto, Escala e Salário
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'cargo') THEN
    ALTER TABLE public.profiles ADD COLUMN cargo TEXT DEFAULT 'Porteiro';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'tipo_jornada') THEN
    ALTER TABLE public.profiles ADD COLUMN tipo_jornada TEXT DEFAULT '12x36';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'turno_inicio') THEN
    ALTER TABLE public.profiles ADD COLUMN turno_inicio TIME DEFAULT '07:00:00';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'turno_fim') THEN
    ALTER TABLE public.profiles ADD COLUMN turno_fim TIME DEFAULT '19:00:00';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'data_admissao') THEN
    ALTER TABLE public.profiles ADD COLUMN data_admissao DATE DEFAULT CURRENT_DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'salario_base') THEN
    ALTER TABLE public.profiles ADD COLUMN salario_base NUMERIC(10, 2) DEFAULT 2150.00;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'condominio_id') THEN
    ALTER TABLE public.profiles ADD COLUMN condominio_id TEXT;
  END IF;

  -- Dados Bancários
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'pix') THEN
    ALTER TABLE public.profiles ADD COLUMN pix TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'banco') THEN
    ALTER TABLE public.profiles ADD COLUMN banco TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'agencia') THEN
    ALTER TABLE public.profiles ADD COLUMN agencia TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'conta') THEN
    ALTER TABLE public.profiles ADD COLUMN conta TEXT;
  END IF;

  -- Benefícios (VR, VA, Extra FT, Bônus e VT)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'recebe_vt') THEN
    ALTER TABLE public.profiles ADD COLUMN recebe_vt BOOLEAN DEFAULT TRUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'recebe_vr') THEN
    ALTER TABLE public.profiles ADD COLUMN recebe_vr BOOLEAN DEFAULT TRUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'valor_vr') THEN
    ALTER TABLE public.profiles ADD COLUMN valor_vr NUMERIC(10, 2) DEFAULT 28.50;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'recebe_va') THEN
    ALTER TABLE public.profiles ADD COLUMN recebe_va BOOLEAN DEFAULT TRUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'valor_va') THEN
    ALTER TABLE public.profiles ADD COLUMN valor_va NUMERIC(10, 2) DEFAULT 220.00;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'valor_extra_ft') THEN
    ALTER TABLE public.profiles ADD COLUMN valor_extra_ft NUMERIC(10, 2) DEFAULT 160.00;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'valor_bonus') THEN
    ALTER TABLE public.profiles ADD COLUMN valor_bonus NUMERIC(10, 2) DEFAULT 0.00;
  END IF;
END $$;

-- 5. Habilitar RLS (Row Level Security) e Criar Políticas Permissivas
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de colaboradores" ON public.colaboradores;
CREATE POLICY "Permitir leitura de colaboradores" ON public.colaboradores
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Permitir escrita de colaboradores" ON public.colaboradores;
CREATE POLICY "Permitir escrita de colaboradores" ON public.colaboradores
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir leitura de profiles" ON public.profiles;
CREATE POLICY "Permitir leitura de profiles" ON public.profiles
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Permitir escrita de profiles" ON public.profiles;
CREATE POLICY "Permitir escrita de profiles" ON public.profiles
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 6. Gatilho para atualizar a coluna updated_at automaticamente
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_colaboradores_updated_at ON public.colaboradores;
CREATE TRIGGER trigger_colaboradores_updated_at
  BEFORE UPDATE ON public.colaboradores
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();
