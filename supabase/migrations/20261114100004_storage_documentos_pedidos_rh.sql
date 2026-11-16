-- ============================================================================
-- TurnoCerto: Migração Incremental 20261114100004
-- Escopo:
--   1. Tornar buckets fotos-colaboradores e ocorrencias-anexos PRIVADOS (public=false)
--   2. Isolamento estrito por <empresa_id>/... nas policies de storage.objects
--   3. RPCs transacionais e idempotentes para envio/revisão de documentos
--   4. Entidade estruturada solicitacoes_colaborador_rh + histórico + fila RH
-- ============================================================================

-- 1. Privatizar buckets que armazenam fotos de colaboradores e anexos de ocorrências
-- ATENÇÃO OPERACIONAL: Objetos existentes nestes buckets não são removidos; após aplicar,
-- URLs antigas públicas deixarão de responder e o app passará a gerar URLs assinadas temporárias.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('fotos-colaboradores', 'fotos-colaboradores', FALSE, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('ocorrencias-anexos', 'ocorrencias-anexos', FALSE, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE SET
  public = FALSE,
  file_size_limit = 10485760;

-- 2. Corrigir policies permissivas em storage.objects
DROP POLICY IF EXISTS "midias_operacionais_select" ON storage.objects;
DROP POLICY IF EXISTS "midias_operacionais_insert" ON storage.objects;
DROP POLICY IF EXISTS "biometria_fotos_select" ON storage.objects;
DROP POLICY IF EXISTS "biometria_fotos_insert" ON storage.objects;

CREATE POLICY "midias_operacionais_select_v2" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('fotos-colaboradores', 'ocorrencias-anexos', 'fotos-biometria-ponto', 'biometria-fotos', 'comprovantes-ponto')
    AND (storage.foldername(name))[1] = public.current_empresa_id()
    AND (
      (storage.foldername(name))[2] = public.current_colaborador_id()
      OR public.is_rh_or_gestor()
    )
  );

CREATE POLICY "midias_operacionais_insert_v2" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('fotos-colaboradores', 'ocorrencias-anexos', 'fotos-biometria-ponto', 'biometria-fotos', 'comprovantes-ponto')
    AND (storage.foldername(name))[1] = public.current_empresa_id()
    AND (
      (storage.foldername(name))[2] = public.current_colaborador_id()
      OR public.is_rh_or_gestor()
    )
  );

-- 3. Idempotência em colaborador_documentos
ALTER TABLE public.colaborador_documentos
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_colab_docs_idempotency
  ON public.colaborador_documentos(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 4. Tabela Estruturada de Pedidos do Funcionário para o RH
CREATE TABLE IF NOT EXISTS public.solicitacoes_colaborador_rh (
  id TEXT PRIMARY KEY DEFAULT ('pedrh-' || replace(gen_random_uuid()::text, '-', '')),
  empresa_id TEXT NOT NULL DEFAULT 'emp-matriz-principal' REFERENCES public.empresas(id) ON DELETE RESTRICT,
  protocolo TEXT UNIQUE NOT NULL,
  colaborador_id TEXT NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  colaborador_nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('Dúvida sobre Holerite', 'Férias / Folga', 'Vale-Transporte / Benefícios', 'Solicitação de Documento', 'Atestado / Declaração', 'Outro')),
  assunto TEXT NOT NULL,
  descricao TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'em_analise', 'aguardando_colaborador', 'concluida', 'recusada')),
  responsavel_rh_id UUID,
  responsavel_rh_nome TEXT,
  resposta_rh TEXT,
  anexo_bucket TEXT,
  anexo_path TEXT,
  idempotency_key TEXT UNIQUE,
  respondida_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sol_colab_rh_empresa_status
  ON public.solicitacoes_colaborador_rh(empresa_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sol_colab_rh_colab
  ON public.solicitacoes_colaborador_rh(colaborador_id, created_at DESC);

ALTER TABLE public.solicitacoes_colaborador_rh ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.solicitacoes_colaborador_rh FROM anon;

CREATE POLICY "sol_colab_rh_select" ON public.solicitacoes_colaborador_rh
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (colaborador_id = public.current_colaborador_id() OR public.is_rh_or_gestor())
  );

-- 5. RPCs Transacionais de Documentos e Pedidos ao RH
CREATE OR REPLACE FUNCTION public.registrar_documento_colaborador_transacional(
  p_colaborador_id TEXT,
  p_titulo TEXT,
  p_tipo TEXT,
  p_storage_bucket TEXT,
  p_storage_path TEXT,
  p_mime_type TEXT,
  p_file_size_bytes BIGINT,
  p_sha256 TEXT,
  p_solicitacao_id TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_documento_anterior_id TEXT DEFAULT NULL,
  p_versao_anterior INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_emp TEXT := public.current_empresa_id();
  v_role TEXT := public.current_user_role();
  v_colab RECORD;
  v_existing RECORD;
  v_doc_id TEXT;
  v_sol RECORD;
  v_versao INTEGER := GREATEST(1, COALESCE(p_versao_anterior, 0) + 1);
BEGIN
  IF v_uid IS NULL OR v_emp IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.' USING ERRCODE = '42501';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(p_idempotency_key));
    SELECT * INTO v_existing FROM public.colaborador_documentos WHERE idempotency_key = p_idempotency_key LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('documento_id', v_existing.id, 'duplicado', TRUE, 'status', v_existing.status, 'versao', v_existing.versao);
    END IF;
  END IF;

  SELECT * INTO v_colab FROM public.colaboradores WHERE id = p_colaborador_id;
  IF NOT FOUND OR v_colab.empresa_id <> v_emp THEN
    RAISE EXCEPTION 'Colaborador não encontrado ou fora do tenant.' USING ERRCODE = '42501';
  END IF;

  IF v_colab.auth_user_id IS DISTINCT FROM v_uid AND NOT public.is_rh_or_gestor() THEN
    RAISE EXCEPTION 'Sem permissão para enviar documento deste colaborador.' USING ERRCODE = '42501';
  END IF;

  IF p_mime_type NOT IN ('application/pdf', 'image/jpeg', 'image/png') THEN
    RAISE EXCEPTION 'Tipo MIME não permitido.' USING ERRCODE = '22023';
  END IF;

  IF p_storage_path IS NULL OR p_storage_path NOT LIKE (v_emp || '/' || p_colaborador_id || '/%') THEN
    RAISE EXCEPTION 'Caminho de Storage fora do diretório autorizado do titular.' USING ERRCODE = '42501';
  END IF;

  IF p_solicitacao_id IS NOT NULL THEN
    SELECT * INTO v_sol FROM public.documento_solicitacoes WHERE id = p_solicitacao_id AND empresa_id = v_emp;
    IF NOT FOUND OR v_sol.colaborador_id <> p_colaborador_id THEN
      RAISE EXCEPTION 'Solicitação de documento inválida.' USING ERRCODE = '42501';
    END IF;
    SELECT COALESCE(MAX(versao), 0) + 1 INTO v_versao
    FROM public.colaborador_documentos
    WHERE solicitacao_id = p_solicitacao_id;
  END IF;

  v_doc_id := 'doc-' || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.colaborador_documentos (
    id, empresa_id, colaborador_id, solicitacao_id, titulo, tipo, status, versao,
    documento_anterior_id, data_emissao, storage_bucket, storage_path, mime_type,
    file_size_bytes, sha256, tamanho_kb, enviado_por, idempotency_key
  ) VALUES (
    v_doc_id, v_emp, p_colaborador_id, p_solicitacao_id, p_titulo, p_tipo, 'pendente', v_versao,
    p_documento_anterior_id, to_char(NOW() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY'),
    p_storage_bucket, p_storage_path, p_mime_type, p_file_size_bytes, p_sha256,
    GREATEST(1, ROUND(p_file_size_bytes / 1024.0)::INTEGER), v_uid, p_idempotency_key
  );

  IF p_solicitacao_id IS NOT NULL THEN
    UPDATE public.documento_solicitacoes
    SET status = 'enviado_analise', updated_at = NOW()
    WHERE id = p_solicitacao_id;
  END IF;

  INSERT INTO public.documento_historico (
    empresa_id, solicitacao_id, documento_id, colaborador_id, acao, ator_id, ator_nome, detalhes
  ) VALUES (
    v_emp, p_solicitacao_id, v_doc_id, p_colaborador_id, 'enviado', v_uid, v_colab.nome,
    format('Arquivo enviado (%s, %s KB).', p_mime_type, GREATEST(1, ROUND(p_file_size_bytes / 1024.0)))
  );

  INSERT INTO public.notificacoes_sistema (
    empresa_id, destinatario_role, categoria, titulo, mensagem, referencia_tipo, referencia_id, link_destino
  ) VALUES (
    v_emp, 'rh', 'documento',
    format('Documento enviado para análise — %s', v_colab.nome),
    format('%s enviou "%s" (%s).', v_colab.nome, p_titulo, p_tipo),
    'documento', v_doc_id, 'rh'
  );

  RETURN jsonb_build_object('documento_id', v_doc_id, 'duplicado', FALSE, 'status', 'pendente', 'versao', v_versao);
END;
$$;

CREATE OR REPLACE FUNCTION public.revisar_documento_colaborador_transacional(
  p_documento_id TEXT,
  p_decisao TEXT,
  p_observacao TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_emp TEXT := public.current_empresa_id();
  v_ator TEXT;
  v_doc RECORD;
  v_doc_status TEXT;
  v_sol_status TEXT;
  v_acao TEXT;
BEGIN
  IF v_uid IS NULL OR NOT public.is_rh_or_gestor() THEN
    RAISE EXCEPTION 'Apenas RH ou gestão pode revisar documentos.' USING ERRCODE = '42501';
  END IF;

  IF p_decisao NOT IN ('aprovado', 'recusado', 'atualizacao_solicitada') THEN
    RAISE EXCEPTION 'Decisão inválida: %', p_decisao USING ERRCODE = '22023';
  END IF;

  SELECT nome INTO v_ator FROM public.profiles WHERE id = v_uid LIMIT 1;
  SELECT * INTO v_doc FROM public.colaborador_documentos WHERE id = p_documento_id AND empresa_id = v_emp;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Documento não encontrado no escopo da empresa.' USING ERRCODE = 'P0002';
  END IF;

  v_doc_status := CASE WHEN p_decisao = 'aprovado' THEN 'valido' ELSE 'recusado' END;
  v_sol_status := p_decisao;
  v_acao := p_decisao;

  UPDATE public.colaborador_documentos
  SET status = v_doc_status,
      revisado_por = v_uid,
      revisado_por_nome = COALESCE(v_ator, 'RH / Gestão'),
      revisado_em = NOW(),
      observacao_revisao = p_observacao
  WHERE id = p_documento_id;

  IF v_doc.solicitacao_id IS NOT NULL THEN
    UPDATE public.documento_solicitacoes
    SET status = v_sol_status, updated_at = NOW()
    WHERE id = v_doc.solicitacao_id AND empresa_id = v_emp;
  END IF;

  INSERT INTO public.documento_historico (
    empresa_id, solicitacao_id, documento_id, colaborador_id, acao, ator_id, ator_nome, detalhes
  ) VALUES (
    v_emp, v_doc.solicitacao_id, v_doc.id, v_doc.colaborador_id, v_acao, v_uid, COALESCE(v_ator, 'RH'),
    COALESCE(p_observacao, format('Documento marcado como %s.', v_sol_status))
  );

  INSERT INTO public.notificacoes_sistema (
    empresa_id, destinatario_colaborador_id, categoria, titulo, mensagem, referencia_tipo, referencia_id, link_destino
  ) VALUES (
    v_emp, v_doc.colaborador_id, 'documento',
    CASE p_decisao
      WHEN 'aprovado' THEN format('Documento aprovado: %s', v_doc.titulo)
      WHEN 'recusado' THEN format('Documento recusado: %s', v_doc.titulo)
      ELSE format('Atualização solicitada: %s', v_doc.titulo)
    END,
    COALESCE(p_observacao, format('Status atualizado pelo RH para %s.', v_sol_status)),
    'documento', v_doc.id, 'documentos'
  );

  RETURN jsonb_build_object('documento_id', v_doc.id, 'status', v_doc_status, 'solicitacao_status', v_sol_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.criar_solicitacao_colaborador_rh(
  p_colaborador_id TEXT,
  p_tipo TEXT,
  p_assunto TEXT,
  p_descricao TEXT,
  p_idempotency_key TEXT DEFAULT NULL,
  p_anexo_bucket TEXT DEFAULT NULL,
  p_anexo_path TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_emp TEXT := public.current_empresa_id();
  v_colab RECORD;
  v_existing RECORD;
  v_id TEXT;
  v_protocolo TEXT;
BEGIN
  IF v_uid IS NULL OR v_emp IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.' USING ERRCODE = '42501';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(p_idempotency_key));
    SELECT * INTO v_existing FROM public.solicitacoes_colaborador_rh WHERE idempotency_key = p_idempotency_key LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('id', v_existing.id, 'protocolo', v_existing.protocolo, 'status', v_existing.status, 'duplicado', TRUE);
    END IF;
  END IF;

  SELECT * INTO v_colab FROM public.colaboradores WHERE id = p_colaborador_id AND empresa_id = v_emp;
  IF NOT FOUND OR (v_colab.auth_user_id IS DISTINCT FROM v_uid AND NOT public.is_rh_or_gestor()) THEN
    RAISE EXCEPTION 'Sem permissão para criar solicitação ao RH.' USING ERRCODE = '42501';
  END IF;

  v_id := 'pedrh-' || replace(gen_random_uuid()::text, '-', '');
  v_protocolo := 'RH-' || to_char(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  INSERT INTO public.solicitacoes_colaborador_rh (
    id, empresa_id, protocolo, colaborador_id, colaborador_nome,
    tipo, assunto, descricao, status, anexo_bucket, anexo_path, idempotency_key
  ) VALUES (
    v_id, v_emp, v_protocolo, v_colab.id, v_colab.nome,
    p_tipo, p_assunto, p_descricao, 'aberta', p_anexo_bucket, p_anexo_path, p_idempotency_key
  );

  INSERT INTO public.notificacoes_sistema (
    empresa_id, destinatario_role, categoria, titulo, mensagem, referencia_tipo, referencia_id, link_destino
  ) VALUES (
    v_emp, 'rh', 'sistema',
    format('Nova solicitação ao RH (%s) — %s', v_protocolo, v_colab.nome),
    format('[%s] %s: %s', p_tipo, p_assunto, LEFT(p_descricao, 160)),
    'solicitacao_rh', v_id, 'rh'
  );

  RETURN jsonb_build_object('id', v_id, 'protocolo', v_protocolo, 'status', 'aberta', 'duplicado', FALSE);
END;
$$;

CREATE OR REPLACE FUNCTION public.responder_solicitacao_colaborador_rh(
  p_solicitacao_id TEXT,
  p_status TEXT,
  p_resposta_rh TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_emp TEXT := public.current_empresa_id();
  v_ator TEXT;
  v_sol RECORD;
BEGIN
  IF v_uid IS NULL OR NOT public.is_rh_or_gestor() THEN
    RAISE EXCEPTION 'Apenas RH ou gestão pode responder solicitações.' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('em_analise', 'aguardando_colaborador', 'concluida', 'recusada') THEN
    RAISE EXCEPTION 'Status inválido para resposta do RH.' USING ERRCODE = '22023';
  END IF;

  SELECT nome INTO v_ator FROM public.profiles WHERE id = v_uid LIMIT 1;
  SELECT * INTO v_sol FROM public.solicitacoes_colaborador_rh WHERE id = p_solicitacao_id AND empresa_id = v_emp;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.solicitacoes_colaborador_rh
  SET status = p_status,
      resposta_rh = p_resposta_rh,
      responsavel_rh_id = v_uid,
      responsavel_rh_nome = COALESCE(v_ator, 'RH TurnoCerto'),
      respondida_em = NOW(),
      updated_at = NOW()
  WHERE id = p_solicitacao_id;

  INSERT INTO public.notificacoes_sistema (
    empresa_id, destinatario_colaborador_id, categoria, titulo, mensagem, referencia_tipo, referencia_id, link_destino
  ) VALUES (
    v_emp, v_sol.colaborador_id, 'sistema',
    format('Resposta do RH · Protocolo %s', v_sol.protocolo),
    COALESCE(NULLIF(TRIM(p_resposta_rh), ''), format('Sua solicitação "%s" foi atualizada para %s.', v_sol.assunto, p_status)),
    'solicitacao_rh', v_sol.id, 'documentos'
  );

  RETURN jsonb_build_object('id', v_sol.id, 'protocolo', v_sol.protocolo, 'status', p_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.criar_solicitacao_documento_rh_transacional(
  p_colaborador_id TEXT,
  p_tipo_documento TEXT,
  p_titulo TEXT,
  p_instrucoes TEXT DEFAULT NULL,
  p_prazo_entrega DATE DEFAULT NULL,
  p_obrigatorio BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_emp TEXT := public.current_empresa_id();
  v_ator TEXT;
  v_colab RECORD;
  v_id TEXT;
BEGIN
  IF v_uid IS NULL OR v_emp IS NULL OR NOT public.is_rh_or_gestor() THEN
    RAISE EXCEPTION 'Apenas RH ou gestão pode solicitar documentos.' USING ERRCODE = '42501';
  END IF;

  SELECT nome INTO v_ator FROM public.profiles WHERE id = v_uid LIMIT 1;
  SELECT * INTO v_colab FROM public.colaboradores WHERE id = p_colaborador_id AND empresa_id = v_emp;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Colaborador não encontrado no escopo da empresa.' USING ERRCODE = 'P0002';
  END IF;

  v_id := 'docreq-' || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.documento_solicitacoes (
    id, empresa_id, colaborador_id, colaborador_nome, tipo_documento, titulo,
    instrucoes, prazo_entrega, obrigatorio, status, solicitado_por, solicitado_por_nome
  ) VALUES (
    v_id, v_emp, v_colab.id, v_colab.nome, p_tipo_documento, p_titulo,
    p_instrucoes, p_prazo_entrega, COALESCE(p_obrigatorio, TRUE), 'pendente_envio', v_uid, COALESCE(v_ator, 'RH TurnoCerto')
  );

  INSERT INTO public.documento_historico (
    empresa_id, solicitacao_id, colaborador_id, acao, ator_id, ator_nome, detalhes
  ) VALUES (
    v_emp, v_id, v_colab.id, 'solicitado', v_uid, COALESCE(v_ator, 'RH TurnoCerto'),
    format('RH solicitou "%s"%s.', p_titulo, CASE WHEN p_prazo_entrega IS NOT NULL THEN format(' (prazo: %s)', p_prazo_entrega) ELSE '' END)
  );

  INSERT INTO public.notificacoes_sistema (
    empresa_id, destinatario_colaborador_id, categoria, titulo, mensagem, referencia_tipo, referencia_id, link_destino
  ) VALUES (
    v_emp, v_colab.id, 'documento',
    format('Documento solicitado pelo RH: %s', p_titulo),
    COALESCE(NULLIF(TRIM(p_instrucoes), ''), 'Envie o arquivo em PDF, JPG ou PNG na aba Documentos.'),
    'documento_solicitacao', v_id, 'documentos'
  );

  RETURN jsonb_build_object('solicitacao_id', v_id, 'status', 'pendente_envio');
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_visualizacao_documento(p_documento_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_emp TEXT := public.current_empresa_id();
  v_colab_id TEXT := public.current_colaborador_id();
  v_ator TEXT;
  v_doc RECORD;
BEGIN
  IF v_uid IS NULL OR v_emp IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_doc FROM public.colaborador_documentos WHERE id = p_documento_id AND empresa_id = v_emp;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Documento não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF v_doc.colaborador_id IS DISTINCT FROM v_colab_id AND NOT public.is_rh_or_gestor() THEN
    RAISE EXCEPTION 'Sem permissão para auditar visualização deste documento.' USING ERRCODE = '42501';
  END IF;

  SELECT nome INTO v_ator FROM public.profiles WHERE id = v_uid LIMIT 1;

  INSERT INTO public.documento_historico (
    empresa_id, solicitacao_id, documento_id, colaborador_id, acao, ator_id, ator_nome, detalhes
  ) VALUES (
    v_emp, v_doc.solicitacao_id, v_doc.id, v_doc.colaborador_id, 'visualizado', v_uid, COALESCE(v_ator, 'Usuário'),
    'URL assinada gerada (validade 120s).'
  );

  RETURN jsonb_build_object('documento_id', v_doc.id, 'registrado', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_documento_colaborador_transacional(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT, TEXT, TEXT, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revisar_documento_colaborador_transacional(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_solicitacao_colaborador_rh(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.responder_solicitacao_colaborador_rh(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_solicitacao_documento_rh_transacional(TEXT, TEXT, TEXT, TEXT, DATE, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_visualizacao_documento(TEXT) TO authenticated;

