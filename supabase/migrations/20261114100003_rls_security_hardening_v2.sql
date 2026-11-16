-- ============================================================================
-- TurnoCerto: Migração Incremental 20261114100003
-- Escopo: Hardening Completo de RLS, Triggers de Escalação, SECURITY DEFINER,
--         Isolamento de postos/empresa_info e Privilégios de RPCs Críticas
-- ============================================================================

-- 1. Funções de identidade SEM fallback silencioso para 'funcionario'
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1),
    (SELECT c.role FROM public.colaboradores c WHERE c.auth_user_id = auth.uid() LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION public.has_valid_tenant_profile()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.current_user_role() IN ('admin', 'supervisor', 'rh', 'funcionario')
     AND public.current_empresa_id() IS NOT NULL;
$$;

-- 2. Isolamento multiempresa em postos e empresa_info
ALTER TABLE public.postos
  ADD COLUMN IF NOT EXISTS empresa_id TEXT DEFAULT 'emp-matriz-principal';

UPDATE public.postos p
SET empresa_id = c.empresa_id
FROM public.condominios c
WHERE p.id = c.id
  AND (p.empresa_id IS NULL OR p.empresa_id <> c.empresa_id);

UPDATE public.postos SET empresa_id = 'emp-matriz-principal' WHERE empresa_id IS NULL;

ALTER TABLE public.empresa_info
  ADD COLUMN IF NOT EXISTS empresa_id TEXT DEFAULT 'emp-matriz-principal';

UPDATE public.empresa_info SET empresa_id = 'emp-matriz-principal' WHERE empresa_id IS NULL;

-- 3. Proteção contra escalação de privilégio em public.profiles
CREATE OR REPLACE FUNCTION public.fn_guard_profiles_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
  IF COALESCE(v_caller_role, '') <> 'admin' THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.empresa_id IS DISTINCT FROM OLD.empresa_id
       OR NEW.colaborador_id IS DISTINCT FROM OLD.colaborador_id THEN
      RAISE EXCEPTION 'Operação não autorizada: alteração de papel, empresa ou vínculo exige administrador.' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profiles_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_guard_profiles_privilege_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_profiles_privilege_escalation();

-- 4. Guard de notificações: titular só marca como lida (sem alterar remetente/empresa/título/mensagem)
CREATE OR REPLACE FUNCTION public.fn_guard_notificacao_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF public.current_user_role() <> 'admin' THEN
    IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id
       OR NEW.destinatario_colaborador_id IS DISTINCT FROM OLD.destinatario_colaborador_id
       OR NEW.destinatario_role IS DISTINCT FROM OLD.destinatario_role
       OR NEW.categoria IS DISTINCT FROM OLD.categoria
       OR NEW.titulo IS DISTINCT FROM OLD.titulo
       OR NEW.mensagem IS DISTINCT FROM OLD.mensagem
       OR NEW.referencia_tipo IS DISTINCT FROM OLD.referencia_tipo
       OR NEW.referencia_id IS DISTINCT FROM OLD.referencia_id
       OR NEW.link_destino IS DISTINCT FROM OLD.link_destino THEN
      RAISE EXCEPTION 'Somente a leitura da notificação (lida/lida_em) pode ser alterada pelo destinatário.' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_notificacao_update ON public.notificacoes_sistema;
CREATE TRIGGER trg_guard_notificacao_update
  BEFORE UPDATE ON public.notificacoes_sistema
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_notificacao_update();

CREATE OR REPLACE FUNCTION public.marcar_notificacao_lida(p_notificacao_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT := public.current_user_role();
  v_emp TEXT := public.current_empresa_id();
  v_colab TEXT := public.current_colaborador_id();
  v_notif RECORD;
BEGIN
  IF v_uid IS NULL OR v_emp IS NULL THEN
    RAISE EXCEPTION 'Autenticação válida obrigatória.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_notif FROM public.notificacoes_sistema WHERE id = p_notificacao_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Notificação não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  IF v_notif.empresa_id <> v_emp
     OR (
       v_notif.destinatario_colaborador_id IS DISTINCT FROM v_colab
       AND v_notif.destinatario_role IS DISTINCT FROM v_role
       AND v_role <> 'admin'
     ) THEN
    RAISE EXCEPTION 'Sem permissão para marcar esta notificação.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.notificacoes_sistema
  SET lida = TRUE, lida_em = COALESCE(lida_em, NOW())
  WHERE id = p_notificacao_id;

  RETURN jsonb_build_object('id', p_notificacao_id, 'lida', TRUE);
END;
$$;

-- 5. Hardening de policies RLS permissivas identificadas em 20261113100004 e 20261110_v3
-- A) ponto_eventos: somente SELECT para authenticated; INSERT apenas via registrar_ponto_transacional / service_role
DROP POLICY IF EXISTS "ponto_eventos_insert_proprio_ou_gestor" ON public.ponto_eventos;
DROP POLICY IF EXISTS "ponto_eventos_update_gestor" ON public.ponto_eventos;
DROP POLICY IF EXISTS "Colaborador insere seu proprio ponto" ON public.ponto_eventos;
DROP POLICY IF EXISTS "ponto_eventos_insert_authenticated" ON public.ponto_eventos;

-- B) pontos: somente SELECT no cliente (escrita derivada via fn_reconstruir_espelho_ponto ou admin/rh)
DROP POLICY IF EXISTS "pontos_manage_gestor_ou_proprio" ON public.pontos;
CREATE POLICY "pontos_manage_rh_gestor" ON public.pontos
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.is_rh_or_gestor());
CREATE POLICY "pontos_update_rh_gestor" ON public.pontos
  FOR UPDATE TO authenticated
  USING (empresa_id = public.current_empresa_id() AND public.is_rh_or_gestor())
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.is_rh_or_gestor());

-- C) documento_historico, holerite_eventos, audit_logs, coberturas_historico, historico_biometria_facial:
--    remover INSERT direto de usuários autenticados comuns
DROP POLICY IF EXISTS "doc_hist_insert_escopo" ON public.documento_historico;
DROP POLICY IF EXISTS "holerite_eventos_insert_escopo" ON public.holerite_eventos;
DROP POLICY IF EXISTS "audit_logs_insert_empresa" ON public.audit_logs;
DROP POLICY IF EXISTS "coberturas_hist_insert" ON public.coberturas_historico;
DROP POLICY IF EXISTS "hist_bio_insert" ON public.historico_biometria_facial;

-- D) notificacoes_sistema: remover INSERT direto pelo cliente
DROP POLICY IF EXISTS "notif_sistema_insert_empresa" ON public.notificacoes_sistema;

-- E) documento_solicitacoes: colaborador não faz UPDATE direto na linha completa
DROP POLICY IF EXISTS "doc_solic_update_escopo" ON public.documento_solicitacoes;
CREATE POLICY "doc_solic_update_rh_gestor" ON public.documento_solicitacoes
  FOR UPDATE TO authenticated
  USING (empresa_id = public.current_empresa_id() AND public.is_rh_or_gestor())
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.is_rh_or_gestor());

-- F) ocorrencias: separar SELECT/INSERT e restringir UPDATE apenas a RH/gestor
DROP POLICY IF EXISTS "ocorrencias_manage_empresa" ON public.ocorrencias;
CREATE POLICY "ocorrencias_insert_empresa" ON public.ocorrencias
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.has_valid_tenant_profile());
CREATE POLICY "ocorrencias_update_rh_gestor" ON public.ocorrencias
  FOR UPDATE TO authenticated
  USING (empresa_id = public.current_empresa_id() AND public.is_rh_or_gestor())
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.is_rh_or_gestor());

-- G) postos: apenas leitura isolada por empresa (escrita apenas via trigger de condominios)
DROP POLICY IF EXISTS "postos_select_mesma_empresa" ON public.postos;
DROP POLICY IF EXISTS "postos_manage_gestor" ON public.postos;
REVOKE INSERT, UPDATE, DELETE ON public.postos FROM anon, authenticated;
CREATE POLICY "postos_select_mesma_empresa_v2" ON public.postos
  FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id());

-- H) empresa_info: isolamento por empresa_id
DROP POLICY IF EXISTS "empresa_info_select_auth" ON public.empresa_info;
DROP POLICY IF EXISTS "empresa_info_manage_admin" ON public.empresa_info;
CREATE POLICY "empresa_info_select_empresa" ON public.empresa_info
  FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id());
CREATE POLICY "empresa_info_manage_admin_rh" ON public.empresa_info
  FOR ALL TO authenticated
  USING (empresa_id = public.current_empresa_id() AND public.current_user_role() IN ('admin', 'rh'))
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.current_user_role() IN ('admin', 'rh'));

-- I) Biometria facial: corrigir policies antigas baseadas em auth.jwt() ->> 'role'
DROP POLICY IF EXISTS "Templates acessíveis por usuário autenticado correspondente ou gestor" ON public.templates_biometricos_faciais;
DROP POLICY IF EXISTS "Colaborador cria sua própria solicitação de biometria" ON public.solicitacoes_biometria_facial;
DROP POLICY IF EXISTS "Colaborador visualiza suas solicitações e supervisor visualiza equipe" ON public.solicitacoes_biometria_facial;
DROP POLICY IF EXISTS "Supervisor ou admin atualiza solicitação" ON public.solicitacoes_biometria_facial;
DROP POLICY IF EXISTS "Histórico biométrico visível apenas para o titular ou gestores" ON public.historico_biometria_facial;

DROP POLICY IF EXISTS "templates_bio_escopo" ON public.templates_biometricos_faciais;
CREATE POLICY "templates_bio_select_empresa" ON public.templates_biometricos_faciais
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.colaboradores c
      WHERE c.id = colaborador_id
        AND c.empresa_id = public.current_empresa_id()
        AND (c.id = public.current_colaborador_id() OR public.is_admin_or_supervisor())
    )
  );

-- 6. Hardening de TODAS as funções de trigger e SECURITY DEFINER (search_path + auth/empresa)
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_sync_condominios_geo_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND (OLD.latitude IS NULL OR NEW.latitude <> OLD.latitude) THEN
    NEW.lat := NEW.latitude;
  ELSIF NEW.lat IS NOT NULL AND (NEW.latitude IS NULL OR NEW.lat <> OLD.lat) THEN
    NEW.latitude := NEW.lat;
  END IF;

  IF NEW.longitude IS NOT NULL AND (OLD.longitude IS NULL OR NEW.longitude <> OLD.longitude) THEN
    NEW.lng := NEW.longitude;
  ELSIF NEW.lng IS NOT NULL AND (NEW.longitude IS NULL OR NEW.lng <> OLD.lng) THEN
    NEW.longitude := NEW.lng;
  END IF;

  IF NEW.raio_gps_metros IS NOT NULL THEN
    NEW.raio_tolerancia_metros := NEW.raio_gps_metros;
  ELSIF NEW.raio_tolerancia_metros IS NOT NULL THEN
    NEW.raio_gps_metros := NEW.raio_tolerancia_metros;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_sync_condominios_to_postos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.postos WHERE id = OLD.id;
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    INSERT INTO public.postos (
      id, empresa_id, nome, tipo, cnpj, endereco, bairro, cidade, supervisor, status, updated_at
    ) VALUES (
      NEW.id, NEW.empresa_id, NEW.nome, COALESCE(NEW.tipo, 'Residencial'), NEW.cnpj,
      NEW.endereco, NEW.bairro, NEW.cidade, NEW.supervisor, COALESCE(NEW.status, 'operacional'), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      empresa_id = EXCLUDED.empresa_id,
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
$$;

CREATE OR REPLACE FUNCTION public.fn_sync_condominio_para_posto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN public.fn_sync_condominios_to_postos();
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_recalcular_vagas_condominio()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_condo_id TEXT;
  v_total_alocados INTEGER;
  v_vagas_contratadas INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN v_condo_id := OLD.condominio_id; ELSE v_condo_id := NEW.condominio_id; END IF;

  IF v_condo_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_total_alocados FROM public.colaboradores WHERE condominio_id = v_condo_id AND status IN ('no_posto', 'ativo');
    SELECT COALESCE(NULLIF(vagas_contratadas, 0), 1) INTO v_vagas_contratadas FROM public.condominios WHERE id = v_condo_id;
    UPDATE public.condominios
    SET vagas_ocupadas = v_total_alocados,
        cobertura_percentual = LEAST(100.00, ROUND((v_total_alocados::numeric / COALESCE(v_vagas_contratadas, 1)::numeric) * 100, 2))
    WHERE id = v_condo_id;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.condominio_id IS NOT NULL AND OLD.condominio_id IS DISTINCT FROM NEW.condominio_id THEN
    SELECT COUNT(*) INTO v_total_alocados FROM public.colaboradores WHERE condominio_id = OLD.condominio_id AND status IN ('no_posto', 'ativo');
    SELECT COALESCE(NULLIF(vagas_contratadas, 0), 1) INTO v_vagas_contratadas FROM public.condominios WHERE id = OLD.condominio_id;
    UPDATE public.condominios
    SET vagas_ocupadas = v_total_alocados,
        cobertura_percentual = LEAST(100.00, ROUND((v_total_alocados::numeric / COALESCE(v_vagas_contratadas, 1)::numeric) * 100, 2))
    WHERE id = OLD.condominio_id;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_condominio_gps_security()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := public.current_user_role();
  v_empresa TEXT := public.current_empresa_id();
BEGIN
  IF (OLD.latitude IS NOT DISTINCT FROM NEW.latitude AND
      OLD.longitude IS NOT DISTINCT FROM NEW.longitude AND
      OLD.raio_gps_metros IS NOT DISTINCT FROM NEW.raio_gps_metros) THEN
    RETURN NEW;
  END IF;

  IF current_user IN ('postgres', 'supabase_admin') OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL OR v_role NOT IN ('admin', 'supervisor') OR v_empresa IS DISTINCT FROM NEW.empresa_id THEN
    RAISE EXCEPTION 'Acesso Negado: Apenas Admin/Supervisor da mesma empresa pode calibrar o GPS do posto.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_colab_empresa TEXT;
BEGIN
  IF auth.uid() IS NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Autenticação obrigatória.' USING ERRCODE = '42501';
  END IF;

  SELECT empresa_id INTO v_colab_empresa FROM public.colaboradores WHERE id = p_colaborador_id;
  IF auth.role() <> 'service_role' THEN
    IF v_colab_empresa IS DISTINCT FROM public.current_empresa_id()
       OR (p_colaborador_id IS DISTINCT FROM public.current_colaborador_id() AND NOT public.is_admin_or_supervisor()) THEN
      RAISE EXCEPTION 'Acesso negado ao template facial solicitado.' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN QUERY
  SELECT t.id, t.colaborador_id, t.modelo_nome, t.modelo_versao, t.dimensao, t.embedding, t.qualidade_score, t.ativado_em, t.status
  FROM public.templates_biometricos_faciais t
  WHERE t.colaborador_id = p_colaborador_id AND t.status = 'ativo'
  LIMIT 1;
END;
$$;

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
  v_colab_empresa TEXT;
BEGIN
  IF auth.uid() IS NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Autenticação obrigatória.' USING ERRCODE = '42501';
  END IF;

  SELECT empresa_id INTO v_colab_empresa FROM public.colaboradores WHERE id = p_colaborador_id;
  IF auth.role() <> 'service_role' THEN
    IF v_colab_empresa IS DISTINCT FROM public.current_empresa_id()
       OR (p_colaborador_id IS DISTINCT FROM public.current_colaborador_id() AND NOT public.is_admin_or_supervisor()) THEN
      RAISE EXCEPTION 'Sem permissão para ativar template deste colaborador.' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT * INTO v_solicitacao
  FROM public.solicitacoes_biometria_facial
  WHERE colaborador_id = p_colaborador_id
    AND token_autorizacao_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'TOKEN_INVALIDO', 'message', 'Token de autorização não encontrado ou não corresponde ao colaborador informado.');
  END IF;

  IF v_solicitacao.status = 'utilizada' THEN
    RETURN jsonb_build_object('success', false, 'code', 'TOKEN_JA_UTILIZADO', 'message', 'Esta autorização já foi consumida em um cadastro prévio.');
  END IF;

  IF v_solicitacao.status != 'aprovada' THEN
    RETURN jsonb_build_object('success', false, 'code', 'STATUS_INVALIDO', 'message', 'A solicitação de biometria não está no status aprovada.');
  END IF;

  IF v_solicitacao.validade_autorizacao IS NOT NULL AND v_solicitacao.validade_autorizacao < NOW() THEN
    UPDATE public.solicitacoes_biometria_facial SET status = 'expirada', updated_at = NOW() WHERE id = v_solicitacao.id;
    RETURN jsonb_build_object('success', false, 'code', 'TOKEN_EXPIRADO', 'message', 'A autorização expirou. Solicite nova liberação ao seu supervisor.');
  END IF;

  SELECT id INTO v_template_anterior_id FROM public.templates_biometricos_faciais WHERE colaborador_id = p_colaborador_id AND status = 'ativo' LIMIT 1;
  IF v_template_anterior_id IS NOT NULL THEN
    UPDATE public.templates_biometricos_faciais SET status = 'revogado', revogado_em = NOW() WHERE id = v_template_anterior_id;
  END IF;

  v_template_id := 'tbf-' || substr(md5(random()::text), 1, 16);
  INSERT INTO public.templates_biometricos_faciais (
    id, colaborador_id, modelo_nome, modelo_versao, dimensao, embedding, hash_template,
    qualidade_score, foto_storage_path, status, autorizado_por_supervisor_id, token_autorizacao_hash,
    origem_cadastro, criado_em, ativado_em
  ) VALUES (
    v_template_id, p_colaborador_id, p_modelo_nome, p_modelo_versao, jsonb_array_length(p_embedding),
    p_embedding, p_hash_template, p_qualidade_score, p_foto_storage_path, 'ativo',
    v_solicitacao.supervisor_id, p_token_hash, 'app_colaborador', NOW(), NOW()
  );

  UPDATE public.solicitacoes_biometria_facial
  SET status = 'utilizada', utilizado_em = NOW(), template_gerado_id = v_template_id, updated_at = NOW()
  WHERE id = v_solicitacao.id;

  UPDATE public.colaboradores
  SET status_biometria = 'ativa', template_ativo_id = v_template_id, biometria_cadastrada = TRUE,
      biometria_atualizada_em = NOW(), updated_at = NOW()
  WHERE id = p_colaborador_id;

  INSERT INTO public.historico_biometria_facial (
    colaborador_id, solicitacao_id, template_id, supervisor_id, tipo_evento, detalhes, versao_modelo
  ) VALUES (
    p_colaborador_id, v_solicitacao.id, v_template_id, v_solicitacao.supervisor_id,
    CASE WHEN v_template_anterior_id IS NOT NULL THEN 'substituido' ELSE 'cadastrado' END,
    'Template facial ' || v_template_id || ' homologado e ativado com sucesso.',
    p_modelo_nome || ' ' || p_modelo_versao
  );

  RETURN jsonb_build_object('success', true, 'message', 'Biometria facial ativada centralmente com sucesso!', 'template_id', v_template_id, 'colaborador_id', p_colaborador_id, 'status', 'ativa');
END;
$$;

-- Revoga EXECUTE legado da versão v2 não autenticada e restringe publicar_lotes_holerites_agendados()
REVOKE ALL ON FUNCTION public.consumir_autorizacao_biometria(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consumir_autorizacao_biometria(TEXT, TEXT) TO service_role;

DO $$
BEGIN
  IF to_regprocedure('public.publicar_lotes_holerites_agendados()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.publicar_lotes_holerites_agendados() FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.publicar_lotes_holerites_agendados() TO service_role;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.fn_reconstruir_espelho_ponto(TEXT, TEXT, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_reconstruir_espelho_ponto(TEXT, TEXT, DATE) TO service_role;

GRANT EXECUTE ON FUNCTION public.marcar_notificacao_lida(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.responder_aceite_cobertura(TEXT, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.retornar_colaborador_substituicao(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_ponto_transacional(TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, DOUBLE PRECISION, BOOLEAN, TEXT, TEXT, TEXT, JSONB) TO authenticated;

-- 7. Triggers server-side de notificação para eventos de ponto/alertas (dispensa INSERT direto em notificacoes_sistema)
CREATE OR REPLACE FUNCTION public.fn_notify_alerta_operacional()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.tipo IN ('tentativa_ponto_fora_posto', 'posto_sem_coordenadas') THEN
    INSERT INTO public.notificacoes_sistema (
      empresa_id, destinatario_role, categoria, titulo, mensagem, referencia_tipo, referencia_id, link_destino
    ) VALUES
      (NEW.empresa_id, 'supervisor',
       CASE WHEN NEW.tipo = 'posto_sem_coordenadas' THEN 'alerta_config' ELSE 'ponto' END,
       NEW.titulo, NEW.descricao, 'alerta', NEW.id, 'operacao'),
      (NEW.empresa_id, 'admin',
       CASE WHEN NEW.tipo = 'posto_sem_coordenadas' THEN 'alerta_config' ELSE 'ponto' END,
       NEW.titulo, NEW.descricao, 'alerta', NEW.id, 'operacao');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_alerta_operacional ON public.alertas;
CREATE TRIGGER trg_notify_alerta_operacional
  AFTER INSERT ON public.alertas
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_alerta_operacional();

CREATE OR REPLACE FUNCTION public.fn_notify_solicitacao_correcao_ponto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.notificacoes_sistema (
    empresa_id, destinatario_role, categoria, titulo, mensagem, referencia_tipo, referencia_id, link_destino
  ) VALUES (
    NEW.empresa_id, 'rh', 'ponto',
    format('Solicitação de ajuste de ponto — %s', NEW.colaborador_nome),
    format('Data %s (%s): %s', NEW.data_ponto, NEW.tipo_correcao, LEFT(NEW.justificativa, 160)),
    'solicitacao_correcao_ponto', NEW.id, 'rh'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_solicitacao_correcao_ponto ON public.solicitacoes_correcao_ponto;
CREATE TRIGGER trg_notify_solicitacao_correcao_ponto
  AFTER INSERT ON public.solicitacoes_correcao_ponto
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_solicitacao_correcao_ponto();

