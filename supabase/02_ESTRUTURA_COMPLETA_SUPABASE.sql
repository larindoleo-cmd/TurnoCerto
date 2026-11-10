-- ================================================================================
-- 02 — ESTRUTURA_COMPLETA_SUPABASE.sql
-- TurnoCerto: Criação e Adequação Completa de Tabelas, Colunas e Tipos de Dados
-- Idempotente: Execução segura sem perda de dados existentes
-- Executar no SQL Editor do Supabase (PostgreSQL)
-- ================================================================================

-- 1. Habilitar extensões fundamentais do PostgreSQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================================================
-- 2. TABELA DE CONDOMÍNIOS / POSTOS DE TRABALHO (public.condominios)
-- ================================================================================
CREATE TABLE IF NOT EXISTS public.condominios (
  id TEXT PRIMARY KEY DEFAULT ('cond-' || substr(md5(random()::text), 1, 8)),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'Residencial',
  cnpj TEXT,
  contrato_numero TEXT,
  endereco TEXT NOT NULL DEFAULT 'Endereço não informado',
  bairro TEXT,
  cidade TEXT DEFAULT 'São Paulo - SP',
  supervisor TEXT DEFAULT 'Supervisora Silva',
  telefone_supervisor TEXT DEFAULT '(11) 98842-1190',
  vagas_contratadas INTEGER NOT NULL DEFAULT 2,
  status TEXT NOT NULL DEFAULT 'operacional', -- 'operacional', 'atencao', 'critico'
  motivo_atencao TEXT,
  tipo_escala_padrao TEXT DEFAULT '12x36 (07:00 - 19:00)',
  cobertura_percentual INTEGER DEFAULT 100,
  contato_sindico TEXT,
  telefone_sindico TEXT,
  instrucoes_guarita TEXT,
  foto_url TEXT,
  lat DOUBLE PRECISION NOT NULL DEFAULT -23.55052,
  lng DOUBLE PRECISION NOT NULL DEFAULT -46.633308,
  latitude DOUBLE PRECISION DEFAULT -23.55052,
  longitude DOUBLE PRECISION DEFAULT -46.633308,
  raio_tolerancia_metros INTEGER DEFAULT 150,
  raio_metros INTEGER DEFAULT 50,
  tipo_posto TEXT DEFAULT 'portaria_24h',
  contato_emergencia TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar colunas caso a tabela 'condominios' já existisse com schema reduzido
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'condominios' AND column_name = 'contrato_numero') THEN
    ALTER TABLE public.condominios ADD COLUMN contrato_numero TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'condominios' AND column_name = 'telefone_supervisor') THEN
    ALTER TABLE public.condominios ADD COLUMN telefone_supervisor TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'condominios' AND column_name = 'tipo_escala_padrao') THEN
    ALTER TABLE public.condominios ADD COLUMN tipo_escala_padrao TEXT DEFAULT '12x36 (07:00 - 19:00)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'condominios' AND column_name = 'cobertura_percentual') THEN
    ALTER TABLE public.condominios ADD COLUMN cobertura_percentual INTEGER DEFAULT 100;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'condominios' AND column_name = 'contato_sindico') THEN
    ALTER TABLE public.condominios ADD COLUMN contato_sindico TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'condominios' AND column_name = 'telefone_sindico') THEN
    ALTER TABLE public.condominios ADD COLUMN telefone_sindico TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'condominios' AND column_name = 'instrucoes_guarita') THEN
    ALTER TABLE public.condominios ADD COLUMN instrucoes_guarita TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'condominios' AND column_name = 'foto_url') THEN
    ALTER TABLE public.condominios ADD COLUMN foto_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'condominios' AND column_name = 'motivo_atencao') THEN
    ALTER TABLE public.condominios ADD COLUMN motivo_atencao TEXT;
  END IF;
END $$;

-- Tabela espelho / legado 'postos' para compatibilidade total
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

-- ================================================================================
-- 3. TABELA DE COLABORADORES (public.colaboradores)
-- ================================================================================
CREATE TABLE IF NOT EXISTS public.colaboradores (
  id TEXT PRIMARY KEY DEFAULT ('colab-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 6)),
  
  -- Identidade & Foto
  nome TEXT NOT NULL,
  full_name TEXT,
  cpf TEXT UNIQUE,
  rg TEXT,
  data_nascimento DATE,
  telefone TEXT,
  foto_url TEXT,
  matricula TEXT,

  -- eSocial & Endereço
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

  -- Lotação, Posto & Escala
  condominio_id TEXT,
  cargo TEXT NOT NULL DEFAULT 'Porteiro',
  funcao TEXT DEFAULT 'Porteiro',
  tipo_jornada TEXT NOT NULL DEFAULT '12x36', -- '12x36', '6x1', '5x2'
  jornada TEXT DEFAULT '12x36 (07:00 - 19:00)',
  turno_inicio TIME DEFAULT '07:00:00',
  turno_fim TIME DEFAULT '19:00:00',
  data_admissao DATE DEFAULT CURRENT_DATE,
  salario_base NUMERIC(10, 2) NOT NULL DEFAULT 2150.00,
  status TEXT NOT NULL DEFAULT 'no_posto', -- 'no_posto', 'folga', 'falta', 'afastado'
  banco_horas NUMERIC(6, 2) DEFAULT 0.0,

  -- Dados Bancários & PIX
  pix TEXT,
  banco TEXT DEFAULT '341 - Itaú Unibanco S.A.',
  agencia TEXT,
  conta TEXT,

  -- Benefícios CLT & Remuneração Variável
  recebe_vt BOOLEAN NOT NULL DEFAULT TRUE,
  recebe_vr BOOLEAN NOT NULL DEFAULT TRUE,
  valor_vr NUMERIC(10, 2) NOT NULL DEFAULT 28.50,
  recebe_va BOOLEAN NOT NULL DEFAULT TRUE,
  valor_va NUMERIC(10, 2) NOT NULL DEFAULT 220.00,
  valor_extra_ft NUMERIC(10, 2) NOT NULL DEFAULT 160.00,
  valor_bonus NUMERIC(10, 2) NOT NULL DEFAULT 0.00,

  -- Autenticação & Acesso ao Painel
  email TEXT,
  senha TEXT,
  role TEXT DEFAULT 'funcionario' CHECK (role IN ('admin', 'supervisor', 'funcionario')),
  primeiro_acesso_concluido BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================================
-- 4. TABELA DE PERFIS / USUÁRIOS DE AUTH (public.profiles)
-- ================================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  nome TEXT,
  full_name TEXT,
  cpf TEXT,
  rg TEXT,
  data_nascimento DATE,
  telefone TEXT,
  foto_url TEXT,
  avatar_url TEXT,
  matricula TEXT,
  pis TEXT,
  ctps TEXT,
  nome_mae TEXT,
  endereco TEXT,
  condominio_id TEXT,
  cargo TEXT DEFAULT 'Porteiro',
  tipo_jornada TEXT DEFAULT '12x36',
  turno_inicio TIME DEFAULT '07:00:00',
  turno_fim TIME DEFAULT '19:00:00',
  data_admissao DATE DEFAULT CURRENT_DATE,
  salario_base NUMERIC(10, 2) DEFAULT 2150.00,
  pix TEXT,
  banco TEXT,
  agencia TEXT,
  conta TEXT,
  recebe_vt BOOLEAN DEFAULT TRUE,
  recebe_vr BOOLEAN DEFAULT TRUE,
  valor_vr NUMERIC(10, 2) DEFAULT 28.50,
  recebe_va BOOLEAN DEFAULT TRUE,
  valor_va NUMERIC(10, 2) DEFAULT 220.00,
  valor_extra_ft NUMERIC(10, 2) DEFAULT 160.00,
  valor_bonus NUMERIC(10, 2) DEFAULT 0.00,
  email TEXT,
  senha TEXT,
  role TEXT DEFAULT 'funcionario',
  primeiro_acesso_concluido BOOLEAN DEFAULT FALSE,
  disponivel_ft BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================================
-- 5. TABELA DE OCORRÊNCIAS OPERACIONAIS (public.ocorrencias)
-- ================================================================================
CREATE TABLE IF NOT EXISTS public.ocorrencias (
  id TEXT PRIMARY KEY DEFAULT ('ocorr-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 4)),
  posto_id TEXT NOT NULL,
  posto_nome TEXT,
  tipo TEXT NOT NULL DEFAULT 'Posto Descoberto', -- 'Posto Descoberto', 'Atraso', 'Falta de Material', etc.
  descricao TEXT NOT NULL,
  registrado_por TEXT NOT NULL DEFAULT 'Supervisora Silva',
  data_hora TEXT DEFAULT ('Hoje às ' || to_char(now(), 'HH24:MI')),
  urgencia TEXT NOT NULL DEFAULT 'alta' CHECK (urgencia IN ('alta', 'media', 'baixa')),
  resolvida BOOLEAN NOT NULL DEFAULT FALSE,
  resolvida_por TEXT,
  resolvida_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================================
-- 6. TABELA DE ALERTAS OPERACIONAIS (public.alertas)
-- ================================================================================
CREATE TABLE IF NOT EXISTS public.alertas (
  id TEXT PRIMARY KEY DEFAULT ('alert-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 4)),
  tipo TEXT NOT NULL DEFAULT 'posto_descoberto', -- 'posto_descoberto', 'falta', 'atraso', 'atestado_pendente'
  gravidade TEXT NOT NULL DEFAULT 'critica' CHECK (gravidade IN ('critica', 'moderada', 'informativa')),
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  posto_id TEXT NOT NULL,
  posto_nome TEXT,
  colaborador_id TEXT,
  colaborador_nome TEXT,
  horario TEXT DEFAULT to_char(now(), 'HH24:MI'),
  resolvido BOOLEAN NOT NULL DEFAULT FALSE,
  resolvido_por TEXT,
  resolvido_em TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================================
-- 7. TABELA DE HOLERITES E CONTRACHEQUES (public.holerites)
-- ================================================================================
CREATE TABLE IF NOT EXISTS public.holerites (
  id TEXT PRIMARY KEY DEFAULT ('hol-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 4)),
  colaborador_id TEXT NOT NULL,
  colaborador_nome TEXT NOT NULL,
  matricula TEXT,
  funcao TEXT NOT NULL DEFAULT 'Porteiro',
  posto_nome TEXT DEFAULT 'Matriz - Reserva Central',
  mes_referencia TEXT NOT NULL, -- Ex: 'Outubro/2026'
  salario_base NUMERIC(10, 2) NOT NULL DEFAULT 2150.00,
  adicional_periculosidade NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  adicional_noturno NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  horas_extras_50 NUMERIC(6, 2) DEFAULT 0.00,
  valor_horas_extras NUMERIC(10, 2) DEFAULT 0.00,
  desconto_inss NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  desconto_fgts NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  desconto_vt NUMERIC(10, 2) DEFAULT 0.00,
  desconto_vr NUMERIC(10, 2) DEFAULT 0.00,
  bonus_assiduidade NUMERIC(10, 2) DEFAULT 0.00,
  bonus_ativo BOOLEAN DEFAULT TRUE,
  motivo_perda_bonus TEXT,
  liquido_receber NUMERIC(10, 2) NOT NULL,
  status_envio TEXT NOT NULL DEFAULT 'Pendente' CHECK (status_envio IN ('Assinado', 'Aguardando Assinatura', 'Pendente')),
  data_emissao DATE DEFAULT CURRENT_DATE,
  data_assinatura TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================================
-- 8. TABELA DE REGISTROS DE PONTO (public.pontos)
-- ================================================================================
CREATE TABLE IF NOT EXISTS public.pontos (
  id TEXT PRIMARY KEY DEFAULT ('ponto-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 4)),
  colaborador_id TEXT NOT NULL,
  colaborador_nome TEXT,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  entrada_1 TEXT DEFAULT '07:00',
  saida_1 TEXT DEFAULT '12:00',
  entrada_2 TEXT DEFAULT '13:00',
  saida_2 TEXT DEFAULT '19:00',
  total_horas TEXT DEFAULT '11h 00m',
  status_ponto TEXT NOT NULL DEFAULT 'Regular', -- 'Regular', 'Atraso', 'Hora Extra', 'Incompleto', 'Falta'
  status TEXT DEFAULT 'Regular',
  localizacao_gps TEXT DEFAULT 'Dentro do Raio Geofence (12m)',
  foto_facial TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Garantir colunas na tabela pontos se já existia
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pontos' AND column_name = 'colaborador_nome') THEN
    ALTER TABLE public.pontos ADD COLUMN colaborador_nome TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pontos' AND column_name = 'total_horas') THEN
    ALTER TABLE public.pontos ADD COLUMN total_horas TEXT DEFAULT '11h 00m';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pontos' AND column_name = 'status_ponto') THEN
    ALTER TABLE public.pontos ADD COLUMN status_ponto TEXT DEFAULT 'Regular';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pontos' AND column_name = 'localizacao_gps') THEN
    ALTER TABLE public.pontos ADD COLUMN localizacao_gps TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pontos' AND column_name = 'foto_facial') THEN
    ALTER TABLE public.pontos ADD COLUMN foto_facial TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pontos' AND column_name = 'created_at') THEN
    ALTER TABLE public.pontos ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pontos' AND column_name = 'updated_at') THEN
    ALTER TABLE public.pontos ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- ================================================================================
-- 9. TABELA DE ATESTADOS MÉDICOS (public.atestados)
-- ================================================================================
CREATE TABLE IF NOT EXISTS public.atestados (
  id TEXT PRIMARY KEY DEFAULT ('atest-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 4)),
  colaborador_id TEXT NOT NULL,
  colaborador_nome TEXT NOT NULL,
  matricula TEXT,
  posto_nome TEXT,
  medico TEXT NOT NULL,
  crm TEXT NOT NULL,
  cid TEXT NOT NULL,
  data_inicio DATE NOT NULL,
  dias_afastamento INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Aprovado', 'Recusado')),
  substituto_alocado_id TEXT,
  anexo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================================
-- 10. TABELA DE CADASTRO DA EMPRESA MATRIZ (public.empresa_info)
-- ================================================================================
CREATE TABLE IF NOT EXISTS public.empresa_info (
  id TEXT PRIMARY KEY DEFAULT 'matriz-principal',
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT NOT NULL,
  cnpj TEXT NOT NULL,
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
