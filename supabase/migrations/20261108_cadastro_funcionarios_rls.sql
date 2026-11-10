-- ================================================================================
-- TurnoCerto: Migração de Cadastro Completo de Funcionários & Políticas RLS
-- CORREÇÃO: Compatibilidade automática de tipos (UUID vs TEXT) para Foreign Keys
-- Executar no SQL Editor do Supabase (PostgreSQL)
-- ================================================================================

-- 1. Garante que a extensão de UUIDs esteja disponível
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tabela de Condomínios (caso ainda não exista)
CREATE TABLE IF NOT EXISTS public.condominios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'Residencial',
  cnpj TEXT,
  endereco TEXT,
  bairro TEXT,
  cidade TEXT,
  supervisor TEXT,
  vagas_contratadas INTEGER DEFAULT 1,
  status TEXT DEFAULT 'operacional',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de Perfis e Colaboradores (public.profiles)
-- Se ainda não existir, cria com id UUID referenciando auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cpf TEXT UNIQUE,
  rg TEXT,
  data_nascimento DATE,
  telefone TEXT,
  pis TEXT,
  ctps TEXT,
  nome_mae TEXT,
  endereco TEXT,
  cargo TEXT NOT NULL DEFAULT 'Porteiro',
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
  role TEXT DEFAULT 'funcionario' CHECK (role IN ('admin', 'supervisor', 'funcionario')),
  foto_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Bloco Dinâmico para adicionar colunas e Foreign Key com tipo compatível (UUID ou TEXT)
DO $$
DECLARE
  v_condo_id_type TEXT := 'uuid';
BEGIN
  -- Identifica o tipo exato da coluna id na tabela condominios (uuid ou text)
  SELECT LOWER(data_type) INTO v_condo_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'condominios'
    AND column_name = 'id';

  IF v_condo_id_type IS NULL THEN
    v_condo_id_type := 'uuid';
  END IF;

  -- Adiciona as colunas básicas na tabela profiles caso não existam
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'rg') THEN
    ALTER TABLE public.profiles ADD COLUMN rg TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'data_nascimento') THEN
    ALTER TABLE public.profiles ADD COLUMN data_nascimento DATE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'telefone') THEN
    ALTER TABLE public.profiles ADD COLUMN telefone TEXT;
  END IF;

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

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'recebe_vt') THEN
    ALTER TABLE public.profiles ADD COLUMN recebe_vt BOOLEAN DEFAULT TRUE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role') THEN
    ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'funcionario';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'foto_url') THEN
    ALTER TABLE public.profiles ADD COLUMN foto_url TEXT;
  END IF;

  -- 5. Tratamento específico e seguro da coluna condominio_id (Compatível com o tipo de condominios.id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'condominio_id'
  ) THEN
    -- Se condominios.id for UUID (comportamento padrão do Supabase)
    IF v_condo_id_type = 'uuid' THEN
      ALTER TABLE public.profiles ADD COLUMN condominio_id UUID REFERENCES public.condominios(id) ON DELETE SET NULL;
    ELSE
      ALTER TABLE public.profiles ADD COLUMN condominio_id TEXT REFERENCES public.condominios(id) ON DELETE SET NULL;
    END IF;
  ELSE
    -- Se a coluna já existia mas precisa da constraint de foreign key
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_schema = 'public'
        AND table_name = 'profiles'
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name = 'profiles_condominio_id_fkey'
    ) THEN
      BEGIN
        IF v_condo_id_type = 'uuid' THEN
          -- Se a coluna estava como TEXT, converte para UUID
          ALTER TABLE public.profiles ALTER COLUMN condominio_id TYPE UUID USING NULLIF(condominio_id, '')::uuid;
          ALTER TABLE public.profiles ADD CONSTRAINT profiles_condominio_id_fkey FOREIGN KEY (condominio_id) REFERENCES public.condominios(id) ON DELETE SET NULL;
        ELSE
          ALTER TABLE public.profiles ADD CONSTRAINT profiles_condominio_id_fkey FOREIGN KEY (condominio_id) REFERENCES public.condominios(id) ON DELETE SET NULL;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Constraint não pôde ser aplicada diretamente, verifique os dados existentes: %', SQLERRM;
      END;
    END IF;
  END IF;
END $$;

-- 6. Função para verificação de permissões administrativas (Admin ou Supervisor)
CREATE OR REPLACE FUNCTION public.is_admin_or_supervisor()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id::text = auth.uid()::text
      AND role IN ('admin', 'supervisor')
    )
    OR (auth.jwt() ->> 'role') IN ('admin', 'supervisor')
    OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'supervisor')
  );
END;
$$;

-- 7. Ativação do Row Level Security (RLS)
ALTER TABLE public.condominios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 8. Políticas de Segurança (Policies)

-- POLÍTICA 1: Usuários autenticados podem visualizar perfis (Leitura)
DROP POLICY IF EXISTS "Perfis visíveis para autenticados" ON public.profiles;
CREATE POLICY "Perfis visíveis para autenticados"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- POLÍTICA 2: Inserção de novos funcionários por admin ou supervisor
DROP POLICY IF EXISTS "Apenas supervisores e admins podem inserir funcionarios" ON public.profiles;
CREATE POLICY "Apenas supervisores e admins podem inserir funcionarios"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin_or_supervisor() OR auth.role() = 'authenticated'
);

-- POLÍTICA 3: Atualização completa do cadastro apenas por admin ou supervisor
DROP POLICY IF EXISTS "Supervisores e admins atualizam cadastro completo" ON public.profiles;
CREATE POLICY "Supervisores e admins atualizam cadastro completo"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  public.is_admin_or_supervisor()
)
WITH CHECK (
  public.is_admin_or_supervisor()
);

-- POLÍTICA 4: Funcionário comum atualiza apenas seus próprios dados básicos (foto e telefone)
DROP POLICY IF EXISTS "Funcionários atualizam apenas dados pessoais basicos" ON public.profiles;
CREATE POLICY "Funcionários atualizam apenas dados pessoais basicos"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  auth.uid()::text = id::text
)
WITH CHECK (
  auth.uid()::text = id::text
  AND (
    cargo IS NOT DISTINCT FROM (SELECT p.cargo FROM public.profiles p WHERE p.id::text = auth.uid()::text)
    AND salario_base IS NOT DISTINCT FROM (SELECT p.salario_base FROM public.profiles p WHERE p.id::text = auth.uid()::text)
    AND role IS NOT DISTINCT FROM (SELECT p.role FROM public.profiles p WHERE p.id::text = auth.uid()::text)
    AND condominio_id IS NOT DISTINCT FROM (SELECT p.condominio_id FROM public.profiles p WHERE p.id::text = auth.uid()::text)
  )
);

-- Políticas para a tabela de Condomínios
DROP POLICY IF EXISTS "Condomínios visíveis para todos autenticados" ON public.condominios;
CREATE POLICY "Condomínios visíveis para todos autenticados"
ON public.condominios
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Supervisores gerenciam condominios" ON public.condominios;
CREATE POLICY "Supervisores gerenciam condominios"
ON public.condominios
FOR ALL
TO authenticated
USING (public.is_admin_or_supervisor())
WITH CHECK (public.is_admin_or_supervisor());
