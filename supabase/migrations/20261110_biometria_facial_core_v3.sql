-- ============================================================================
-- TurnoCerto: Reestruturação do Motor de Biometria Facial Centralizada (v3)
-- Arquivo: supabase/migrations/20261110_biometria_facial_core_v3.sql
--
-- Compatibilidade:
-- - Chaves primárias e relacionamentos com colaboradores.id TEXT
-- - Persistência central de templates faciais com modelo ResNet-34 128D
-- - Migração de cadastros legados com flag 'legado_necessita_recadastro'
-- - Armazenamento de hash seguro do token de autorização (SHA-256)
-- - Transação atômica para consumo de autorização e ativação de biometria
-- - RLS estrito sem brechas para 'anon'
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. ATUALIZAÇÃO DA TABELA MESTRA DE COLABORADORES
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='colaboradores' AND column_name='status_biometria') THEN
    ALTER TABLE public.colaboradores ADD COLUMN status_biometria TEXT NOT NULL DEFAULT 'nao_cadastrada'
      CHECK (status_biometria IN ('nao_cadastrada', 'ativa', 'legado_necessita_recadastro', 'recadastro_solicitado', 'revogada'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='colaboradores' AND column_name='template_ativo_id') THEN
    ALTER TABLE public.colaboradores ADD COLUMN template_ativo_id TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='colaboradores' AND column_name='biometria_cadastrada') THEN
    ALTER TABLE public.colaboradores ADD COLUMN biometria_cadastrada BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='colaboradores' AND column_name='biometria_atualizada_em') THEN
    ALTER TABLE public.colaboradores ADD COLUMN biometria_atualizada_em TIMESTAMPTZ;
  END IF;
END $$;

-- Marca cadastros legados antigos (Sobel artesanal) como necessitando de recadastro homologado
UPDATE public.colaboradores
SET status_biometria = 'legado_necessita_recadastro'
WHERE biometria_cadastrada = TRUE AND (status_biometria IS NULL OR status_biometria = 'nao_cadastrada');

-- 2. TABELA CENTRAL DE TEMPLATES BIOMÉTRICOS FACIAIS
CREATE TABLE IF NOT EXISTS public.templates_biometricos_faciais (
  id TEXT PRIMARY KEY DEFAULT ('tbf-' || substr(md5(random()::text), 1, 16)),
  colaborador_id TEXT NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  modelo_nome TEXT NOT NULL DEFAULT 'face_recognition_resnet34',
  modelo_versao TEXT NOT NULL DEFAULT '1.7.15',
  dimensao INTEGER NOT NULL DEFAULT 128,
  embedding JSONB NOT NULL,
  hash_template TEXT NOT NULL,
  qualidade_score DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  foto_storage_path TEXT,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'legado_necessita_recadastro', 'revogado')),
  autorizado_por_supervisor_id TEXT,
  token_autorizacao_hash TEXT,
  origem_cadastro TEXT NOT NULL DEFAULT 'app_colaborador',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ativado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revogado_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tbf_colaborador ON public.templates_biometricos_faciais(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_tbf_status ON public.templates_biometricos_faciais(status);
CREATE INDEX IF NOT EXISTS idx_tbf_colab_ativo ON public.templates_biometricos_faciais(colaborador_id, status) WHERE status = 'ativo';

-- 3. TABELA DE SOLICITAÇÕES DE BIOMETRIA FACIAL
CREATE TABLE IF NOT EXISTS public.solicitacoes_biometria_facial (
  id TEXT PRIMARY KEY DEFAULT ('sbf-' || substr(md5(random()::text), 1, 16)),
  colaborador_id TEXT NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  colaborador_nome TEXT NOT NULL,
  colaborador_matricula TEXT,
  colaborador_funcao TEXT,
  condominio_id TEXT,
  posto_nome TEXT,
  foto_perfil TEXT,
  tipo_solicitacao TEXT NOT NULL CHECK (tipo_solicitacao IN ('primeiro_cadastro', 'atualizacao_recadastro')),
  motivo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'rejeitada', 'utilizada', 'expirada')),
  
  -- Autorização do Supervisor
  supervisor_id TEXT,
  supervisor_nome TEXT,
  autorizado_em TIMESTAMPTZ,
  validade_autorizacao TIMESTAMPTZ,
  token_autorizacao_hash TEXT,
  token_autorizacao_mascarado TEXT,
  
  -- Rejeição
  justificativa_rejeicao TEXT,
  rejeitado_em TIMESTAMPTZ,
  
  -- Consumo
  utilizado_em TIMESTAMPTZ,
  template_gerado_id TEXT,
  versao_modelo_biometrico TEXT DEFAULT 'face_recognition_resnet34',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sbf_colaborador_id ON public.solicitacoes_biometria_facial(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_sbf_status_busca ON public.solicitacoes_biometria_facial(status);
CREATE INDEX IF NOT EXISTS idx_sbf_token_hash ON public.solicitacoes_biometria_facial(token_autorizacao_hash);

-- 4. TABELA DE HISTÓRICO E AUDITORIA BIOMÉTRICA (LGPD / PORTARIA 671 MTE)
CREATE TABLE IF NOT EXISTS public.historico_biometria_facial (
  id TEXT PRIMARY KEY DEFAULT ('hbf-' || substr(md5(random()::text), 1, 16)),
  colaborador_id TEXT NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  solicitacao_id TEXT REFERENCES public.solicitacoes_biometria_facial(id) ON DELETE SET NULL,
  template_id TEXT REFERENCES public.templates_biometricos_faciais(id) ON DELETE SET NULL,
  supervisor_id TEXT,
  tipo_evento TEXT NOT NULL CHECK (tipo_evento IN ('solicitado', 'aprovado', 'rejeitado', 'cadastrado', 'substituido', 'revogado', 'expirado', 'falha_validacao')),
  detalhes TEXT NOT NULL,
  versao_modelo TEXT NOT NULL DEFAULT 'face_recognition_resnet34',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hbf_colaborador_id ON public.historico_biometria_facial(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_hbf_data_recente ON public.historico_biometria_facial(created_at DESC);

-- 5. FUNÇÃO TRANSACIONAL PARA REGISTRAR E ATIVAR NOVO TEMPLATE COM CONSUMO ATÔMICO DO TOKEN
CREATE OR REPLACE FUNCTION public.consumir_autorizacao_e_ativar_template_v3(
  p_colaborador_id TEXT,
  p_token_hash TEXT,
  p_embedding JSONB,
  p_hash_template TEXT,
  p_foto_storage_path TEXT DEFAULT NULL,
  p_qualidade_score DOUBLE PRECISION DEFAULT 1.0,
  p_modelo_nome TEXT DEFAULT 'face_recognition_resnet34',
  p_modelo_versao TEXT DEFAULT '1.7.15'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_solicitacao RECORD;
  v_template_id TEXT;
  v_template_anterior_id TEXT;
BEGIN
  -- 1. Localiza a solicitação aprovada com lock exclusivo
  SELECT * INTO v_solicitacao
  FROM public.solicitacoes_biometria_facial
  WHERE colaborador_id = p_colaborador_id
    AND token_autorizacao_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'TOKEN_INVALIDO',
      'message', 'Token de autorização não encontrado ou não corresponde ao colaborador informado.'
    );
  END IF;

  IF v_solicitacao.status = 'utilizada' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'TOKEN_JA_UTILIZADO',
      'message', 'Esta autorização já foi consumida em um cadastro prévio.'
    );
  END IF;

  IF v_solicitacao.status != 'aprovada' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'STATUS_INVALIDO',
      'message', 'A solicitação de biometria não está no status aprovada.'
    );
  END IF;

  IF v_solicitacao.validade_autorizacao IS NOT NULL AND v_solicitacao.validade_autorizacao < NOW() THEN
    UPDATE public.solicitacoes_biometria_facial
    SET status = 'expirada', updated_at = NOW()
    WHERE id = v_solicitacao.id;

    RETURN jsonb_build_object(
      'success', false,
      'code', 'TOKEN_EXPIRADO',
      'message', 'A autorização expirou. Solicite nova liberação ao seu supervisor.'
    );
  END IF;

  -- 2. Identifica se existe template ativo anterior para substituição controlada
  SELECT id INTO v_template_anterior_id
  FROM public.templates_biometricos_faciais
  WHERE colaborador_id = p_colaborador_id AND status = 'ativo'
  LIMIT 1;

  -- Se existir template anterior, revoga-o atomicamente
  IF v_template_anterior_id IS NOT NULL THEN
    UPDATE public.templates_biometricos_faciais
    SET status = 'revogado', revogado_em = NOW()
    WHERE id = v_template_anterior_id;
  END IF;

  -- 3. Cria o novo template biométrico ativo
  v_template_id := 'tbf-' || substr(md5(random()::text), 1, 16);

  INSERT INTO public.templates_biometricos_faciais (
    id,
    colaborador_id,
    modelo_nome,
    modelo_versao,
    dimensao,
    embedding,
    hash_template,
    qualidade_score,
    foto_storage_path,
    status,
    autorizado_por_supervisor_id,
    token_autorizacao_hash,
    origem_cadastro,
    criado_em,
    ativado_em
  ) VALUES (
    v_template_id,
    p_colaborador_id,
    p_modelo_nome,
    p_modelo_versao,
    jsonb_array_length(p_embedding),
    p_embedding,
    p_hash_template,
    p_qualidade_score,
    p_foto_storage_path,
    'ativo',
    v_solicitacao.supervisor_id,
    p_token_hash,
    'app_colaborador',
    NOW(),
    NOW()
  );

  -- 4. Atualiza a solicitação como utilizada
  UPDATE public.solicitacoes_biometria_facial
  SET status = 'utilizada',
      utilizado_em = NOW(),
      template_gerado_id = v_template_id,
      updated_at = NOW()
  WHERE id = v_solicitacao.id;

  -- 5. Atualiza o cadastro do colaborador
  UPDATE public.colaboradores
  SET status_biometria = 'ativa',
      template_ativo_id = v_template_id,
      biometria_cadastrada = TRUE,
      biometria_atualizada_em = NOW(),
      updated_at = NOW()
  WHERE id = p_colaborador_id;

  -- 6. Registra no histórico de auditoria
  INSERT INTO public.historico_biometria_facial (
    colaborador_id,
    solicitacao_id,
    template_id,
    supervisor_id,
    tipo_evento,
    detalhes,
    versao_modelo
  ) VALUES (
    p_colaborador_id,
    v_solicitacao.id,
    v_template_id,
    v_solicitacao.supervisor_id,
    CASE WHEN v_template_anterior_id IS NOT NULL THEN 'substituido' ELSE 'cadastrado' END,
    'Template facial ' || v_template_id || ' homologado e ativado com sucesso após autorização do supervisor ' || COALESCE(v_solicitacao.supervisor_nome, 'N/A'),
    p_modelo_nome || ' ' || p_modelo_versao
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Biometria facial ativada centralmente com sucesso!',
    'template_id', v_template_id,
    'colaborador_id', p_colaborador_id,
    'status', 'ativa'
  );
END;
$$;

-- 6. FUNÇÃO 1:1 PARA RECUPERAR O TEMPLATE ATIVO DO COLABORADOR
CREATE OR REPLACE FUNCTION public.obter_template_facial_ativo(p_colaborador_id TEXT)
RETURNS TABLE (
  template_id TEXT,
  colaborador_id TEXT,
  modelo_nome TEXT,
  modelo_versao TEXT,
  dimensao INTEGER,
  embedding JSONB,
  qualidade_score DOUBLE PRECISION,
  ativado_em TIMESTAMPTZ,
  status TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT 
    t.id AS template_id,
    t.colaborador_id,
    t.modelo_nome,
    t.modelo_versao,
    t.dimensao,
    t.embedding,
    t.qualidade_score,
    t.ativado_em,
    t.status
  FROM public.templates_biometricos_faciais t
  WHERE t.colaborador_id = p_colaborador_id
    AND t.status = 'ativo'
  LIMIT 1;
$$;

-- 7. SEGURANÇA E POLÍTICAS DE ACESSO (RLS)
ALTER TABLE public.templates_biometricos_faciais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitacoes_biometria_facial ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_biometria_facial ENABLE ROW LEVEL SECURITY;

-- Revoga permissões abertas prévias
REVOKE ALL ON public.templates_biometricos_faciais FROM anon;
REVOKE ALL ON public.solicitacoes_biometria_facial FROM anon;
REVOKE ALL ON public.historico_biometria_facial FROM anon;

-- Permite apenas leitura via função autenticada ou papéis restritos
GRANT EXECUTE ON FUNCTION public.obter_template_facial_ativo(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consumir_autorizacao_e_ativar_template_v3(TEXT, TEXT, JSONB, TEXT, TEXT, DOUBLE PRECISION, TEXT, TEXT) TO authenticated, service_role;

-- Políticas para templates_biometricos_faciais
CREATE POLICY "Templates acessíveis por usuário autenticado correspondente ou gestor"
ON public.templates_biometricos_faciais FOR SELECT
TO authenticated
USING (
  colaborador_id = auth.uid()::text
  OR auth.jwt() ->> 'role' IN ('admin', 'supervisor', 'service_role')
);

-- Políticas para solicitacoes_biometria_facial
CREATE POLICY "Colaborador cria sua própria solicitação de biometria"
ON public.solicitacoes_biometria_facial FOR INSERT
TO authenticated
WITH CHECK (
  colaborador_id = auth.uid()::text
  OR auth.jwt() ->> 'role' IN ('admin', 'supervisor', 'service_role')
);

CREATE POLICY "Colaborador visualiza suas solicitações e supervisor visualiza equipe"
ON public.solicitacoes_biometria_facial FOR SELECT
TO authenticated
USING (
  colaborador_id = auth.uid()::text
  OR auth.jwt() ->> 'role' IN ('admin', 'supervisor', 'service_role')
);

CREATE POLICY "Supervisor ou admin atualiza solicitação"
ON public.solicitacoes_biometria_facial FOR UPDATE
TO authenticated
USING (
  auth.jwt() ->> 'role' IN ('admin', 'supervisor', 'service_role')
  OR colaborador_id = auth.uid()::text
);

-- Políticas para historico_biometria_facial
CREATE POLICY "Histórico biométrico visível apenas para o titular ou gestores"
ON public.historico_biometria_facial FOR SELECT
TO authenticated
USING (
  colaborador_id = auth.uid()::text
  OR auth.jwt() ->> 'role' IN ('admin', 'supervisor', 'service_role')
);

-- 8. BUCKETS DE STORAGE PRIVADOS
INSERT INTO storage.buckets (id, name, public)
VALUES ('biometria-fotos', 'biometria-fotos', false),
       ('comprovantes-ponto', 'comprovantes-ponto', false)
ON CONFLICT (id) DO NOTHING;
