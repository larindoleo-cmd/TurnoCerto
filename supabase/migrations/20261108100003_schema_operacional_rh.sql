-- ================================================================================
-- TurnoCerto: Migração 03 - Schema Operacional e Recursos Humanos
-- Arquivo: supabase/migrations/20261108100003_schema_operacional_rh.sql
-- Tipo: DDL (Criação de Tabelas Operacionais e RH)
-- Tabelas: ocorrencias, alertas, pontos, holerites, atestados, empresa_info
-- ================================================================================

-- 1. TABELA DE OCORRÊNCIAS OPERACIONAIS E RONDAS
CREATE TABLE IF NOT EXISTS public.ocorrencias (
  id TEXT PRIMARY KEY DEFAULT ('ocorr-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 4)),
  posto_id TEXT NOT NULL,
  posto_nome TEXT,
  tipo TEXT NOT NULL DEFAULT 'Posto Descoberto',
  descricao TEXT NOT NULL,
  registrado_por TEXT NOT NULL DEFAULT 'Supervisora Silva',
  data_hora TEXT NOT NULL,
  urgencia TEXT NOT NULL DEFAULT 'media',
  resolvida BOOLEAN NOT NULL DEFAULT FALSE,
  fotos TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. TABELA DE ALERTAS OPERACIONAIS EM TEMPO REAL
CREATE TABLE IF NOT EXISTS public.alertas (
  id TEXT PRIMARY KEY DEFAULT ('alerta-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 4)),
  tipo TEXT NOT NULL DEFAULT 'posto_descoberto',
  gravidade TEXT NOT NULL DEFAULT 'critica',
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  posto_id TEXT NOT NULL,
  posto_nome TEXT,
  colaborador_id TEXT,
  colaborador_nome TEXT,
  horario TEXT NOT NULL DEFAULT '07:00',
  resolvido BOOLEAN NOT NULL DEFAULT FALSE,
  resolvido_por TEXT,
  resolvido_em TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABELA DE PONTO ELETRÔNICO MOBILE COM GEOLOCALIZAÇÃO
CREATE TABLE IF NOT EXISTS public.pontos (
  id TEXT PRIMARY KEY DEFAULT ('ponto-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 6)),
  colaborador_id TEXT NOT NULL,
  colaborador_nome TEXT,
  condominio_id TEXT,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  entrada_1 TEXT DEFAULT '07:00',
  saida_1 TEXT DEFAULT '12:00',
  entrada_2 TEXT DEFAULT '13:00',
  saida_2 TEXT DEFAULT '19:00',
  total_horas TEXT DEFAULT '11h 00m',
  status_ponto TEXT NOT NULL DEFAULT 'Regular',
  status TEXT DEFAULT 'Regular',
  localizacao_gps TEXT DEFAULT 'Dentro do Raio Geofence (12m)',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  foto_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TABELA DE HOLERITES E ASSINATURA DIGITAL
CREATE TABLE IF NOT EXISTS public.holerites (
  id TEXT PRIMARY KEY DEFAULT ('hol-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 4)),
  colaborador_id TEXT NOT NULL,
  colaborador_nome TEXT,
  matricula TEXT,
  funcao TEXT DEFAULT 'Porteiro',
  posto_nome TEXT,
  mes_referencia TEXT NOT NULL DEFAULT 'Outubro/2026',
  salario_base NUMERIC(10, 2) NOT NULL DEFAULT 2150.00,
  adicional_periculosidade NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  adicional_noturno NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  horas_extras_50 NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
  valor_horas_extras NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  desconto_inss NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  desconto_fgts NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  desconto_vt NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  desconto_vr NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  bonus_assiduidade NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  bonus_ativo BOOLEAN NOT NULL DEFAULT TRUE,
  motivo_perda_bonus TEXT,
  liquido_receber NUMERIC(10, 2) NOT NULL DEFAULT 2150.00,
  status_envio TEXT NOT NULL DEFAULT 'Pendente',
  data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_assinatura TIMESTAMPTZ,
  assinatura_digital_hash TEXT,
  ip_assinatura TEXT,
  documento_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. TABELA DE ATESTADOS MÉDICOS E AFASTAMENTOS
CREATE TABLE IF NOT EXISTS public.atestados (
  id TEXT PRIMARY KEY DEFAULT ('atest-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 4)),
  colaborador_id TEXT NOT NULL,
  colaborador_nome TEXT,
  matricula TEXT,
  posto_nome TEXT,
  medico TEXT DEFAULT 'Dr. Médico',
  crm TEXT DEFAULT 'CRM 00000',
  cid TEXT DEFAULT 'Z00.0',
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  dias_afastamento INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'Pendente',
  substituto_alocado_id TEXT,
  anexo_url TEXT,
  motivo_recusa TEXT,
  avaliado_por TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. TABELA DE DADOS CADASTRAIS DA EMPRESA MATRIZ
CREATE TABLE IF NOT EXISTS public.empresa_info (
  id TEXT PRIMARY KEY DEFAULT 'matriz-principal',
  razao_social TEXT NOT NULL DEFAULT 'TurnoCerto Terceirização e Serviços Ltda.',
  nome_fantasia TEXT NOT NULL DEFAULT 'TurnoCerto Serviços',
  cnpj TEXT NOT NULL DEFAULT '12.345.678/0001-90',
  inscricao_estadual TEXT DEFAULT '123.456.789.110',
  inscricao_municipal TEXT DEFAULT '9.876.543-2',
  telefone TEXT DEFAULT '(11) 3221-4000',
  whatsapp TEXT DEFAULT '(11) 98842-1190',
  email TEXT DEFAULT 'operacional@turnocerto.com.br',
  endereco TEXT DEFAULT 'Av. Paulista, 1000 - Bela Vista',
  bairro TEXT DEFAULT 'Bela Vista',
  cidade TEXT DEFAULT 'São Paulo',
  estado TEXT DEFAULT 'SP',
  cep TEXT DEFAULT '01310-100',
  responsavel_operacional TEXT DEFAULT 'Supervisora Silva',
  cargo_responsavel TEXT DEFAULT 'Gerente Operacional Sênior',
  chave_pix TEXT DEFAULT '12.345.678/0001-90',
  logo_url TEXT,
  apresentacao TEXT DEFAULT 'Excelência em terceirização de portaria, controle de acesso e segurança patrimonial.',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed inicial idempotente da empresa matriz
INSERT INTO public.empresa_info (id, razao_social, nome_fantasia, cnpj, telefone, whatsapp, email)
VALUES (
  'matriz-principal',
  'TurnoCerto Terceirização e Serviços Ltda.',
  'TurnoCerto Serviços',
  '12.345.678/0001-90',
  '(11) 3221-4000',
  '(11) 98842-1190',
  'operacional@turnocerto.com.br'
)
ON CONFLICT (id) DO NOTHING;
