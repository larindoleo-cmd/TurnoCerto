-- ============================================================================
-- TurnoCerto: Migração Incremental 20261113100002
-- Escopo: Fluxo Bidirecional de Documentos RH <-> Colaborador + Storage Privado
-- ============================================================================

-- 1. Tabela de Solicitações de Documentos feitas pelo RH/Gestão ao Colaborador
CREATE TABLE IF NOT EXISTS public.documento_solicitacoes (
  id TEXT PRIMARY KEY DEFAULT ('docreq-' || replace(gen_random_uuid()::text, '-', '')),
  empresa_id TEXT NOT NULL DEFAULT 'emp-matriz-principal' REFERENCES public.empresas(id) ON DELETE RESTRICT,
  colaborador_id TEXT NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  colaborador_nome TEXT,
  tipo_documento TEXT NOT NULL,
  titulo TEXT NOT NULL,
  instrucoes TEXT,
  prazo_entrega DATE,
  obrigatorio BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'pendente_envio' CHECK (
    status IN ('pendente_envio', 'enviado_analise', 'aprovado', 'recusado', 'atualizacao_solicitada', 'cancelado')
  ),
  solicitado_por UUID,
  solicitado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_solicitacoes_empresa_colab
  ON public.documento_solicitacoes(empresa_id, colaborador_id, status);

-- 2. Extensão Incremental de colaborador_documentos (mantendo retrocompatibilidade)
ALTER TABLE public.colaborador_documentos
  ADD COLUMN IF NOT EXISTS empresa_id TEXT NOT NULL DEFAULT 'emp-matriz-principal' REFERENCES public.empresas(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS solicitacao_id TEXT REFERENCES public.documento_solicitacoes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS versao INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS documento_anterior_id TEXT REFERENCES public.colaborador_documentos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS storage_bucket TEXT NOT NULL DEFAULT 'documentos-funcionarios',
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS sha256 TEXT,
  ADD COLUMN IF NOT EXISTS enviado_por UUID,
  ADD COLUMN IF NOT EXISTS revisado_por UUID,
  ADD COLUMN IF NOT EXISTS revisado_por_nome TEXT,
  ADD COLUMN IF NOT EXISTS revisado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS observacao_revisao TEXT;

CREATE INDEX IF NOT EXISTS idx_colab_docs_empresa_status
  ON public.colaborador_documentos(empresa_id, colaborador_id, status);

-- 3. Histórico Imutável de Eventos de Documento
CREATE TABLE IF NOT EXISTS public.documento_historico (
  id TEXT PRIMARY KEY DEFAULT ('doch-' || replace(gen_random_uuid()::text, '-', '')),
  empresa_id TEXT NOT NULL DEFAULT 'emp-matriz-principal' REFERENCES public.empresas(id) ON DELETE RESTRICT,
  solicitacao_id TEXT REFERENCES public.documento_solicitacoes(id) ON DELETE CASCADE,
  documento_id TEXT REFERENCES public.colaborador_documentos(id) ON DELETE CASCADE,
  colaborador_id TEXT NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  acao TEXT NOT NULL CHECK (acao IN ('solicitado', 'enviado', 'aprovado', 'recusado', 'atualizacao_solicitada', 'visualizado', 'baixado')),
  ator_id UUID,
  ator_nome TEXT,
  detalhes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_historico_colab
  ON public.documento_historico(empresa_id, colaborador_id, created_at DESC);

-- 4. Bucket Privado para Documentos Funcionário <-> RH (somente URL assinada temporária)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentos-funcionarios',
  'documentos-funcionarios',
  FALSE,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  public = FALSE,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png'];
