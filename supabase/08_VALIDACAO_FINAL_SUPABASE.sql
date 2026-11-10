-- ================================================================================
-- 08 — VALIDACAO_FINAL_SUPABASE.sql
-- TurnoCerto: Script de Validação e Homologação Pós-Migração
-- Executar no SQL Editor do Supabase após aplicar os scripts 02 a 07
-- ================================================================================

-- 1. Conferência de Existência de Todas as Tabelas do Sistema
SELECT 
  t.table_name,
  CASE WHEN c.reltuples IS NOT NULL THEN c.reltuples::bigint ELSE 0 END AS total_registros,
  CASE WHEN t.table_name IS NOT NULL THEN '✅ HOMOLOGADA' ELSE '❌ AUSENTE' END AS status_validacao
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
) AS v(table_name)
LEFT JOIN information_schema.tables t 
  ON t.table_name = v.table_name AND t.table_schema = 'public'
LEFT JOIN pg_class c 
  ON c.relname = v.table_name;

-- 2. Conferência de RLS (Row Level Security) Ativo
SELECT 
  tablename, 
  rowsecurity AS rls_ativo,
  CASE WHEN rowsecurity = true THEN '✅ RLS ATIVADO' ELSE '❌ INSEGURO' END AS status_seguranca
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('condominios', 'postos', 'colaboradores', 'profiles', 'alertas', 'ocorrencias', 'holerites', 'pontos', 'atestados', 'empresa_info')
ORDER BY tablename;

-- 3. Conferência de Políticas de RLS Cadastradas
SELECT 
  tablename, 
  count(*) AS total_policies,
  string_agg(policyname, ' | ') AS politicas_ativas
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- 4. Verificação de Integridade de Chaves Estrangeiras (Sem registros órfãos)
SELECT 
  'Colaboradores sem condomínio válido' AS teste_integridade,
  count(*) AS total_divergencias
FROM public.colaboradores c
LEFT JOIN public.condominios cond ON cond.id = c.condominio_id
WHERE c.condominio_id IS NOT NULL AND cond.id IS NULL;

-- 5. Conferência de Triggers Automáticos de Atualização
SELECT 
  event_object_table AS tabela,
  trigger_name,
  action_timing,
  event_manipulation AS evento
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE 'trigger_%'
ORDER BY event_object_table;
