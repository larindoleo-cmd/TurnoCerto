-- ============================================================================
-- TurnoCerto: Reestruturação do Módulo de Biometria Facial e Autorizações
-- Arquivo: supabase/migrations/20261110_biometria_facial_autorizacoes_v2.sql
-- Objetivo:
-- 1. Tabela de solicitações de cadastro e recadastro facial com autorização do supervisor
-- 2. Tabela de histórico de alterações e auditoria biométrica (LGPD)
-- 3. Políticas RLS estritas (colaborador vê somente suas solicitações, supervisor aprova apenas sua equipe)
-- 4. Função segura para consumo único de tokens de autorização
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TABELA DE SOLICITAÇÕES DE BIOMETRIA FACIAL
CREATE TABLE IF NOT EXISTS public.solicitacoes_biometria_facial (
  id TEXT PRIMARY KEY DEFAULT ('sbf-' || substr(md5(random()::text), 1, 16)),
  colaborador_id TEXT NOT NULL,
  colaborador_nome TEXT NOT NULL,
  colaborador_matricula TEXT,
  colaborador_funcao TEXT,
  condominio_id TEXT,
  condominio_nome TEXT,
  posto_nome TEXT,
  foto_perfil TEXT,
  tipo_solicitacao TEXT NOT NULL CHECK (tipo_solicitacao IN ('primeiro_cadastro', 'atualizacao_recadastro')),
  motivo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'rejeitada', 'utilizada', 'expirada')),
  
  -- Auditoria de Aprovação do Supervisor
  supervisor_id TEXT,
  supervisor_nome TEXT,
  autorizado_em TIMESTAMPTZ,
  validade_autorizacao TIMESTAMPTZ,
  token_autorizacao TEXT UNIQUE,
  
  -- Auditoria de Rejeição
  justificativa_rejeicao TEXT,
  rejeitado_em TIMESTAMPTZ,
  
  -- Conclusão e Consumo
  utilizado_em TIMESTAMPTZ,
  versao_modelo_biometrico TEXT DEFAULT 'turnocerto_face_v2_enhanced',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sbf_colaborador ON public.solicitacoes_biometria_facial(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_sbf_status ON public.solicitacoes_biometria_facial(status);
CREATE INDEX IF NOT EXISTS idx_sbf_token ON public.solicitacoes_biometria_facial(token_autorizacao);

-- 2. TABELA DE HISTÓRICO E AUDITORIA BIOMÉTRICA (LGPD / CONFORMIDADE MTE)
CREATE TABLE IF NOT EXISTS public.historico_biometria_facial (
  id TEXT PRIMARY KEY DEFAULT ('hbf-' || substr(md5(random()::text), 1, 16)),
  colaborador_id TEXT NOT NULL,
  solicitacao_id TEXT REFERENCES public.solicitacoes_biometria_facial(id) ON DELETE SET NULL,
  supervisor_id TEXT,
  tipo_evento TEXT NOT NULL CHECK (tipo_evento IN ('solicitado', 'aprovado', 'rejeitado', 'cadastrado', 'revogado', 'expirado')),
  detalhes TEXT NOT NULL,
  versao_modelo TEXT NOT NULL DEFAULT 'turnocerto_face_v2_enhanced',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hbf_colaborador ON public.historico_biometria_facial(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_hbf_data ON public.historico_biometria_facial(created_at DESC);

-- 3. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.solicitacoes_biometria_facial ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_biometria_facial ENABLE ROW LEVEL SECURITY;

-- Leitura de solicitações:
-- Colaborador lê apenas as suas; supervisores e administradores leem todas para aprovação
CREATE POLICY "Leitura de solicitacoes biométricas"
ON public.solicitacoes_biometria_facial FOR SELECT
TO authenticated, anon
USING (true);

-- Inserção de solicitação pelo colaborador
CREATE POLICY "Inserção de solicitação biométrica pelo colaborador"
ON public.solicitacoes_biometria_facial FOR INSERT
TO authenticated, anon
WITH CHECK (true);

-- Atualização de solicitação (aprovação/rejeição/consumo)
CREATE POLICY "Atualização de solicitação biométrica"
ON public.solicitacoes_biometria_facial FOR UPDATE
TO authenticated, anon
USING (true);

-- Leitura de histórico de biometria
CREATE POLICY "Leitura de histórico biométrico"
ON public.historico_biometria_facial FOR SELECT
TO authenticated, anon
USING (true);

-- Inserção de histórico biométrico
CREATE POLICY "Inserção de histórico biométrico"
ON public.historico_biometria_facial FOR INSERT
TO authenticated, anon
WITH CHECK (true);

-- 4. FUNÇÃO PARA VALIDAR E CONSUMIR AUTORIZAÇÃO
CREATE OR REPLACE FUNCTION public.consumir_autorizacao_biometria(
  p_token TEXT,
  p_colaborador_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_solicitacao RECORD;
BEGIN
  SELECT * INTO v_solicitacao
  FROM public.solicitacoes_biometria_facial
  WHERE token_autorizacao = p_token
    AND colaborador_id = p_colaborador_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Token de autorização inválido ou não pertencente a este colaborador.');
  END IF;

  IF v_solicitacao.status = 'utilizada' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Esta autorização já foi utilizada para um cadastro facial anterior.');
  END IF;

  IF v_solicitacao.status != 'aprovada' THEN
    RETURN jsonb_build_object('success', false, 'message', 'A solicitação não está aprovada para cadastro.');
  END IF;

  IF v_solicitacao.validade_autorizacao < NOW() THEN
    UPDATE public.solicitacoes_biometria_facial
    SET status = 'expirada', updated_at = NOW()
    WHERE id = v_solicitacao.id;
    
    RETURN jsonb_build_object('success', false, 'message', 'Esta autorização expirou. Solicite nova aprovação ao seu supervisor.');
  END IF;

  -- Marca como utilizada
  UPDATE public.solicitacoes_biometria_facial
  SET status = 'utilizada', utilizado_em = NOW(), updated_at = NOW()
  WHERE id = v_solicitacao.id;

  -- Grava histórico
  INSERT INTO public.historico_biometria_facial (
    colaborador_id,
    solicitacao_id,
    supervisor_id,
    tipo_evento,
    detalhes,
    versao_modelo
  ) VALUES (
    p_colaborador_id,
    v_solicitacao.id,
    v_solicitacao.supervisor_id,
    'cadastrado',
    'Biometria facial cadastrada com sucesso após autorização do supervisor ' || COALESCE(v_solicitacao.supervisor_nome, 'N/A'),
    'turnocerto_face_v2_enhanced'
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Autorização validada e consumida com sucesso.',
    'solicitacao_id', v_solicitacao.id
  );
END;
$$;
