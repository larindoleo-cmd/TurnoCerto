-- ================================================================================
-- TurnoCerto: Migração 07 - Gatilhos, Triggers e Automações de Banco
-- Arquivo: supabase/migrations/20261108100007_triggers_automacoes.sql
-- Tipo: DDL (Funções PL/pgSQL e Triggers de Sincronização)
-- ================================================================================

-- 1. FUNÇÃO GENÉRICA DE CARIMBO DE DATA/HORA (UPDATED_AT)
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers de atualização automática de updated_at
DROP TRIGGER IF EXISTS trigger_condominios_updated_at ON public.condominios;
CREATE TRIGGER trigger_condominios_updated_at
  BEFORE UPDATE ON public.condominios
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS trigger_colaboradores_updated_at ON public.colaboradores;
CREATE TRIGGER trigger_colaboradores_updated_at
  BEFORE UPDATE ON public.colaboradores
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON public.profiles;
CREATE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS trigger_ocorrencias_updated_at ON public.ocorrencias;
CREATE TRIGGER trigger_ocorrencias_updated_at
  BEFORE UPDATE ON public.ocorrencias
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS trigger_alertas_updated_at ON public.alertas;
CREATE TRIGGER trigger_alertas_updated_at
  BEFORE UPDATE ON public.alertas
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS trigger_holerites_updated_at ON public.holerites;
CREATE TRIGGER trigger_holerites_updated_at
  BEFORE UPDATE ON public.holerites
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS trigger_atestados_updated_at ON public.atestados;
CREATE TRIGGER trigger_atestados_updated_at
  BEFORE UPDATE ON public.atestados
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS trigger_empresa_info_updated_at ON public.empresa_info;
CREATE TRIGGER trigger_empresa_info_updated_at
  BEFORE UPDATE ON public.empresa_info
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- 2. FUNÇÃO E TRIGGER DE SINCRONIZAÇÃO: CONDOMINIOS -> POSTOS (RETROCOMPATIBILIDADE)
CREATE OR REPLACE FUNCTION public.fn_sync_condominio_para_posto()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.postos WHERE id = OLD.id;
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    INSERT INTO public.postos (id, nome, tipo, cnpj, endereco, bairro, cidade, supervisor, status, updated_at)
    VALUES (
      NEW.id,
      NEW.nome,
      NEW.tipo,
      NEW.cnpj,
      NEW.endereco,
      NEW.bairro,
      NEW.cidade,
      NEW.supervisor,
      NEW.status,
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

DROP TRIGGER IF EXISTS trigger_sync_condominio_to_posto ON public.condominios;
CREATE TRIGGER trigger_sync_condominio_to_posto
  AFTER INSERT OR UPDATE OR DELETE ON public.condominios
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_condominio_para_posto();

-- 3. FUNÇÃO E TRIGGER DE RECÁLCULO AUTOMÁTICO DE OCUPAÇÃO DE VAGAS EM CONDOMÍNIOS
CREATE OR REPLACE FUNCTION public.fn_recalcular_vagas_condominio()
RETURNS TRIGGER AS $$
DECLARE
  v_condo_id TEXT;
  v_total_alocados INTEGER;
  v_vagas_contratadas INTEGER;
BEGIN
  -- Identifica qual condomínio sofreu alteração
  IF TG_OP = 'DELETE' THEN
    v_condo_id := OLD.condominio_id;
  ELSE
    v_condo_id := NEW.condominio_id;
  END IF;

  IF v_condo_id IS NOT NULL THEN
    -- Conta quantos colaboradores ativos estão alocados neste condomínio
    SELECT COUNT(*) INTO v_total_alocados
    FROM public.colaboradores
    WHERE condominio_id = v_condo_id
      AND status IN ('no_posto', 'ativo');

    -- Recupera o número de vagas contratadas
    SELECT vagas_contratadas INTO v_vagas_contratadas
    FROM public.condominios
    WHERE id = v_condo_id;

    IF v_vagas_contratadas IS NULL OR v_vagas_contratadas <= 0 THEN
      v_vagas_contratadas := 1;
    END IF;

    -- Atualiza condomínio
    UPDATE public.condominios
    SET 
      vagas_ocupadas = v_total_alocados,
      cobertura_percentual = LEAST(100.00, ROUND((v_total_alocados::numeric / v_vagas_contratadas::numeric) * 100, 2))
    WHERE id = v_condo_id;
  END IF;

  -- Se for um UPDATE que mudou o condomínio do colaborador, recalcula também o antigo
  IF TG_OP = 'UPDATE' AND OLD.condominio_id IS NOT NULL AND OLD.condominio_id IS DISTINCT FROM NEW.condominio_id THEN
    SELECT COUNT(*) INTO v_total_alocados
    FROM public.colaboradores
    WHERE condominio_id = OLD.condominio_id
      AND status IN ('no_posto', 'ativo');

    SELECT vagas_contratadas INTO v_vagas_contratadas
    FROM public.condominios
    WHERE id = OLD.condominio_id;

    IF v_vagas_contratadas IS NULL OR v_vagas_contratadas <= 0 THEN
      v_vagas_contratadas := 1;
    END IF;

    UPDATE public.condominios
    SET 
      vagas_ocupadas = v_total_alocados,
      cobertura_percentual = LEAST(100.00, ROUND((v_total_alocados::numeric / v_vagas_contratadas::numeric) * 100, 2))
    WHERE id = OLD.condominio_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_recalcular_vagas_condominio ON public.colaboradores;
CREATE TRIGGER trigger_recalcular_vagas_condominio
  AFTER INSERT OR UPDATE OR DELETE ON public.colaboradores
  FOR EACH ROW EXECUTE FUNCTION public.fn_recalcular_vagas_condominio();
