-- ================================================================================
-- TurnoCerto: Migração 06 - Índices de Alta Performance e Otimização de Consultas
-- Arquivo: supabase/migrations/20261108100006_indices_performance.sql
-- Tipo: DDL (Otimização de Índices B-Tree e Parciais)
-- ================================================================================

-- 1. ÍNDICES EM CHAVES ESTRANGEIRAS (Acelera JOINs e Alocações)
CREATE INDEX IF NOT EXISTS idx_colaboradores_condominio_id 
  ON public.colaboradores (condominio_id);

CREATE INDEX IF NOT EXISTS idx_ocorrencias_posto_id 
  ON public.ocorrencias (posto_id);

CREATE INDEX IF NOT EXISTS idx_alertas_posto_id 
  ON public.alertas (posto_id);

CREATE INDEX IF NOT EXISTS idx_alertas_colaborador_id 
  ON public.alertas (colaborador_id);

CREATE INDEX IF NOT EXISTS idx_pontos_colaborador_id 
  ON public.pontos (colaborador_id);

CREATE INDEX IF NOT EXISTS idx_pontos_condominio_id 
  ON public.pontos (condominio_id);

CREATE INDEX IF NOT EXISTS idx_holerites_colaborador_id 
  ON public.holerites (colaborador_id);

CREATE INDEX IF NOT EXISTS idx_atestados_colaborador_id 
  ON public.atestados (colaborador_id);

-- 2. ÍNDICES DE BUSCA NATURAL E AUTENTICAÇÃO
CREATE INDEX IF NOT EXISTS idx_colaboradores_cpf 
  ON public.colaboradores (cpf);

CREATE INDEX IF NOT EXISTS idx_colaboradores_email 
  ON public.colaboradores (email);

CREATE INDEX IF NOT EXISTS idx_colaboradores_status 
  ON public.colaboradores (status);

-- 3. ÍNDICES PARCIAIS (Acelera Dashboards de Supervisão e Alertas Ativos)
CREATE INDEX IF NOT EXISTS idx_alertas_pendentes_recentes 
  ON public.alertas (created_at DESC) 
  WHERE resolvido = FALSE;

CREATE INDEX IF NOT EXISTS idx_ocorrencias_abertas 
  ON public.ocorrencias (created_at DESC) 
  WHERE resolvida = FALSE;

CREATE INDEX IF NOT EXISTS idx_atestados_pendentes 
  ON public.atestados (data_inicio DESC) 
  WHERE status = 'Pendente';

CREATE INDEX IF NOT EXISTS idx_holerites_aguardando_assinatura 
  ON public.holerites (mes_referencia) 
  WHERE status_envio = 'Pendente' OR status_envio = 'Aguardando Assinatura';

-- 4. ÍNDICES TEMPORAIS PARA RELATÓRIOS E CONSULTAS DE FREQUÊNCIA
CREATE INDEX IF NOT EXISTS idx_pontos_data_colaborador 
  ON public.pontos (data DESC, colaborador_id);

CREATE INDEX IF NOT EXISTS idx_ocorrencias_created_at 
  ON public.ocorrencias (created_at DESC);
