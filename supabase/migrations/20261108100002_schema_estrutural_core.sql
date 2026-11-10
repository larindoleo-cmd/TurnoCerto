-- ================================================================================
-- TurnoCerto: Migração 02 - Schema Estrutural Core (Mestras)
-- Arquivo: supabase/migrations/20261108100002_schema_estrutural_core.sql
-- Tipo: DDL (Criação e Padronização Estrutural)
-- Tabelas: condominios, colaboradores, profiles, postos
-- ================================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TABELA MESTRA DE CONDOMÍNIOS / POSTOS DE TRABALHO
CREATE TABLE IF NOT EXISTS public.condominios (
  id TEXT PRIMARY KEY DEFAULT ('cond-' || substr(md5(random()::text), 1, 8)),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'Residencial',
  cnpj TEXT DEFAULT '00.000.000/0001-00',
  contrato_numero TEXT,
  endereco TEXT,
  bairro TEXT,
  cidade TEXT DEFAULT 'São Paulo - SP',
  supervisor TEXT DEFAULT 'Supervisora Silva',
  telefone_supervisor TEXT DEFAULT '(11) 98842-1190',
  vagas_contratadas INTEGER NOT NULL DEFAULT 2,
  vagas_ocupadas INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'operacional',
  motivo_atencao TEXT,
  tipo_escala_padrao TEXT DEFAULT '12x36 (07:00 - 19:00)',
  cobertura_percentual NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
  contato_sindico TEXT DEFAULT 'Síndico Responsável',
  telefone_sindico TEXT DEFAULT '(11) 98765-4321',
  instrucoes_guarita TEXT DEFAULT 'Controle de acesso e portaria.',
  foto_url TEXT,
  latitude DOUBLE PRECISION NOT NULL DEFAULT -23.5505,
  longitude DOUBLE PRECISION NOT NULL DEFAULT -46.6333,
  raio_tolerancia_metros INTEGER NOT NULL DEFAULT 150,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bloco dinâmico de garantia de colunas em condominios
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='condominios' AND column_name='vagas_ocupadas') THEN
    ALTER TABLE public.condominios ADD COLUMN vagas_ocupadas INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='condominios' AND column_name='cobertura_percentual') THEN
    ALTER TABLE public.condominios ADD COLUMN cobertura_percentual NUMERIC(5, 2) NOT NULL DEFAULT 100.00;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='condominios' AND column_name='contrato_numero') THEN
    ALTER TABLE public.condominios ADD COLUMN contrato_numero TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='condominios' AND column_name='telefone_supervisor') THEN
    ALTER TABLE public.condominios ADD COLUMN telefone_supervisor TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='condominios' AND column_name='contato_sindico') THEN
    ALTER TABLE public.condominios ADD COLUMN contato_sindico TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='condominios' AND column_name='telefone_sindico') THEN
    ALTER TABLE public.condominios ADD COLUMN telefone_sindico TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='condominios' AND column_name='instrucoes_guarita') THEN
    ALTER TABLE public.condominios ADD COLUMN instrucoes_guarita TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='condominios' AND column_name='foto_url') THEN
    ALTER TABLE public.condominios ADD COLUMN foto_url TEXT;
  END IF;
END $$;

-- 2. TABELA MESTRA DE COLABORADORES
CREATE TABLE IF NOT EXISTS public.colaboradores (
  id TEXT PRIMARY KEY DEFAULT ('colab-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 6)),
  nome TEXT NOT NULL,
  full_name TEXT,
  matricula TEXT,
  cpf TEXT UNIQUE,
  rg TEXT,
  data_nascimento DATE,
  telefone TEXT,
  foto_url TEXT,
  pis TEXT,
  ctps TEXT,
  nome_mae TEXT,
  endereco TEXT,
  funcao TEXT NOT NULL DEFAULT 'Porteiro',
  cargo TEXT NOT NULL DEFAULT 'Porteiro',
  condominio_id TEXT,
  status TEXT NOT NULL DEFAULT 'no_posto',
  jornada TEXT DEFAULT '12x36 (07:00 - 19:00)',
  tipo_jornada TEXT DEFAULT '12x36',
  turno_inicio TIME DEFAULT '07:00:00',
  turno_fim TIME DEFAULT '19:00:00',
  data_admissao DATE DEFAULT CURRENT_DATE,
  salario_base NUMERIC(10, 2) NOT NULL DEFAULT 2150.00,
  banco_horas NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
  pix TEXT,
  banco TEXT DEFAULT '341 - Itaú Unibanco S.A.',
  agencia TEXT,
  conta TEXT,
  recebe_vt BOOLEAN NOT NULL DEFAULT TRUE,
  recebe_vr BOOLEAN NOT NULL DEFAULT TRUE,
  valor_vr NUMERIC(10, 2) NOT NULL DEFAULT 28.50,
  recebe_va BOOLEAN NOT NULL DEFAULT TRUE,
  valor_va NUMERIC(10, 2) NOT NULL DEFAULT 220.00,
  valor_extra_ft NUMERIC(10, 2) NOT NULL DEFAULT 160.00,
  valor_bonus NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  email TEXT,
  senha TEXT DEFAULT 'Turno@2026',
  role TEXT NOT NULL DEFAULT 'funcionario',
  primeiro_acesso_concluido BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bloco dinâmico de garantia de colunas em colaboradores
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='colaboradores' AND column_name='full_name') THEN
    ALTER TABLE public.colaboradores ADD COLUMN full_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='colaboradores' AND column_name='funcao') THEN
    ALTER TABLE public.colaboradores ADD COLUMN funcao TEXT DEFAULT 'Porteiro';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='colaboradores' AND column_name='banco_horas') THEN
    ALTER TABLE public.colaboradores ADD COLUMN banco_horas NUMERIC(6, 2) DEFAULT 0.00;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='colaboradores' AND column_name='email') THEN
    ALTER TABLE public.colaboradores ADD COLUMN email TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='colaboradores' AND column_name='senha') THEN
    ALTER TABLE public.colaboradores ADD COLUMN senha TEXT DEFAULT 'Turno@2026';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='colaboradores' AND column_name='role') THEN
    ALTER TABLE public.colaboradores ADD COLUMN role TEXT DEFAULT 'funcionario';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='colaboradores' AND column_name='primeiro_acesso_concluido') THEN
    ALTER TABLE public.colaboradores ADD COLUMN primeiro_acesso_concluido BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- 3. TABELA PROFILES (ESPELHO DO SUPABASE AUTH)
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  nome TEXT,
  cpf TEXT,
  rg TEXT,
  data_nascimento DATE,
  telefone TEXT,
  cargo TEXT DEFAULT 'Porteiro',
  role TEXT DEFAULT 'funcionario',
  condominio_id TEXT,
  foto_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABELA POSTOS (RETROCOMPATIBILIDADE)
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
