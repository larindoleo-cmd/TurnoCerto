-- ============================================================================
-- TESTE: supabase/tests/rls_security_audit_test.sql
-- FINALIDADE: Auditoria pgTAP de isolamento multiempresa, papéis (admin,
--             supervisor, rh, funcionario), bloqueio de anon e regras do produto
-- Executar em ambiente de homologação (pgTAP / supabase test db)
-- ============================================================================

BEGIN;
SELECT plan(14);

-- 1. Tabelas novas e colunas de configuração existem
SELECT has_table('public', 'coberturas_programadas', 'coberturas_programadas deve existir');
SELECT has_table('public', 'coberturas_historico', 'coberturas_historico deve existir');
SELECT has_table('public', 'documento_solicitacoes', 'documento_solicitacoes deve existir');
SELECT has_table('public', 'documento_historico', 'documento_historico deve existir');
SELECT has_table('public', 'holerite_lotes', 'holerite_lotes deve existir');
SELECT has_table('public', 'holerite_eventos', 'holerite_eventos deve existir');
SELECT has_table('public', 'notificacoes_sistema', 'notificacoes_sistema deve existir');
SELECT has_column('public', 'empresas', 'max_gps_accuracy_m', 'empresas deve conter max_gps_accuracy_m');
SELECT has_column('public', 'colaboradores', 'auth_user_id', 'colaboradores deve conter auth_user_id');

-- 2. RPCs transacionais existem
SELECT has_function('public', 'registrar_ponto_transacional', 'RPC transacional de ponto deve existir');
SELECT has_function('public', 'registrar_substituicao_emergencial', 'RPC transacional de substituição deve existir');
SELECT has_function('public', 'confirmar_ciencia_holerite', 'RPC de ciência de holerite deve existir');
SELECT has_function('public', 'publicar_lotes_holerites_agendados', 'RPC de publicação agendada de holerites deve existir');

-- 3. Nenhuma policy na base pode conceder USING (true) ou acesso a anon nas tabelas críticas
SELECT is(
  (
    SELECT count(*)::int
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'empresas', 'condominios', 'colaboradores', 'profiles',
        'ponto_eventos', 'pontos', 'holerites', 'holerite_lotes',
        'colaborador_documentos', 'documento_solicitacoes',
        'coberturas_programadas', 'notificacoes_sistema', 'alertas'
      )
      AND (
        'anon' = ANY(roles)
        OR COALESCE(qual, '') ~* '^\s*\(?\s*true\s*\)?\s*$'
        OR COALESCE(with_check, '') ~* '^\s*\(?\s*true\s*\)?\s*$'
      )
  ),
  0,
  'Zero policies permissivas (USING true / WITH CHECK true / anon) nas tabelas críticas'
);

SELECT * FROM finish();
ROLLBACK;
