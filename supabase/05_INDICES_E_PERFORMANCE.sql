-- ================================================================================
-- 05 — INDICES_E_PERFORMANCE.sql
-- TurnoCerto: Índices de Desempenho e Otimização para Consultas em Tempo Real
-- Melhora velocidade de filtros na Operação 360, Equipe, Holerites e Pontos
-- Executar no SQL Editor do Supabase (PostgreSQL)
-- ================================================================================

-- 1. Índices para Tabela de Colaboradores
CREATE INDEX IF NOT EXISTS idx_colaboradores_condominio_id 
  ON public.colaboradores (condominio_id);

CREATE INDEX IF NOT EXISTS idx_colaboradores_status 
  ON public.colaboradores (status);

CREATE INDEX IF NOT EXISTS idx_colaboradores_cpf 
  ON public.colaboradores (cpf);

CREATE INDEX IF NOT EXISTS idx_colaboradores_email 
  ON public.colaboradores (email);

CREATE INDEX IF NOT EXISTS idx_colaboradores_cargo 
  ON public.colaboradores (cargo);

-- 2. Índices para Tabela de Condomínios / Postos
CREATE INDEX IF NOT EXISTS idx_condominios_status 
  ON public.condominios (status);

CREATE INDEX IF NOT EXISTS idx_condominios_cnpj 
  ON public.condominios (cnpj);

CREATE INDEX IF NOT EXISTS idx_condominios_nome 
  ON public.condominios (nome);

-- 3. Índices para Ocorrências e Alertas
CREATE INDEX IF NOT EXISTS idx_ocorrencias_posto_id 
  ON public.ocorrencias (posto_id);

CREATE INDEX IF NOT EXISTS idx_ocorrencias_resolvida 
  ON public.ocorrencias (resolvida);

CREATE INDEX IF NOT EXISTS idx_alertas_posto_id 
  ON public.alertas (posto_id);

CREATE INDEX IF NOT EXISTS idx_alertas_resolvido 
  ON public.alertas (resolvido);

-- 4. Índices para Ponto Eletrônico e Holerites
CREATE INDEX IF NOT EXISTS idx_pontos_colaborador_data 
  ON public.pontos (colaborador_id, data);

CREATE INDEX IF NOT EXISTS idx_holerites_colab_mes 
  ON public.holerites (colaborador_id, mes_referencia);

CREATE INDEX IF NOT EXISTS idx_atestados_colaborador_status 
  ON public.atestados (colaborador_id, status);
