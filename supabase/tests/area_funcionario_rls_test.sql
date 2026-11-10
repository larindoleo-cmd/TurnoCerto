-- ================================================================================
-- TurnoCerto: Testes de Validação das Políticas de Segurança RLS
-- Arquivo: supabase/tests/area_funcionario_rls_test.sql
-- Objetivo: Provar formalmente cenários de isolamento, integridade e restrições
-- ================================================================================

BEGIN;
SELECT plan(8);

-- 1. Teste: Tabela ponto_eventos possui RLS ativo
SELECT row_eq(
  $$ SELECT relrowsecurity FROM pg_class WHERE relname = 'ponto_eventos' $$,
  ROW(true),
  'ponto_eventos deve ter Row Level Security habilitado'
);

-- 2. Teste: Tabela employee_passkeys possui RLS ativo
SELECT row_eq(
  $$ SELECT relrowsecurity FROM pg_class WHERE relname = 'employee_passkeys' $$,
  ROW(true),
  'employee_passkeys deve ter Row Level Security habilitado'
);

-- 3. Teste: Tabela holerites possui RLS ativo
SELECT row_eq(
  $$ SELECT relrowsecurity FROM pg_class WHERE relname = 'holerites' $$,
  ROW(true),
  'holerites deve ter Row Level Security habilitado'
);

-- 4. Teste: Tabela colaboradores possui RLS ativo
SELECT row_eq(
  $$ SELECT relrowsecurity FROM pg_class WHERE relname = 'colaboradores' $$,
  ROW(true),
  'colaboradores deve ter Row Level Security habilitado'
);

-- 5. Teste: Função de identificação do colaborador atual existe
SELECT has_function(
  'public',
  'current_colaborador_id',
  'Função current_colaborador_id() deve estar definida para vincular auth.uid ao colaborador'
);

-- 6. Teste: Função de identificação de perfis administrativos existe
SELECT has_function(
  'public',
  'is_admin_or_supervisor',
  'Função is_admin_or_supervisor() deve estar definida para controle RBAC'
);

-- 7. Teste: Verificação de imutabilidade de ponto_eventos (sem política de delete para funcionário)
SELECT is_empty(
  $$ SELECT policyname FROM pg_policies WHERE tablename = 'ponto_eventos' AND cmd = 'DELETE' AND 'authenticated' = ANY(roles) AND NOT qual LIKE '%is_admin_or_supervisor%' $$,
  'Funcionários não devem possuir permissão de DELETE em ponto_eventos'
);

-- 8. Teste: Verificação de isolamento de holerites para funcionário
SELECT isnt_empty(
  $$ SELECT policyname FROM pg_policies WHERE tablename = 'holerites' AND cmd = 'SELECT' AND qual LIKE '%current_colaborador_id%' $$,
  'Holerites devem possuir política restritiva vinculada a current_colaborador_id()'
);

SELECT * FROM finish();
ROLLBACK;
