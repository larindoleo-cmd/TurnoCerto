-- ============================================================================
-- SCRIPT: 11_DIAGNOSTICO_E_VERIFICACAO_SCHEMA.sql
-- PROJETO: TurnoCerto
-- FINALIDADE: Consulta abrangente de diagnóstico pós-migration e auditoria de integridade
-- ============================================================================

-- 1. AUDITORIA DE TABELAS CRÍTICAS E TOTAL DE REGISTROS
SELECT
  t.table_name,
  (xpath('/row/cnt/text()', xml_count))[1]::text::int AS total_registros
FROM (
  SELECT
    table_name,
    query_to_xml(format('SELECT count(*) AS cnt FROM public.%I', table_name), false, true, '') AS xml_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'empresas',
      'condominios',
      'postos',
      'colaboradores',
      'alertas',
      'ocorrencias',
      'pontos',
      'ponto_eventos',
      'holerites',
      'atestados',
      'templates_biometricos_faciais',
      'solicitacoes_biometria_facial'
    )
) t
ORDER BY t.table_name;

-- 2. VERIFICAÇÃO DA CONSTRAINT REAL DE metodo_autenticacao EM ponto_eventos
SELECT
  c.conname AS constraint_name,
  t.relname AS tabela,
  pg_get_constraintdef(c.oid) AS definicao_constraint,
  CASE
    WHEN pg_get_constraintdef(c.oid) LIKE '%biometria_facial%'
     AND pg_get_constraintdef(c.oid) LIKE '%biometria_passkey%'
     AND pg_get_constraintdef(c.oid) LIKE '%autenticador_dispositivo%'
     AND pg_get_constraintdef(c.oid) LIKE '%excecao_autorizada%'
    THEN '✅ CANÔNICA E COMPLETA'
    ELSE '❌ INCOMPLETA OU DESATUALIZADA'
  END AS status_validacao
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_namespace n ON t.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND t.relname = 'ponto_eventos'
  AND c.contype = 'c'
  AND pg_get_constraintdef(c.oid) LIKE '%metodo_autenticacao%';

-- 3. AUDITORIA DE COORDENADAS E COLUNAS GEOGRÁFICAS EM condominios
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default,
  CASE
    WHEN column_name IN ('latitude', 'longitude') AND column_default IS NOT NULL THEN '⚠️ DEFAULT RÍGIDO DETECTADO'
    WHEN column_name IN ('latitude', 'longitude') AND is_nullable = 'YES' THEN '✅ CANÔNICO (NULLABLE SEM FORÇAR SP)'
    WHEN column_name = 'raio_gps_metros' THEN '✅ RAIO CANÔNICO'
    WHEN column_name IN ('lat', 'lng', 'raio_tolerancia_metros') THEN 'ℹ️ COLUNA DE RETROCOMPATIBILIDADE'
    ELSE 'OK'
  END AS status_coluna
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'condominios'
  AND column_name IN ('latitude', 'longitude', 'raio_gps_metros', 'lat', 'lng', 'raio_tolerancia_metros')
ORDER BY column_name;

-- 4. VERIFICAÇÃO DE SINCRONIZAÇÃO ENTRE condominios E postos
SELECT
  (SELECT count(*) FROM public.condominios) AS total_condominios_autoritativos,
  (SELECT count(*) FROM public.postos) AS total_postos_espelho,
  CASE
    WHEN (SELECT count(*) FROM public.condominios) = (SELECT count(*) FROM public.postos)
    THEN '✅ SINCRONIZADOS (100% PARIDADE)'
    ELSE '❌ DIVERGÊNCIA DE REGISTROS ENTRE COND E POSTOS'
  END AS status_sincronizacao;

-- 5. AUDITORIA DE ISOLAMENTO MULTIEMPRESA E BACKFILL
SELECT
  'condominios' AS tabela,
  COUNT(*) FILTER (WHERE empresa_id IS NULL) AS nulos_empresa,
  COUNT(DISTINCT empresa_id) AS empresas_distintas
FROM public.condominios
UNION ALL
SELECT
  'colaboradores',
  COUNT(*) FILTER (WHERE empresa_id IS NULL),
  COUNT(DISTINCT empresa_id)
FROM public.colaboradores
UNION ALL
SELECT
  'alertas',
  COUNT(*) FILTER (WHERE empresa_id IS NULL),
  COUNT(DISTINCT empresa_id)
FROM public.alertas
UNION ALL
SELECT
  'ocorrencias',
  COUNT(*) FILTER (WHERE empresa_id IS NULL),
  COUNT(DISTINCT empresa_id)
FROM public.ocorrencias
UNION ALL
SELECT
  'ponto_eventos',
  COUNT(*) FILTER (WHERE empresa_id IS NULL),
  COUNT(DISTINCT empresa_id)
FROM public.ponto_eventos
UNION ALL
SELECT
  'holerites',
  COUNT(*) FILTER (WHERE empresa_id IS NULL),
  COUNT(DISTINCT empresa_id)
FROM public.holerites;

-- 6. AUDITORIA DE INTEGRIDADE REFERENCIAL E VERIFICAÇÃO DE ÓRFÃOS
SELECT
  'colaboradores sem condominio válido' AS teste_orfaos,
  count(*) AS quantidade_orfaos
FROM public.colaboradores c
WHERE c.condominio_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.condominios cond WHERE cond.id = c.condominio_id)
UNION ALL
SELECT
  'alertas sem posto/condominio válido',
  count(*)
FROM public.alertas a
WHERE NOT EXISTS (SELECT 1 FROM public.condominios cond WHERE cond.id = a.posto_id)
UNION ALL
SELECT
  'ocorrencias sem posto/condominio válido',
  count(*)
FROM public.ocorrencias o
WHERE NOT EXISTS (SELECT 1 FROM public.condominios cond WHERE cond.id = o.posto_id)
UNION ALL
SELECT
  'ponto_eventos sem colaborador válido',
  count(*)
FROM public.ponto_eventos pe
WHERE NOT EXISTS (SELECT 1 FROM public.colaboradores col WHERE col.id = pe.colaborador_id)
UNION ALL
SELECT
  'holerites sem colaborador válido',
  count(*)
FROM public.holerites h
WHERE NOT EXISTS (SELECT 1 FROM public.colaboradores col WHERE col.id = h.colaborador_id);

-- 7. AUDITORIA DE CAMPOS UNIFICADOS DE holerites
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'holerites'
  AND column_name IN (
    'salario_base',
    'horas_extras_50',
    'valor_horas_extras',
    'plantoes_ft',
    'valor_ft',
    'desconto_inss',
    'inss',
    'desconto_vt',
    'vale_transporte',
    'desconto_vr',
    'vale_refeicao',
    'liquido_receber',
    'salario_liquido',
    'status_envio',
    'status'
  )
ORDER BY column_name;

-- 8. AUDITORIA DE TRIGGERS ATIVOS
SELECT
  event_object_table AS tabela,
  trigger_name,
  action_timing AS timing,
  event_manipulation AS evento,
  action_statement AS acao
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table IN ('condominios', 'ponto_eventos', 'colaboradores')
ORDER BY event_object_table, trigger_name;
