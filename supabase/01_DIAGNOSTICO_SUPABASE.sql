-- ================================================================================
-- 01 — DIAGNOSTICO_SUPABASE.sql
-- TurnoCerto: Diagnóstico de Estrutura, Integridade, RLS e Metadados do Banco Supabase
-- Somente consultas de leitura (SELECT). Não altera dados nem esquemas.
-- Executar no SQL Editor do Supabase (PostgreSQL)
-- ================================================================================

-- 1. Identificar todas as tabelas públicas e suas contagens estimadas de linhas
SELECT 
  t.table_name,
  pg_size_pretty(pg_total_relation_size('"' || t.table_schema || '"."' || t.table_name || '"')) AS tamanho_total,
  reltuples::bigint AS estimativa_linhas
FROM information_schema.tables t
LEFT JOIN pg_class c ON c.relname = t.table_name
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name;

-- 2. Listagem completa de colunas, tipos de dados e nulabilidade de cada tabela
SELECT 
  table_name,
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- 3. Identificar Chaves Primárias (PK) e Chaves Estrangeiras (FK) existentes
SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;

-- 4. Verificar se Row Level Security (RLS) está ativado em cada tabela
SELECT 
  schemaname,
  tablename,
  rowsecurity AS rls_ativado,
  forcerowsecurity AS rls_forcado
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 5. Listar todas as Políticas de Segurança (RLS Policies) existentes
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 6. Índices existentes no esquema público
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 7. Triggers ativos no esquema público
SELECT 
  event_object_table AS table_name,
  trigger_name,
  event_manipulation AS event,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 8. Diagnóstico de Tabelas Críticas do TurnoCerto (Existência e Integridade)
SELECT 
  table_target,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = table_target
    ) THEN 'PRESENTE NO BANCO' 
    ELSE 'AUSENTE (REQUER MIGRAÇÃO 02)' 
  END AS status_tabela
FROM (
  VALUES 
    ('condominios'),
    ('postos'),
    ('colaboradores'),
    ('profiles'),
    ('alertas'),
    ('ocorrencias'),
    ('holerites'),
    ('pontos'),
    ('atestados'),
    ('empresa_info')
) AS targets(table_target);

-- 9. Verificar tipos da coluna 'id' em condominios e postos (UUID vs TEXT)
SELECT 
  table_name, 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name IN ('condominios', 'postos', 'colaboradores', 'profiles') 
  AND column_name IN ('id', 'condominio_id');
