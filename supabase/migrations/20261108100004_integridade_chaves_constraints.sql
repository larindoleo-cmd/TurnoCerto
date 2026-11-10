-- ================================================================================
-- TurnoCerto: Migração 04 - Integridade Relacional, Foreign Keys e Constraints
-- Arquivo: supabase/migrations/20261108100004_integridade_chaves_constraints.sql
-- Tipo: DDL/DML (Integridade Referencial e Sanitização de Vínculos)
-- ================================================================================

-- 1. SANITIZAÇÃO PRÉVIA DE IDs ÓRFÃOS PARA EVITAR QUEBRAS
-- Desvincula colaboradores associados a condomínios que não existem no banco
UPDATE public.colaboradores
SET condominio_id = NULL
WHERE condominio_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.condominios WHERE id = colaboradores.condominio_id);

-- Desvincula profiles com condomínio inexistente
UPDATE public.profiles
SET condominio_id = NULL
WHERE condominio_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.condominios WHERE id = profiles.condominio_id);

-- 2. CRIAÇÃO DE FOREIGN KEYS DE FORMA SEGURA
DO $$
BEGIN
  -- FK: colaboradores.condominio_id -> condominios.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'colaboradores' AND constraint_name = 'fk_colaboradores_condominio'
  ) THEN
    ALTER TABLE public.colaboradores
      ADD CONSTRAINT fk_colaboradores_condominio
      FOREIGN KEY (condominio_id) REFERENCES public.condominios(id)
      ON DELETE SET NULL;
  END IF;

  -- FK: ocorrencias.posto_id -> condominios.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'ocorrencias' AND constraint_name = 'fk_ocorrencias_posto'
  ) THEN
    ALTER TABLE public.ocorrencias
      ADD CONSTRAINT fk_ocorrencias_posto
      FOREIGN KEY (posto_id) REFERENCES public.condominios(id)
      ON DELETE CASCADE;
  END IF;

  -- FK: alertas.posto_id -> condominios.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'alertas' AND constraint_name = 'fk_alertas_posto'
  ) THEN
    ALTER TABLE public.alertas
      ADD CONSTRAINT fk_alertas_posto
      FOREIGN KEY (posto_id) REFERENCES public.condominios(id)
      ON DELETE CASCADE;
  END IF;

  -- FK: alertas.colaborador_id -> colaboradores.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'alertas' AND constraint_name = 'fk_alertas_colaborador'
  ) THEN
    ALTER TABLE public.alertas
      ADD CONSTRAINT fk_alertas_colaborador
      FOREIGN KEY (colaborador_id) REFERENCES public.colaboradores(id)
      ON DELETE SET NULL;
  END IF;

  -- FK: pontos.colaborador_id -> colaboradores.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'pontos' AND constraint_name = 'fk_pontos_colaborador'
  ) THEN
    ALTER TABLE public.pontos
      ADD CONSTRAINT fk_pontos_colaborador
      FOREIGN KEY (colaborador_id) REFERENCES public.colaboradores(id)
      ON DELETE CASCADE;
  END IF;

  -- FK: holerites.colaborador_id -> colaboradores.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'holerites' AND constraint_name = 'fk_holerites_colaborador'
  ) THEN
    ALTER TABLE public.holerites
      ADD CONSTRAINT fk_holerites_colaborador
      FOREIGN KEY (colaborador_id) REFERENCES public.colaboradores(id)
      ON DELETE CASCADE;
  END IF;

  -- FK: atestados.colaborador_id -> colaboradores.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'atestados' AND constraint_name = 'fk_atestados_colaborador'
  ) THEN
    ALTER TABLE public.atestados
      ADD CONSTRAINT fk_atestados_colaborador
      FOREIGN KEY (colaborador_id) REFERENCES public.colaboradores(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- 3. CHECK CONSTRAINTS DE VALIDAÇÃO (STATUS E ENUMS)
DO $$
BEGIN
  -- Status do condomínio
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_schema = 'public' AND constraint_name = 'chk_condominios_status'
  ) THEN
    ALTER TABLE public.condominios
      ADD CONSTRAINT chk_condominios_status
      CHECK (status IN ('operacional', 'atencao', 'critico'));
  END IF;

  -- Status de envio do holerite
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_schema = 'public' AND constraint_name = 'chk_holerites_status_envio'
  ) THEN
    ALTER TABLE public.holerites
      ADD CONSTRAINT chk_holerites_status_envio
      CHECK (status_envio IN ('Pendente', 'Aguardando Assinatura', 'Assinado'));
  END IF;

  -- Status de aprovação de atestados
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_schema = 'public' AND constraint_name = 'chk_atestados_status'
  ) THEN
    ALTER TABLE public.atestados
      ADD CONSTRAINT chk_atestados_status
      CHECK (status IN ('Pendente', 'Aprovado', 'Recusado'));
  END IF;
END $$;
