-- ================================================================================
-- TurnoCerto: Migração 01 - Diagnóstico Inicial Estrutural e de Dados
-- Arquivo: supabase/migrations/20261108100001_diagnostico_inicial.sql
-- Tipo: Diagnóstico / Leitura (Não-Destrutivo)
-- ================================================================================

-- 1. Inspeciona as tabelas existentes no schema public
SELECT 
  t.table_name,
  (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t.table_name) AS total_colunas,
  (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = t.table_name) AS rls_ativo
FROM information_schema.tables t
WHERE t.table_schema = 'public'
ORDER BY t.table_name;

-- 2. Inspeciona o tipo da chave primária das tabelas core para validação de compatibilidade
SELECT 
  table_name, 
  column_name, 
  data_type, 
  udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'id'
  AND table_name IN ('condominios', 'colaboradores', 'profiles', 'postos');

-- 3. Lista todas as constraints de integridade referencial existentes
SELECT
  tc.table_name, 
  kcu.column_name, 
  tc.constraint_name, 
  tc.constraint_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;
