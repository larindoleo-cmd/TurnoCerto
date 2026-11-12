-- ============================================================================
-- TurnoCerto: Migração Incremental 20261113100004
-- Escopo: Hardening Completo de Auth, Funções Canônicas de Escopo/Papel,
--         Eliminação de Policies Permissivas (USING true / anon) e
--         Isolamento Estrito por Empresa + Papel em Tabelas e Storage
-- ============================================================================

-- 1. Funções Auxiliares Seguras (substituem heurísticas email LIKE '%admin%')
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1),
    (SELECT c.role FROM public.colaboradores c WHERE c.auth_user_id = auth.uid() LIMIT 1),
    'funcionario'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_empresa_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT p.empresa_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1),
    (SELECT c.empresa_id FROM public.colaboradores c WHERE c.auth_user_id = auth.uid() LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION public.current_colaborador_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT c.id FROM public.colaboradores c WHERE c.auth_user_id = auth.uid() LIMIT 1),
    (SELECT p.colaborador_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_supervisor()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.current_user_role() IN ('admin', 'supervisor');
$$;

CREATE OR REPLACE FUNCTION public.is_rh_or_gestor()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.current_user_role() IN ('admin', 'supervisor', 'rh');
$$;

-- 2. Revogar permissões do papel anon em tabelas operacionais/sensíveis
DO $$
DECLARE
  v_tbl TEXT;
  v_tables TEXT[] := ARRAY[
    'empresas', 'empresa_info', 'condominios', 'postos', 'colaboradores', 'profiles',
    'alertas', 'ocorrencias', 'pontos', 'ponto_eventos', 'employee_passkeys',
    'solicitacoes_correcao_ponto', 'colaborador_documentos', 'documento_solicitacoes',
    'documento_historico', 'notificacoes_colaborador', 'notificacoes_sistema',
    'holerites', 'holerite_lotes', 'holerite_eventos', 'atestados',
    'solicitacoes_biometria_facial', 'historico_biometria_facial',
    'templates_biometricos_faciais', 'coberturas_programadas', 'coberturas_historico',
    'audit_logs'
  ];
BEGIN
  FOREACH v_tbl IN ARRAY v_tables LOOP
    IF to_regclass('public.' || v_tbl) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_tbl);
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', v_tbl);
    END IF;
  END LOOP;
END;
$$;

-- 3. Remover TODAS as policies antigas (incluindo USING (TRUE), anon, email LIKE '%admin%')
DO $$
DECLARE
  v_pol RECORD;
  v_tables TEXT[] := ARRAY[
    'empresas', 'empresa_info', 'condominios', 'postos', 'colaboradores', 'profiles',
    'alertas', 'ocorrencias', 'pontos', 'ponto_eventos', 'employee_passkeys',
    'solicitacoes_correcao_ponto', 'colaborador_documentos', 'documento_solicitacoes',
    'documento_historico', 'notificacoes_colaborador', 'notificacoes_sistema',
    'holerites', 'holerite_lotes', 'holerite_eventos', 'atestados',
    'solicitacoes_biometria_facial', 'historico_biometria_facial',
    'templates_biometricos_faciais', 'coberturas_programadas', 'coberturas_historico',
    'audit_logs'
  ];
BEGIN
  FOR v_pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY(v_tables)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_pol.policyname, v_pol.tablename);
  END LOOP;
END;
$$;

-- 4. Recriação Estrita de Policies por Empresa + Papel + Titularidade

-- EMPRESAS
CREATE POLICY "empresas_select_mesma_empresa" ON public.empresas
  FOR SELECT TO authenticated
  USING (id = public.current_empresa_id());
CREATE POLICY "empresas_update_admin" ON public.empresas
  FOR UPDATE TO authenticated
  USING (id = public.current_empresa_id() AND public.current_user_role() = 'admin')
  WITH CHECK (id = public.current_empresa_id() AND public.current_user_role() = 'admin');

-- EMPRESA_INFO
CREATE POLICY "empresa_info_select_auth" ON public.empresa_info
  FOR SELECT TO authenticated
  USING (public.current_empresa_id() IS NOT NULL);
CREATE POLICY "empresa_info_manage_admin" ON public.empresa_info
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'rh'))
  WITH CHECK (public.current_user_role() IN ('admin', 'rh'));

-- CONDOMINIOS & POSTOS
CREATE POLICY "condominios_select_mesma_empresa" ON public.condominios
  FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id());
CREATE POLICY "condominios_manage_gestor" ON public.condominios
  FOR ALL TO authenticated
  USING (empresa_id = public.current_empresa_id() AND public.is_admin_or_supervisor())
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.is_admin_or_supervisor());

CREATE POLICY "postos_select_mesma_empresa" ON public.postos
  FOR SELECT TO authenticated
  USING (public.current_empresa_id() IS NOT NULL);
CREATE POLICY "postos_manage_gestor" ON public.postos
  FOR ALL TO authenticated
  USING (public.is_admin_or_supervisor())
  WITH CHECK (public.is_admin_or_supervisor());

-- PROFILES
CREATE POLICY "profiles_select_self_ou_gestor" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR (empresa_id = public.current_empresa_id() AND public.is_rh_or_gestor())
  );
CREATE POLICY "profiles_update_self_basico" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR (empresa_id = public.current_empresa_id() AND public.current_user_role() = 'admin'))
  WITH CHECK (
    (id = auth.uid() AND role = public.current_user_role() AND empresa_id = public.current_empresa_id())
    OR (empresa_id = public.current_empresa_id() AND public.current_user_role() = 'admin')
  );

-- COLABORADORES
CREATE POLICY "colaboradores_select_escopo" ON public.colaboradores
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (
      id = public.current_colaborador_id()
      OR auth_user_id = auth.uid()
      OR public.is_rh_or_gestor()
    )
  );
CREATE POLICY "colaboradores_insert_gestor" ON public.colaboradores
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.is_rh_or_gestor());
CREATE POLICY "colaboradores_update_gestor" ON public.colaboradores
  FOR UPDATE TO authenticated
  USING (empresa_id = public.current_empresa_id() AND public.is_rh_or_gestor())
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.is_rh_or_gestor());
CREATE POLICY "colaboradores_delete_admin" ON public.colaboradores
  FOR DELETE TO authenticated
  USING (empresa_id = public.current_empresa_id() AND public.current_user_role() = 'admin');

-- PONTO_EVENTOS & PONTOS
CREATE POLICY "ponto_eventos_select_escopo" ON public.ponto_eventos
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (colaborador_id = public.current_colaborador_id() OR public.is_rh_or_gestor())
  );
CREATE POLICY "ponto_eventos_insert_proprio_ou_gestor" ON public.ponto_eventos
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND (colaborador_id = public.current_colaborador_id() OR public.is_admin_or_supervisor())
  );
CREATE POLICY "ponto_eventos_update_gestor" ON public.ponto_eventos
  FOR UPDATE TO authenticated
  USING (empresa_id = public.current_empresa_id() AND public.is_admin_or_supervisor())
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.is_admin_or_supervisor());

CREATE POLICY "pontos_select_escopo" ON public.pontos
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (colaborador_id = public.current_colaborador_id() OR public.is_rh_or_gestor())
  );
CREATE POLICY "pontos_manage_gestor_ou_proprio" ON public.pontos
  FOR ALL TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (colaborador_id = public.current_colaborador_id() OR public.is_rh_or_gestor())
  )
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND (colaborador_id = public.current_colaborador_id() OR public.is_rh_or_gestor())
  );

-- EMPLOYEE_PASSKEYS & BIOMETRIA FACIAL
CREATE POLICY "passkeys_select_escopo" ON public.employee_passkeys
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR public.is_admin_or_supervisor());
CREATE POLICY "passkeys_insert_proprio" ON public.employee_passkeys
  FOR INSERT TO authenticated
  WITH CHECK (auth_user_id = auth.uid() AND colaborador_id = public.current_colaborador_id());
CREATE POLICY "passkeys_update_escopo" ON public.employee_passkeys
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid() OR public.is_admin_or_supervisor())
  WITH CHECK (auth_user_id = auth.uid() OR public.is_admin_or_supervisor());

CREATE POLICY "templates_bio_escopo" ON public.templates_biometricos_faciais
  FOR ALL TO authenticated
  USING (colaborador_id = public.current_colaborador_id() OR public.is_admin_or_supervisor())
  WITH CHECK (colaborador_id = public.current_colaborador_id() OR public.is_admin_or_supervisor());

CREATE POLICY "solic_bio_select" ON public.solicitacoes_biometria_facial
  FOR SELECT TO authenticated
  USING (colaborador_id = public.current_colaborador_id() OR public.is_admin_or_supervisor());
CREATE POLICY "solic_bio_insert" ON public.solicitacoes_biometria_facial
  FOR INSERT TO authenticated
  WITH CHECK (colaborador_id = public.current_colaborador_id() OR public.is_admin_or_supervisor());
CREATE POLICY "solic_bio_update" ON public.solicitacoes_biometria_facial
  FOR UPDATE TO authenticated
  USING (colaborador_id = public.current_colaborador_id() OR public.is_admin_or_supervisor())
  WITH CHECK (colaborador_id = public.current_colaborador_id() OR public.is_admin_or_supervisor());

CREATE POLICY "hist_bio_select" ON public.historico_biometria_facial
  FOR SELECT TO authenticated
  USING (colaborador_id = public.current_colaborador_id() OR public.is_admin_or_supervisor());
CREATE POLICY "hist_bio_insert" ON public.historico_biometria_facial
  FOR INSERT TO authenticated
  WITH CHECK (colaborador_id = public.current_colaborador_id() OR public.is_admin_or_supervisor());

-- ALERTAS, OCORRENCIAS, SOLICITAÇÕES DE CORREÇÃO, ATESTADOS
CREATE POLICY "alertas_select_empresa" ON public.alertas
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (public.is_rh_or_gestor() OR colaborador_id = public.current_colaborador_id())
  );
CREATE POLICY "alertas_insert_empresa" ON public.alertas
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.current_empresa_id());
CREATE POLICY "alertas_update_gestor" ON public.alertas
  FOR UPDATE TO authenticated
  USING (empresa_id = public.current_empresa_id() AND public.is_rh_or_gestor())
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.is_rh_or_gestor());

CREATE POLICY "ocorrencias_select_empresa" ON public.ocorrencias
  FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id());
CREATE POLICY "ocorrencias_manage_empresa" ON public.ocorrencias
  FOR ALL TO authenticated
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY "solic_correcao_select" ON public.solicitacoes_correcao_ponto
  FOR SELECT TO authenticated
  USING (colaborador_id = public.current_colaborador_id() OR public.is_rh_or_gestor());
CREATE POLICY "solic_correcao_insert" ON public.solicitacoes_correcao_ponto
  FOR INSERT TO authenticated
  WITH CHECK (colaborador_id = public.current_colaborador_id());
CREATE POLICY "solic_correcao_update_rh" ON public.solicitacoes_correcao_ponto
  FOR UPDATE TO authenticated
  USING (public.is_rh_or_gestor())
  WITH CHECK (public.is_rh_or_gestor());

CREATE POLICY "atestados_select_escopo" ON public.atestados
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (colaborador_id = public.current_colaborador_id() OR public.is_rh_or_gestor())
  );
CREATE POLICY "atestados_insert_escopo" ON public.atestados
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND (colaborador_id = public.current_colaborador_id() OR public.is_rh_or_gestor())
  );
CREATE POLICY "atestados_update_rh" ON public.atestados
  FOR UPDATE TO authenticated
  USING (empresa_id = public.current_empresa_id() AND public.is_rh_or_gestor())
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.is_rh_or_gestor());

-- COBERTURAS PROGRAMADAS & HISTÓRICO
CREATE POLICY "coberturas_select_escopo" ON public.coberturas_programadas
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (colaborador_id = public.current_colaborador_id() OR public.is_rh_or_gestor())
  );
CREATE POLICY "coberturas_manage_gestor" ON public.coberturas_programadas
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.is_rh_or_gestor());
CREATE POLICY "coberturas_update_gestor_ou_aceite" ON public.coberturas_programadas
  FOR UPDATE TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (public.is_rh_or_gestor() OR colaborador_id = public.current_colaborador_id())
  )
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND (public.is_rh_or_gestor() OR colaborador_id = public.current_colaborador_id())
  );
CREATE POLICY "coberturas_hist_select" ON public.coberturas_historico
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (
      public.is_rh_or_gestor()
      OR EXISTS (
        SELECT 1 FROM public.coberturas_programadas cp
        WHERE cp.id = cobertura_id AND cp.colaborador_id = public.current_colaborador_id()
      )
    )
  );
CREATE POLICY "coberturas_hist_insert" ON public.coberturas_historico
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.current_empresa_id());

-- DOCUMENTOS RH <-> COLABORADOR
CREATE POLICY "doc_solic_select_escopo" ON public.documento_solicitacoes
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (colaborador_id = public.current_colaborador_id() OR public.is_rh_or_gestor())
  );
CREATE POLICY "doc_solic_manage_rh" ON public.documento_solicitacoes
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.is_rh_or_gestor());
CREATE POLICY "doc_solic_update_escopo" ON public.documento_solicitacoes
  FOR UPDATE TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (colaborador_id = public.current_colaborador_id() OR public.is_rh_or_gestor())
  )
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND (colaborador_id = public.current_colaborador_id() OR public.is_rh_or_gestor())
  );

CREATE POLICY "colab_docs_select_escopo" ON public.colaborador_documentos
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (colaborador_id = public.current_colaborador_id() OR public.is_rh_or_gestor())
  );
CREATE POLICY "colab_docs_insert_escopo" ON public.colaborador_documentos
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND (colaborador_id = public.current_colaborador_id() OR public.is_rh_or_gestor())
  );
CREATE POLICY "colab_docs_update_rh" ON public.colaborador_documentos
  FOR UPDATE TO authenticated
  USING (empresa_id = public.current_empresa_id() AND public.is_rh_or_gestor())
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.is_rh_or_gestor());

CREATE POLICY "doc_hist_select_escopo" ON public.documento_historico
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (colaborador_id = public.current_colaborador_id() OR public.is_rh_or_gestor())
  );
CREATE POLICY "doc_hist_insert_escopo" ON public.documento_historico
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND (colaborador_id = public.current_colaborador_id() OR public.is_rh_or_gestor())
  );

-- HOLERITES, LOTES & EVENTOS
CREATE POLICY "holerite_lotes_rh_gestor" ON public.holerite_lotes
  FOR ALL TO authenticated
  USING (empresa_id = public.current_empresa_id() AND public.is_rh_or_gestor())
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.is_rh_or_gestor());

CREATE POLICY "holerites_select_escopo" ON public.holerites
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (
      public.is_rh_or_gestor()
      OR (colaborador_id = public.current_colaborador_id() AND COALESCE(status_publicacao, 'publicado') IN ('publicado', 'retificado'))
    )
  );
CREATE POLICY "holerites_manage_rh" ON public.holerites
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.is_rh_or_gestor());
CREATE POLICY "holerites_update_rh" ON public.holerites
  FOR UPDATE TO authenticated
  USING (empresa_id = public.current_empresa_id() AND public.is_rh_or_gestor())
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.is_rh_or_gestor());

CREATE POLICY "holerite_eventos_select_escopo" ON public.holerite_eventos
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (
      public.is_rh_or_gestor()
      OR EXISTS (
        SELECT 1 FROM public.holerites h
        WHERE h.id = holerite_id AND h.colaborador_id = public.current_colaborador_id()
      )
    )
  );
CREATE POLICY "holerite_eventos_insert_escopo" ON public.holerite_eventos
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.current_empresa_id());

-- NOTIFICAÇÕES & AUDIT LOGS
CREATE POLICY "notif_colab_select_proprio" ON public.notificacoes_colaborador
  FOR SELECT TO authenticated
  USING (colaborador_id = public.current_colaborador_id() OR public.is_rh_or_gestor());
CREATE POLICY "notif_colab_update_proprio" ON public.notificacoes_colaborador
  FOR UPDATE TO authenticated
  USING (colaborador_id = public.current_colaborador_id() OR public.is_rh_or_gestor())
  WITH CHECK (colaborador_id = public.current_colaborador_id() OR public.is_rh_or_gestor());

CREATE POLICY "notif_sistema_select_escopo" ON public.notificacoes_sistema
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (
      destinatario_colaborador_id = public.current_colaborador_id()
      OR destinatario_role = public.current_user_role()
      OR public.current_user_role() = 'admin'
    )
  );
CREATE POLICY "notif_sistema_insert_empresa" ON public.notificacoes_sistema
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.current_empresa_id());
CREATE POLICY "notif_sistema_update_escopo" ON public.notificacoes_sistema
  FOR UPDATE TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (
      destinatario_colaborador_id = public.current_colaborador_id()
      OR destinatario_role = public.current_user_role()
      OR public.current_user_role() = 'admin'
    )
  )
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY "audit_logs_select_gestor" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() AND public.is_rh_or_gestor());
CREATE POLICY "audit_logs_insert_empresa" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.current_empresa_id());

-- 5. Hardening de Storage (remover policies antigas abertas e restringir por empresa/titular/RH)
DROP POLICY IF EXISTS "Permitir download publico de fotos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir upload de fotos e documentos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir leitura de documentos pelo app" ON storage.objects;
DROP POLICY IF EXISTS "docs_funcionarios_select" ON storage.objects;
DROP POLICY IF EXISTS "docs_funcionarios_insert" ON storage.objects;
DROP POLICY IF EXISTS "holerites_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "holerites_storage_insert" ON storage.objects;

-- Estrutura de caminho esperada: <empresa_id>/<colaborador_id>/<arquivo>
CREATE POLICY "docs_funcionarios_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('documentos-funcionarios', 'documentos-atestados')
    AND (storage.foldername(name))[1] = public.current_empresa_id()
    AND (
      (storage.foldername(name))[2] = public.current_colaborador_id()
      OR public.is_rh_or_gestor()
    )
  );

CREATE POLICY "docs_funcionarios_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('documentos-funcionarios', 'documentos-atestados')
    AND (storage.foldername(name))[1] = public.current_empresa_id()
    AND (
      (storage.foldername(name))[2] = public.current_colaborador_id()
      OR public.is_rh_or_gestor()
    )
  );

CREATE POLICY "holerites_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documentos-holerites'
    AND (storage.foldername(name))[1] = public.current_empresa_id()
    AND (
      (storage.foldername(name))[2] = public.current_colaborador_id()
      OR public.is_rh_or_gestor()
    )
  );

CREATE POLICY "holerites_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documentos-holerites'
    AND (storage.foldername(name))[1] = public.current_empresa_id()
    AND public.is_rh_or_gestor()
  );

CREATE POLICY "midias_operacionais_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id IN ('fotos-colaboradores', 'ocorrencias-anexos'));

CREATE POLICY "midias_operacionais_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('fotos-colaboradores', 'ocorrencias-anexos')
    AND (
      public.is_rh_or_gestor()
      OR (storage.foldername(name))[1] = public.current_empresa_id()
    )
  );
