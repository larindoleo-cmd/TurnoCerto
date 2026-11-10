-- ================================================================================
-- 06 — FUNCOES_E_TRIGGERS.sql
-- TurnoCerto: Gatilhos (Triggers) e Funções de Automação de Carimbo de Tempo e Sincronismo
-- Executar no SQL Editor do Supabase (PostgreSQL)
-- ================================================================================

-- 1. Função Genérica para Atualização Automática de 'updated_at'
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Triggers de 'updated_at' para todas as tabelas
DROP TRIGGER IF EXISTS trigger_condominios_updated_at ON public.condominios;
CREATE TRIGGER trigger_condominios_updated_at
  BEFORE UPDATE ON public.condominios
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS trigger_colaboradores_updated_at ON public.colaboradores;
CREATE TRIGGER trigger_colaboradores_updated_at
  BEFORE UPDATE ON public.colaboradores
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON public.profiles;
CREATE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS trigger_ocorrencias_updated_at ON public.ocorrencias;
CREATE TRIGGER trigger_ocorrencias_updated_at
  BEFORE UPDATE ON public.ocorrencias
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS trigger_alertas_updated_at ON public.alertas;
CREATE TRIGGER trigger_alertas_updated_at
  BEFORE UPDATE ON public.alertas
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS trigger_holerites_updated_at ON public.holerites;
CREATE TRIGGER trigger_holerites_updated_at
  BEFORE UPDATE ON public.holerites
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS trigger_pontos_updated_at ON public.pontos;
CREATE TRIGGER trigger_pontos_updated_at
  BEFORE UPDATE ON public.pontos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS trigger_atestados_updated_at ON public.atestados;
CREATE TRIGGER trigger_atestados_updated_at
  BEFORE UPDATE ON public.atestados
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS trigger_empresa_info_updated_at ON public.empresa_info;
CREATE TRIGGER trigger_empresa_info_updated_at
  BEFORE UPDATE ON public.empresa_info
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- 3. Função e Trigger para Sincronizar 'condominios' com a tabela legada 'postos'
CREATE OR REPLACE FUNCTION public.sync_condominio_to_posto()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.postos (id, nome, tipo, cnpj, endereco, bairro, cidade, supervisor, status, updated_at)
  VALUES (NEW.id, NEW.nome, NEW.tipo, NEW.cnpj, NEW.endereco, NEW.bairro, NEW.cidade, NEW.supervisor, NEW.status, NOW())
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
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_condominio_posto ON public.condominios;
CREATE TRIGGER trigger_sync_condominio_posto
  AFTER INSERT OR UPDATE ON public.condominios
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_condominio_to_posto();
