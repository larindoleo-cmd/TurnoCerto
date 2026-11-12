-- ============================================================================
-- MIGRATION: 20261112100000_padronizacao_schema_canonico.sql
-- PROJETO: TurnoCerto - Gestão de Terceirização e Escalas
-- OBJETIVO: 
--   1. Padronização e unificação do schema sem perda de dados (Incremental)
--   2. Definição canônica e autoritativa de 'condominios' para postos
--   3. Trigger de sincronização explícita de 'condominios' -> 'postos'
--   4. Padronização geográfica: latitude, longitude, raio_gps_metros (sem forçar SP)
--   5. Correção de constraints reais em ponto_eventos.metodo_autenticacao
--   6. Unificação e reconciliação dos campos de 'holerites'
--   7. Estruturação multiempresa (tabela 'empresas' + 'empresa_id' com backfill)
--   8. Chaves estrangeiras com higienização prévia de órfãos e índices de alta performance
-- ============================================================================

-- Habilita extensões essenciais de forma segura
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. TABELA CANÔNICA DE EMPRESAS (MULTIEMPRESA) E BACKFILL
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.empresas (
  id TEXT PRIMARY KEY DEFAULT ('emp-' || substr(md5(random()::text), 1, 10)),
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT NOT NULL,
  cnpj TEXT UNIQUE,
  inscricao_estadual TEXT,
  inscricao_municipal TEXT,
  telefone TEXT,
  whatsapp TEXT,
  email TEXT,
  endereco TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  responsavel_operacional TEXT,
  cargo_responsavel TEXT,
  chave_pix TEXT,
  logo_url TEXT,
  apresentacao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Garante empresa matriz padrão se não existir
INSERT INTO public.empresas (
  id,
  razao_social,
  nome_fantasia,
  cnpj,
  telefone,
  whatsapp,
  email,
  cidade,
  estado,
  responsavel_operacional,
  cargo_responsavel,
  apresentacao,
  ativo
) VALUES (
  'emp-matriz-principal',
  'TurnoCerto Terceirização e Serviços Ltda.',
  'TurnoCerto Serviços',
  '12.345.678/0001-90',
  '(11) 3221-4000',
  '(11) 98842-1190',
  'operacional@turnocerto.com.br',
  'São Paulo',
  'SP',
  'Supervisão Geral',
  'Gerente Operacional',
  'Empresa de prestação de serviços terceirizados, controle de portaria, escalas e gestão operacional.',
  TRUE
) ON CONFLICT (id) DO UPDATE SET
  updated_at = NOW();

-- Sincroniza dados de empresa_info legado caso exista
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'empresa_info') THEN
    INSERT INTO public.empresas (
      id,
      razao_social,
      nome_fantasia,
      cnpj,
      telefone,
      whatsapp,
      email,
      cidade,
      estado,
      responsavel_operacional,
      cargo_responsavel,
      apresentacao,
      ativo
    )
    SELECT
      'emp-matriz-principal',
      COALESCE(razao_social, 'TurnoCerto Terceirização e Serviços Ltda.'),
      COALESCE(nome_fantasia, 'TurnoCerto Serviços'),
      COALESCE(cnpj, '12.345.678/0001-90'),
      telefone,
      whatsapp,
      email,
      cidade,
      estado,
      responsavel_operacional,
      cargo_responsavel,
      apresentacao,
      TRUE
    FROM public.empresa_info
    LIMIT 1
    ON CONFLICT (id) DO UPDATE SET
      razao_social = EXCLUDED.razao_social,
      nome_fantasia = EXCLUDED.nome_fantasia,
      cnpj = EXCLUDED.cnpj,
      updated_at = NOW();
  END IF;
END $$;

-- Adiciona a coluna empresa_id nas tabelas operacionais
ALTER TABLE public.condominios ADD COLUMN IF NOT EXISTS empresa_id TEXT DEFAULT 'emp-matriz-principal';
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS empresa_id TEXT DEFAULT 'emp-matriz-principal';
ALTER TABLE public.alertas ADD COLUMN IF NOT EXISTS empresa_id TEXT DEFAULT 'emp-matriz-principal';
ALTER TABLE public.ocorrencias ADD COLUMN IF NOT EXISTS empresa_id TEXT DEFAULT 'emp-matriz-principal';
ALTER TABLE public.pontos ADD COLUMN IF NOT EXISTS empresa_id TEXT DEFAULT 'emp-matriz-principal';
ALTER TABLE public.ponto_eventos ADD COLUMN IF NOT EXISTS empresa_id TEXT DEFAULT 'emp-matriz-principal';
ALTER TABLE public.holerites ADD COLUMN IF NOT EXISTS empresa_id TEXT DEFAULT 'emp-matriz-principal';
ALTER TABLE public.atestados ADD COLUMN IF NOT EXISTS empresa_id TEXT DEFAULT 'emp-matriz-principal';

-- Backfill seguro de registros legados nulos para a matriz padrão
UPDATE public.condominios SET empresa_id = 'emp-matriz-principal' WHERE empresa_id IS NULL;
UPDATE public.colaboradores SET empresa_id = 'emp-matriz-principal' WHERE empresa_id IS NULL;
UPDATE public.alertas SET empresa_id = 'emp-matriz-principal' WHERE empresa_id IS NULL;
UPDATE public.ocorrencias SET empresa_id = 'emp-matriz-principal' WHERE empresa_id IS NULL;
UPDATE public.pontos SET empresa_id = 'emp-matriz-principal' WHERE empresa_id IS NULL;
UPDATE public.ponto_eventos SET empresa_id = 'emp-matriz-principal' WHERE empresa_id IS NULL;
UPDATE public.holerites SET empresa_id = 'emp-matriz-principal' WHERE empresa_id IS NULL;
UPDATE public.atestados SET empresa_id = 'emp-matriz-principal' WHERE empresa_id IS NULL;

-- ============================================================================
-- 2. PADRONIZAÇÃO DE CONDOMÍNIOS (TABELA AUTORITATIVA DE POSTOS)
-- ============================================================================

-- Garante existência das colunas canônicas e legadas de geolocalização e metadados
ALTER TABLE public.condominios ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.condominios ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE public.condominios ADD COLUMN IF NOT EXISTS raio_gps_metros INTEGER DEFAULT 150;
ALTER TABLE public.condominios ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE public.condominios ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE public.condominios ADD COLUMN IF NOT EXISTS raio_tolerancia_metros INTEGER DEFAULT 150;
ALTER TABLE public.condominios ADD COLUMN IF NOT EXISTS cep TEXT;
ALTER TABLE public.condominios ADD COLUMN IF NOT EXISTS icone TEXT DEFAULT 'Building2';
ALTER TABLE public.condominios ADD COLUMN IF NOT EXISTS cor TEXT DEFAULT '#3B82F6';
ALTER TABLE public.condominios ADD COLUMN IF NOT EXISTS metodo_calibracao_gps TEXT DEFAULT 'manual';
ALTER TABLE public.condominios ADD COLUMN IF NOT EXISTS calibrado_em TIMESTAMPTZ;
ALTER TABLE public.condominios ADD COLUMN IF NOT EXISTS calibrado_precisao_m DOUBLE PRECISION;

-- Remove restrições e defaults rígidos de coordenadas de São Paulo (-23.5505 / -46.6333)
-- Postos não calibrados devem ter coordenadas NULL, nunca um default arbitrário
ALTER TABLE public.condominios ALTER COLUMN latitude DROP DEFAULT;
ALTER TABLE public.condominios ALTER COLUMN longitude DROP DEFAULT;
ALTER TABLE public.condominios ALTER COLUMN latitude DROP NOT NULL;
ALTER TABLE public.condominios ALTER COLUMN longitude DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='condominios' AND column_name='lat'
  ) THEN
    ALTER TABLE public.condominios ALTER COLUMN lat DROP DEFAULT;
    ALTER TABLE public.condominios ALTER COLUMN lat DROP NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='condominios' AND column_name='lng'
  ) THEN
    ALTER TABLE public.condominios ALTER COLUMN lng DROP DEFAULT;
    ALTER TABLE public.condominios ALTER COLUMN lng DROP NOT NULL;
  END IF;
END $$;

-- Sincronização e migração bidirecional de dados legados (lat/lng <-> latitude/longitude)
UPDATE public.condominios
SET
  latitude = COALESCE(latitude, lat),
  longitude = COALESCE(longitude, lng),
  raio_gps_metros = COALESCE(raio_gps_metros, raio_tolerancia_metros, 150);

UPDATE public.condominios
SET
  lat = COALESCE(lat, latitude),
  lng = COALESCE(lng, longitude),
  raio_tolerancia_metros = COALESCE(raio_tolerancia_metros, raio_gps_metros, 150);

-- Constraints de integridade geográfica em condominios
ALTER TABLE public.condominios DROP CONSTRAINT IF EXISTS chk_condominios_latitude;
ALTER TABLE public.condominios ADD CONSTRAINT chk_condominios_latitude
  CHECK (latitude IS NULL OR (latitude >= -90.0 AND latitude <= 90.0));

ALTER TABLE public.condominios DROP CONSTRAINT IF EXISTS chk_condominios_longitude;
ALTER TABLE public.condominios ADD CONSTRAINT chk_condominios_longitude
  CHECK (longitude IS NULL OR (longitude >= -180.0 AND longitude <= 180.0));

ALTER TABLE public.condominios DROP CONSTRAINT IF EXISTS chk_condominios_raio_gps;
ALTER TABLE public.condominios ADD CONSTRAINT chk_condominios_raio_gps
  CHECK (raio_gps_metros IS NULL OR (raio_gps_metros >= 10 AND raio_gps_metros <= 10000));

-- Trigger de automação: mantém latitude/longitude e lat/lng sempre sincronizados em condominios
CREATE OR REPLACE FUNCTION public.fn_sync_condominios_geo_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Se latitude foi informada ou alterada, atualiza lat
  IF NEW.latitude IS NOT NULL AND (OLD.latitude IS NULL OR NEW.latitude <> OLD.latitude) THEN
    NEW.lat := NEW.latitude;
  ELSIF NEW.lat IS NOT NULL AND (NEW.latitude IS NULL OR NEW.lat <> OLD.lat) THEN
    NEW.latitude := NEW.lat;
  END IF;

  -- Se longitude foi informada ou alterada, atualiza lng
  IF NEW.longitude IS NOT NULL AND (OLD.longitude IS NULL OR NEW.longitude <> OLD.longitude) THEN
    NEW.lng := NEW.longitude;
  ELSIF NEW.lng IS NOT NULL AND (NEW.longitude IS NULL OR NEW.lng <> OLD.lng) THEN
    NEW.longitude := NEW.lng;
  END IF;

  -- Se raio_gps_metros foi informado ou alterado, atualiza raio_tolerancia_metros
  IF NEW.raio_gps_metros IS NOT NULL THEN
    NEW.raio_tolerancia_metros := NEW.raio_gps_metros;
  ELSIF NEW.raio_tolerancia_metros IS NOT NULL THEN
    NEW.raio_gps_metros := NEW.raio_tolerancia_metros;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_condominios_geo_columns ON public.condominios;
CREATE TRIGGER trg_sync_condominios_geo_columns
BEFORE INSERT OR UPDATE ON public.condominios
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_condominios_geo_columns();

-- ============================================================================
-- 3. ESPELHAMENTO EXPLÍCITO E CONTROLADO: condominios -> postos
-- ============================================================================

-- Garante que a tabela legada 'postos' exista com o schema correto para visualizações legadas
CREATE TABLE IF NOT EXISTS public.postos (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT DEFAULT 'Residencial',
  cnpj TEXT,
  endereco TEXT,
  bairro TEXT,
  cidade TEXT,
  supervisor TEXT,
  status TEXT DEFAULT 'operacional',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger que propaga todas as alterações de condominios para postos automaticamente
CREATE OR REPLACE FUNCTION public.fn_sync_condominios_to_postos()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.postos WHERE id = OLD.id;
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    INSERT INTO public.postos (
      id,
      nome,
      tipo,
      cnpj,
      endereco,
      bairro,
      cidade,
      supervisor,
      status,
      updated_at
    ) VALUES (
      NEW.id,
      NEW.nome,
      COALESCE(NEW.tipo, 'Residencial'),
      NEW.cnpj,
      NEW.endereco,
      NEW.bairro,
      NEW.cidade,
      NEW.supervisor,
      COALESCE(NEW.status, 'operacional'),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      nome = EXCLUDED.nome,
      tipo = EXCLUDED.tipo,
      cnpj = EXCLUDED.cnpj,
      endereco = EXCLUDED.endereco,
      bairro = EXCLUDED.bairro,
      cidade = EXCLUDED.cidade,
      supervisor = EXCLUDED.supervisor,
      status = EXCLUDED.status,
      updated_at = NOW();
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_condominios_to_postos ON public.condominios;
CREATE TRIGGER trg_sync_condominios_to_postos
AFTER INSERT OR UPDATE OR DELETE ON public.condominios
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_condominios_to_postos();

-- Backfill inicial completo de condominios -> postos
INSERT INTO public.postos (
  id, nome, tipo, cnpj, endereco, bairro, cidade, supervisor, status, updated_at
)
SELECT
  id,
  nome,
  COALESCE(tipo, 'Residencial'),
  cnpj,
  endereco,
  bairro,
  cidade,
  supervisor,
  COALESCE(status, 'operacional'),
  NOW()
FROM public.condominios
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  tipo = EXCLUDED.tipo,
  cnpj = EXCLUDED.cnpj,
  endereco = EXCLUDED.endereco,
  bairro = EXCLUDED.bairro,
  cidade = EXCLUDED.cidade,
  supervisor = EXCLUDED.supervisor,
  status = EXCLUDED.status,
  updated_at = NOW();

-- ============================================================================
-- 4. CORREÇÃO DE CONSTRAINTS EM ponto_eventos (METODO_AUTENTICACAO & GEOFENCE)
-- ============================================================================

-- Garante existência da tabela ponto_eventos
CREATE TABLE IF NOT EXISTS public.ponto_eventos (
  id TEXT PRIMARY KEY DEFAULT ('pe-' || substr(md5(random()::text), 1, 12)),
  colaborador_id TEXT NOT NULL,
  auth_user_id UUID,
  posto_id TEXT,
  condominio_id TEXT,
  posto_nome TEXT,
  condominio_nome TEXT,
  tipo_evento TEXT NOT NULL DEFAULT 'entrada',
  server_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  accuracy_m DOUBLE PRECISION,
  geofence_status TEXT NOT NULL DEFAULT 'dentro_do_raio',
  distance_m DOUBLE PRECISION,
  credential_id TEXT,
  foto_biometria_url TEXT,
  plantoes_ft INTEGER DEFAULT 0,
  metodo_autenticacao TEXT NOT NULL DEFAULT 'biometria_facial',
  verification_status TEXT NOT NULL DEFAULT 'confirmado',
  idempotency_key TEXT UNIQUE NOT NULL,
  comprovante_numero TEXT NOT NULL,
  motivo_excecao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Adiciona colunas necessárias caso a tabela tenha sido criada em versão preliminar
ALTER TABLE public.ponto_eventos ADD COLUMN IF NOT EXISTS auth_user_id UUID;
ALTER TABLE public.ponto_eventos ADD COLUMN IF NOT EXISTS posto_id TEXT;
ALTER TABLE public.ponto_eventos ADD COLUMN IF NOT EXISTS condominio_id TEXT;
ALTER TABLE public.ponto_eventos ADD COLUMN IF NOT EXISTS posto_nome TEXT;
ALTER TABLE public.ponto_eventos ADD COLUMN IF NOT EXISTS condominio_nome TEXT;
ALTER TABLE public.ponto_eventos ADD COLUMN IF NOT EXISTS foto_biometria_url TEXT;
ALTER TABLE public.ponto_eventos ADD COLUMN IF NOT EXISTS plantoes_ft INTEGER DEFAULT 0;
ALTER TABLE public.ponto_eventos ADD COLUMN IF NOT EXISTS distance_m DOUBLE PRECISION;
ALTER TABLE public.ponto_eventos ADD COLUMN IF NOT EXISTS accuracy_m DOUBLE PRECISION;
ALTER TABLE public.ponto_eventos ADD COLUMN IF NOT EXISTS motivo_excecao TEXT;

-- Sincroniza condominio_id com posto_id para evitar discrepâncias
UPDATE public.ponto_eventos 
SET condominio_id = COALESCE(condominio_id, posto_id),
    posto_id = COALESCE(posto_id, condominio_id)
WHERE condominio_id IS NULL OR posto_id IS NULL;

-- Remove dinamicamente constraints antigas de metodo_autenticacao
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN (
    SELECT c.conname 
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public' 
      AND t.relname = 'ponto_eventos' 
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%metodo_autenticacao%'
  ) LOOP
    EXECUTE 'ALTER TABLE public.ponto_eventos DROP CONSTRAINT ' || quote_ident(rec.conname);
  END LOOP;
END $$;

-- Aplica a constraint canônica com todos os 4 métodos suportados e documentados
ALTER TABLE public.ponto_eventos
  ADD CONSTRAINT chk_ponto_eventos_metodo_autenticacao
  CHECK (metodo_autenticacao IN (
    'biometria_facial',
    'biometria_passkey',
    'autenticador_dispositivo',
    'excecao_autorizada'
  ));

-- Remove e recria constraint de tipo_evento
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN (
    SELECT c.conname 
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public' 
      AND t.relname = 'ponto_eventos' 
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%tipo_evento%'
  ) LOOP
    EXECUTE 'ALTER TABLE public.ponto_eventos DROP CONSTRAINT ' || quote_ident(rec.conname);
  END LOOP;
END $$;

ALTER TABLE public.ponto_eventos
  ADD CONSTRAINT chk_ponto_eventos_tipo_evento
  CHECK (tipo_evento IN ('entrada', 'saida_intervalo', 'retorno_intervalo', 'saida'));

-- Remove e recria constraint de geofence_status
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN (
    SELECT c.conname 
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public' 
      AND t.relname = 'ponto_eventos' 
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%geofence_status%'
  ) LOOP
    EXECUTE 'ALTER TABLE public.ponto_eventos DROP CONSTRAINT ' || quote_ident(rec.conname);
  END LOOP;
END $$;

ALTER TABLE public.ponto_eventos
  ADD CONSTRAINT chk_ponto_eventos_geofence_status
  CHECK (geofence_status IN ('dentro_do_raio', 'fora_do_raio', 'gps_indisponivel', 'pendente'));

-- ============================================================================
-- 5. UNIFICAÇÃO E RECONCILIAÇÃO DA TABELA holerites
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.holerites (
  id TEXT PRIMARY KEY DEFAULT ('hol-' || substr(md5(random()::text), 1, 12)),
  colaborador_id TEXT NOT NULL,
  mes_referencia TEXT NOT NULL DEFAULT 'Outubro/2026',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Adiciona todas as colunas das duas versões sem conflito
ALTER TABLE public.holerites ADD COLUMN IF NOT EXISTS colaborador_nome TEXT;
ALTER TABLE public.holerites ADD COLUMN IF NOT EXISTS matricula TEXT;
ALTER TABLE public.holerites ADD COLUMN IF NOT EXISTS funcao TEXT DEFAULT 'Porteiro';
ALTER TABLE public.holerites ADD COLUMN IF NOT EXISTS posto_nome TEXT;
ALTER TABLE public.holerites ADD COLUMN IF NOT EXISTS ano_referencia INTEGER DEFAULT 2026;
ALTER TABLE public.holerites ADD COLUMN IF NOT EXISTS salario_base NUMERIC(10,2) NOT NULL DEFAULT 2150.00;
ALTER TABLE public.holerites ADD COLUMN IF NOT EXISTS adicional_periculosidade NUMERIC(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.holerites ADD COLUMN IF NOT EXISTS adicional_noturno NUMERIC(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.holerites ADD COLUMN IF NOT EXISTS horas_extras_50 NUMERIC(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.holerites ADD COLUMN IF NOT EXISTS valor_horas_extras NUMERIC(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.holerites ADD COLUMN IF NOT EXISTS plantoes_ft INTEGER DEFAULT 0;
ALTER TABLE public.holerites ADD COLUMN IF NOT EXISTS valor_ft NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE public.holerites ADD COLUMN IF NOT EXISTS desconto_inss NUMERIC(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.holerites ADD COLUMN IF NOT EXISTS desconto_fgts NUMERIC(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.holerites ADD COLUMN IF NOT EXISTS desconto_vt NUMERIC(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.holerites ADD COLUMN IF NOT EXISTS desconto_vr NUMERIC(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.holerites ADD COLUMN IF NOT EXISTS vale_transporte NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE public.holerites ADD COLUMN IF NOT EXISTS vale_refeicao NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE public.holerites ADD COLUMN IF NOT EXISTS inss NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE public.holerites ADD COLUMN IF NOT EXISTS irrf NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE public.holerites ADD COLUMN IF NOT EXISTS bonus_assiduidade NUMERIC(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.holerites ADD COLUMN IF NOT EXISTS bonus_ativo BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.holerites ADD COLUMN IF NOT EXISTS motivo_perda_bonus TEXT;
ALTER TABLE public.holerites ADD COLUMN IF NOT EXISTS total_vencimentos NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE public.holerites ADD COLUMN IF NOT EXISTS total_descontos NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE public.holerites ADD COLUMN IF NOT EXISTS salario_liquido NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE public.holerites ADD COLUMN IF NOT EXISTS liquido_receber NUMERIC(10,2) DEFAULT 2150.00;
ALTER TABLE public.holerites ADD COLUMN IF NOT EXISTS status_envio TEXT NOT NULL DEFAULT 'Pendente';
ALTER TABLE public.holerites ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'disponivel';
ALTER TABLE public.holerites ADD COLUMN IF NOT EXISTS data_emissao DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.holerites ADD COLUMN IF NOT EXISTS data_assinatura TIMESTAMPTZ;
ALTER TABLE public.holerites ADD COLUMN IF NOT EXISTS assinatura_digital_hash TEXT;
ALTER TABLE public.holerites ADD COLUMN IF NOT EXISTS ip_assinatura TEXT;
ALTER TABLE public.holerites ADD COLUMN IF NOT EXISTS documento_url TEXT;
ALTER TABLE public.holerites ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Sincronização mútua e higienização dos valores dos holerites
UPDATE public.holerites
SET
  liquido_receber = COALESCE(liquido_receber, salario_liquido, salario_base),
  salario_liquido = COALESCE(salario_liquido, liquido_receber, salario_base),
  desconto_inss = COALESCE(desconto_inss, inss, 0.00),
  inss = COALESCE(inss, desconto_inss, 0.00),
  desconto_vt = COALESCE(desconto_vt, vale_transporte, 0.00),
  vale_transporte = COALESCE(vale_transporte, desconto_vt, 0.00),
  desconto_vr = COALESCE(desconto_vr, vale_refeicao, 0.00),
  vale_refeicao = COALESCE(vale_refeicao, desconto_vr, 0.00),
  plantoes_ft = COALESCE(plantoes_ft, 0),
  valor_ft = COALESCE(valor_ft, 0.00),
  ano_referencia = COALESCE(ano_referencia, EXTRACT(YEAR FROM data_emissao)::INTEGER, 2026),
  total_vencimentos = COALESCE(total_vencimentos, (salario_base + adicional_periculosidade + adicional_noturno + valor_horas_extras + valor_ft + bonus_assiduidade)),
  total_descontos = COALESCE(total_descontos, (desconto_inss + desconto_vt + desconto_vr));

-- ============================================================================
-- 6. HIGIENIZAÇÃO DE REGISTROS ÓRFÃOS ANTES DA CRIAÇÃO DAS CHAVES ESTRANGEIRAS
-- ============================================================================

-- A. Desvincula colaboradores cujo condominio_id não existe na tabela canônica condominios
UPDATE public.colaboradores
SET condominio_id = NULL
WHERE condominio_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.condominios WHERE id = colaboradores.condominio_id);

-- B. Vincula alertas com posto_id inexistente ao primeiro condomínio disponível
DO $$
DECLARE
  v_default_condo TEXT;
BEGIN
  SELECT id INTO v_default_condo FROM public.condominios ORDER BY created_at ASC LIMIT 1;
  IF v_default_condo IS NOT NULL THEN
    UPDATE public.alertas
    SET posto_id = v_default_condo
    WHERE NOT EXISTS (SELECT 1 FROM public.condominios WHERE id = alertas.posto_id);

    UPDATE public.ocorrencias
    SET posto_id = v_default_condo
    WHERE NOT EXISTS (SELECT 1 FROM public.condominios WHERE id = ocorrencias.posto_id);
  END IF;
END $$;

-- C. Higieniza colaborador_id inválido em alertas
UPDATE public.alertas
SET colaborador_id = NULL
WHERE colaborador_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.colaboradores WHERE id = alertas.colaborador_id);

-- D. Higieniza substituto_alocado_id inválido em atestados
UPDATE public.atestados
SET substituto_alocado_id = NULL
WHERE substituto_alocado_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.colaboradores WHERE id = atestados.substituto_alocado_id);

-- E. Higieniza posto_id e condominio_id em ponto_eventos
UPDATE public.ponto_eventos
SET posto_id = NULL, condominio_id = NULL
WHERE (posto_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.condominios WHERE id = ponto_eventos.posto_id))
   OR (condominio_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.condominios WHERE id = ponto_eventos.condominio_id));

-- ============================================================================
-- 7. CHAVES ESTRANGEIRAS CANÔNICAS (FKs) E INTEGRIDADE
-- ============================================================================

-- FKs para a tabela de Empresas
ALTER TABLE public.condominios DROP CONSTRAINT IF EXISTS fk_condominios_empresa;
ALTER TABLE public.condominios ADD CONSTRAINT fk_condominios_empresa
  FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE RESTRICT;

ALTER TABLE public.colaboradores DROP CONSTRAINT IF EXISTS fk_colaboradores_empresa;
ALTER TABLE public.colaboradores ADD CONSTRAINT fk_colaboradores_empresa
  FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE RESTRICT;

ALTER TABLE public.alertas DROP CONSTRAINT IF EXISTS fk_alertas_empresa;
ALTER TABLE public.alertas ADD CONSTRAINT fk_alertas_empresa
  FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE RESTRICT;

ALTER TABLE public.ocorrencias DROP CONSTRAINT IF EXISTS fk_ocorrencias_empresa;
ALTER TABLE public.ocorrencias ADD CONSTRAINT fk_ocorrencias_empresa
  FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE RESTRICT;

ALTER TABLE public.pontos DROP CONSTRAINT IF EXISTS fk_pontos_empresa;
ALTER TABLE public.pontos ADD CONSTRAINT fk_pontos_empresa
  FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE RESTRICT;

ALTER TABLE public.ponto_eventos DROP CONSTRAINT IF EXISTS fk_ponto_eventos_empresa;
ALTER TABLE public.ponto_eventos ADD CONSTRAINT fk_ponto_eventos_empresa
  FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE RESTRICT;

ALTER TABLE public.holerites DROP CONSTRAINT IF EXISTS fk_holerites_empresa;
ALTER TABLE public.holerites ADD CONSTRAINT fk_holerites_empresa
  FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE RESTRICT;

ALTER TABLE public.atestados DROP CONSTRAINT IF EXISTS fk_atestados_empresa;
ALTER TABLE public.atestados ADD CONSTRAINT fk_atestados_empresa
  FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE RESTRICT;

-- FKs de Relacionamento entre Entidades de Negócio
ALTER TABLE public.colaboradores DROP CONSTRAINT IF EXISTS fk_colaboradores_condominio;
ALTER TABLE public.colaboradores ADD CONSTRAINT fk_colaboradores_condominio
  FOREIGN KEY (condominio_id) REFERENCES public.condominios(id) ON DELETE SET NULL;

ALTER TABLE public.alertas DROP CONSTRAINT IF EXISTS fk_alertas_condominio;
ALTER TABLE public.alertas ADD CONSTRAINT fk_alertas_condominio
  FOREIGN KEY (posto_id) REFERENCES public.condominios(id) ON DELETE CASCADE;

ALTER TABLE public.alertas DROP CONSTRAINT IF EXISTS fk_alertas_colaborador;
ALTER TABLE public.alertas ADD CONSTRAINT fk_alertas_colaborador
  FOREIGN KEY (colaborador_id) REFERENCES public.colaboradores(id) ON DELETE SET NULL;

ALTER TABLE public.ocorrencias DROP CONSTRAINT IF EXISTS fk_ocorrencias_condominio;
ALTER TABLE public.ocorrencias ADD CONSTRAINT fk_ocorrencias_condominio
  FOREIGN KEY (posto_id) REFERENCES public.condominios(id) ON DELETE CASCADE;

ALTER TABLE public.pontos DROP CONSTRAINT IF EXISTS fk_pontos_colaborador;
ALTER TABLE public.pontos ADD CONSTRAINT fk_pontos_colaborador
  FOREIGN KEY (colaborador_id) REFERENCES public.colaboradores(id) ON DELETE CASCADE;

ALTER TABLE public.ponto_eventos DROP CONSTRAINT IF EXISTS fk_ponto_eventos_colaborador;
ALTER TABLE public.ponto_eventos ADD CONSTRAINT fk_ponto_eventos_colaborador
  FOREIGN KEY (colaborador_id) REFERENCES public.colaboradores(id) ON DELETE CASCADE;

ALTER TABLE public.ponto_eventos DROP CONSTRAINT IF EXISTS fk_ponto_eventos_condominio;
ALTER TABLE public.ponto_eventos ADD CONSTRAINT fk_ponto_eventos_condominio
  FOREIGN KEY (condominio_id) REFERENCES public.condominios(id) ON DELETE SET NULL;

ALTER TABLE public.holerites DROP CONSTRAINT IF EXISTS fk_holerites_colaborador;
ALTER TABLE public.holerites ADD CONSTRAINT fk_holerites_colaborador
  FOREIGN KEY (colaborador_id) REFERENCES public.colaboradores(id) ON DELETE CASCADE;

ALTER TABLE public.atestados DROP CONSTRAINT IF EXISTS fk_atestados_colaborador;
ALTER TABLE public.atestados ADD CONSTRAINT fk_atestados_colaborador
  FOREIGN KEY (colaborador_id) REFERENCES public.colaboradores(id) ON DELETE CASCADE;

ALTER TABLE public.atestados DROP CONSTRAINT IF EXISTS fk_atestados_substituto;
ALTER TABLE public.atestados ADD CONSTRAINT fk_atestados_substituto
  FOREIGN KEY (substituto_alocado_id) REFERENCES public.colaboradores(id) ON DELETE SET NULL;

-- ============================================================================
-- 8. ÍNDICES DE PERFORMANCE E PESQUISA OTIMIZADA
-- ============================================================================

-- Índices de suporte multiempresa e integridade
CREATE INDEX IF NOT EXISTS idx_condominios_empresa_status ON public.condominios(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_colaboradores_empresa_status ON public.colaboradores(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_colaboradores_condominio ON public.colaboradores(condominio_id);
CREATE INDEX IF NOT EXISTS idx_alertas_empresa_resolvido ON public.alertas(empresa_id, resolvido);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_empresa_resolvida ON public.ocorrencias(empresa_id, resolvida);
CREATE INDEX IF NOT EXISTS idx_pontos_empresa_data ON public.pontos(empresa_id, data);
CREATE INDEX IF NOT EXISTS idx_ponto_eventos_empresa_colab_time ON public.ponto_eventos(empresa_id, colaborador_id, server_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ponto_eventos_metodo ON public.ponto_eventos(metodo_autenticacao);
CREATE INDEX IF NOT EXISTS idx_holerites_empresa_competencia ON public.holerites(empresa_id, mes_referencia);
CREATE INDEX IF NOT EXISTS idx_atestados_empresa_status ON public.atestados(empresa_id, status);

-- Índices parciais para buscas ativas
CREATE INDEX IF NOT EXISTS idx_alertas_criticos_pendentes ON public.alertas(posto_id) WHERE NOT resolvido;
CREATE INDEX IF NOT EXISTS idx_colaboradores_ativos ON public.colaboradores(funcao) WHERE status = 'no_posto';

-- ============================================================================
-- 9. HABILITAÇÃO E ATUALIZAÇÃO DE ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.condominios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pontos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ponto_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holerites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atestados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.postos ENABLE ROW LEVEL SECURITY;

-- Políticas universais de leitura para usuários autenticados da aplicação
DROP POLICY IF EXISTS "empresas_read_authenticated" ON public.empresas;
CREATE POLICY "empresas_read_authenticated" ON public.empresas
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "condominios_read_authenticated" ON public.condominios;
CREATE POLICY "condominios_read_authenticated" ON public.condominios
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "condominios_write_authenticated" ON public.condominios;
CREATE POLICY "condominios_write_authenticated" ON public.condominios
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "postos_read_authenticated" ON public.postos;
CREATE POLICY "postos_read_authenticated" ON public.postos
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "colaboradores_read_authenticated" ON public.colaboradores;
CREATE POLICY "colaboradores_read_authenticated" ON public.colaboradores
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "colaboradores_write_authenticated" ON public.colaboradores;
CREATE POLICY "colaboradores_write_authenticated" ON public.colaboradores
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "ponto_eventos_read_authenticated" ON public.ponto_eventos;
CREATE POLICY "ponto_eventos_read_authenticated" ON public.ponto_eventos
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "ponto_eventos_insert_authenticated" ON public.ponto_eventos;
CREATE POLICY "ponto_eventos_insert_authenticated" ON public.ponto_eventos
  FOR INSERT TO authenticated WITH CHECK (TRUE);

-- Comentário de auditoria final da migration
COMMENT ON TABLE public.condominios IS 'Tabela Canônica e Autoritativa de Postos de Serviço / Condomínios do TurnoCerto.';
COMMENT ON TABLE public.postos IS 'Tabela Espelho para retrocompatibilidade; sincronizada automaticamente via trg_sync_condominios_to_postos.';
COMMENT ON CONSTRAINT chk_ponto_eventos_metodo_autenticacao ON public.ponto_eventos IS 'Métodos biométricos e eletrônicos válidos: biometria_facial, biometria_passkey, autenticador_dispositivo, excecao_autorizada.';
