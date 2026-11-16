-- ============================================================================
-- TESTE STAGING (pgTAP): supabase/tests/rls_multitenant_ponto_test.sql
-- FINALIDADE: Validar isolamento multiempresa, bloqueio de escrita direta em
--             tabelas imutáveis/auditoria, proteção de roles e privilégios de RPCs.
-- USO (Staging): supabase test db  OU  psql -f supabase/tests/rls_multitenant_ponto_test.sql
-- ============================================================================

BEGIN;
SELECT plan(10);

-- 1. Papel anon não possui privilégio em tabelas operacionais sensíveis
SELECT ok(
  NOT has_table_privilege('anon', 'public.colaboradores', 'SELECT'),
  'Anon não deve ler colaboradores'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.holerites', 'SELECT'),
  'Anon não deve ler holerites'
);

-- 2. Authenticated NÃO deve conseguir inserir diretamente em ponto_eventos, auditoria ou notificações
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ponto_eventos' AND cmd IN ('INSERT', 'ALL')
  ),
  'ponto_eventos não deve ter policy de INSERT direto para authenticated (somente RPC)'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'audit_logs' AND cmd IN ('INSERT', 'ALL')
  ),
  'audit_logs não deve aceitar INSERT direto pelo cliente'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notificacoes_sistema' AND cmd IN ('INSERT', 'ALL')
  ),
  'notificacoes_sistema não deve aceitar INSERT direto pelo cliente'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'documento_historico' AND cmd IN ('INSERT', 'ALL')
  ),
  'documento_historico não deve aceitar INSERT direto pelo cliente'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'holerite_eventos' AND cmd IN ('INSERT', 'ALL')
  ),
  'holerite_eventos não deve aceitar INSERT direto pelo cliente'
);

-- 3. publicar_lotes_holerites_agendados() executável somente por service_role
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.publicar_lotes_holerites_agendados()', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.publicar_lotes_holerites_agendados()', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.publicar_lotes_holerites_agendados()', 'EXECUTE'),
  'publicar_lotes_holerites_agendados() deve ser exclusiva para service_role'
);

-- 4. Trigger anti-escalação em profiles e guard em notificacoes_sistema
SELECT has_trigger(
  'public', 'profiles', 'trg_guard_profiles_privilege_escalation',
  'Trigger anti-escalação de role/empresa_id/colaborador_id deve existir em profiles'
);

-- 5. Buckets privados não podem ficar públicos
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id IN ('documentos-funcionarios', 'documentos-atestados', 'documentos-holerites', 'fotos-colaboradores', 'ocorrencias-anexos')
      AND public = TRUE
  ),
  'Todos os buckets de documentos, holerites, fotos de colaboradores e anexos devem ter public = FALSE'
);

SELECT * FROM finish();
ROLLBACK;
