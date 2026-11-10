-- ================================================================================
-- 03 — INTEGRIDADE_E_RELACIONAMENTOS.sql
-- TurnoCerto: Chaves Primárias, Chaves Estrangeiras, Integridade Referencial e Constraints
-- Trata com segurança tanto identificadores alfanuméricos quanto UUIDs
-- Executar no SQL Editor do Supabase (PostgreSQL)
-- ================================================================================

-- 1. Normalização dos tipos de ID para compatibilidade mista (TEXT)
-- Garante que 'condominios.id' e 'colaboradores.id' possam receber tanto 'cond-1' quanto UUIDs
DO $$
BEGIN
  -- Se condominios.id for do tipo UUID e existirem IDs alfanuméricos no app ('cond-1'),
  -- permitimos chaves TEXT para unificar a compatibilidade sem erros de parsing.
  BEGIN
    ALTER TABLE public.condominios ALTER COLUMN id TYPE TEXT USING id::text;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Coluna id em condominios mantida ou já é text: %', SQLERRM;
  END;

  BEGIN
    ALTER TABLE public.colaboradores ALTER COLUMN id TYPE TEXT USING id::text;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Coluna id em colaboradores mantida: %', SQLERRM;
  END;

  BEGIN
    ALTER TABLE public.colaboradores ALTER COLUMN condominio_id TYPE TEXT USING condominio_id::text;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Coluna condominio_id em colaboradores mantida: %', SQLERRM;
  END;

  BEGIN
    ALTER TABLE public.profiles ALTER COLUMN condominio_id TYPE TEXT USING condominio_id::text;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Coluna condominio_id em profiles mantida: %', SQLERRM;
  END;
END $$;

-- 2. Chaves Estrangeiras Seguras (com verificação prévia de existência)
DO $$
BEGIN
  -- Relacionamento: colaboradores.condominio_id -> condominios.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'colaboradores'
      AND constraint_name = 'fk_colaboradores_condominio'
  ) THEN
    BEGIN
      ALTER TABLE public.colaboradores
        ADD CONSTRAINT fk_colaboradores_condominio
        FOREIGN KEY (condominio_id)
        REFERENCES public.condominios(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Aviso na criação de fk_colaboradores_condominio: %', SQLERRM;
    END;
  END IF;

  -- Relacionamento: ocorrencias.posto_id -> condominios.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'ocorrencias'
      AND constraint_name = 'fk_ocorrencias_posto'
  ) THEN
    BEGIN
      ALTER TABLE public.ocorrencias
        ADD CONSTRAINT fk_ocorrencias_posto
        FOREIGN KEY (posto_id)
        REFERENCES public.condominios(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Aviso na criação de fk_ocorrencias_posto: %', SQLERRM;
    END;
  END IF;

  -- Relacionamento: alertas.posto_id -> condominios.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'alertas'
      AND constraint_name = 'fk_alertas_posto'
  ) THEN
    BEGIN
      ALTER TABLE public.alertas
        ADD CONSTRAINT fk_alertas_posto
        FOREIGN KEY (posto_id)
        REFERENCES public.condominios(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Aviso na criação de fk_alertas_posto: %', SQLERRM;
    END;
  END IF;

  -- Relacionamento: pontos.colaborador_id -> colaboradores.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'pontos'
      AND constraint_name = 'fk_pontos_colaborador'
  ) THEN
    BEGIN
      ALTER TABLE public.pontos
        ADD CONSTRAINT fk_pontos_colaborador
        FOREIGN KEY (colaborador_id)
        REFERENCES public.colaboradores(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Aviso na criação de fk_pontos_colaborador: %', SQLERRM;
    END;
  END IF;

  -- Relacionamento: atestados.colaborador_id -> colaboradores.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'atestados'
      AND constraint_name = 'fk_atestados_colaborador'
  ) THEN
    BEGIN
      ALTER TABLE public.atestados
        ADD CONSTRAINT fk_atestados_colaborador
        FOREIGN KEY (colaborador_id)
        REFERENCES public.colaboradores(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Aviso na criação de fk_atestados_colaborador: %', SQLERRM;
    END;
  END IF;

  -- Relacionamento: holerites.colaborador_id -> colaboradores.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'holerites'
      AND constraint_name = 'fk_holerites_colaborador'
  ) THEN
    BEGIN
      ALTER TABLE public.holerites
        ADD CONSTRAINT fk_holerites_colaborador
        FOREIGN KEY (colaborador_id)
        REFERENCES public.colaboradores(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Aviso na criação de fk_holerites_colaborador: %', SQLERRM;
    END;
  END IF;
END $$;

-- 3. Constraints CHECK de Validação de Domínio Operacional
DO $$
BEGIN
  -- Status do colaborador
  BEGIN
    ALTER TABLE public.colaboradores 
      DROP CONSTRAINT IF EXISTS chk_colaboradores_status;
    ALTER TABLE public.colaboradores 
      ADD CONSTRAINT chk_colaboradores_status 
      CHECK (status IN ('no_posto', 'folga', 'falta', 'afastado'));
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Constraint chk_colaboradores_status ignorada: %', SQLERRM;
  END;

  -- Status do condomínio
  BEGIN
    ALTER TABLE public.condominios 
      DROP CONSTRAINT IF EXISTS chk_condominios_status;
    ALTER TABLE public.condominios 
      ADD CONSTRAINT chk_condominios_status 
      CHECK (status IN ('operacional', 'atencao', 'critico'));
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Constraint chk_condominios_status ignorada: %', SQLERRM;
  END;
END $$;
