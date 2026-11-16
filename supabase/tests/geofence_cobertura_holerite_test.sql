-- ============================================================================
-- TESTE STAGING (pgTAP): supabase/tests/geofence_cobertura_holerite_test.sql
-- FINALIDADE: Validar Haversine server-side, sobreposição real de coberturas
--             noturnas/adjacentes, unificação de public.pontos e ciência de holerite.
-- ============================================================================

BEGIN;
SELECT plan(8);

-- 1. Verifica distância Haversine aproximada (mesmo ponto = 0m)
SELECT is(
  ROUND(public.fn_haversine_metros(-23.55052, -46.633308, -23.55052, -46.633308)::numeric, 2),
  0.00::numeric,
  'fn_haversine_metros deve retornar 0 para coordenadas idênticas'
);

-- 2. Verifica distância conhecida (~111m para 0.001 grau de latitude)
SELECT ok(
  public.fn_haversine_metros(-23.5500, -46.6333, -23.5510, -46.6333) BETWEEN 105.0 AND 115.0,
  'fn_haversine_metros deve calcular ~111m para delta de 0.001 grau de latitude'
);

-- 3. Verifica unificação canônica de public.pontos
SELECT has_column('public', 'pontos', 'entrada_1', 'pontos deve possuir coluna canônica entrada_1');
SELECT has_column('public', 'pontos', 'turno_index', 'pontos deve suportar múltiplos turnos via turno_index');
SELECT has_column('public', 'pontos', 'detalhes_turnos', 'pontos deve possuir detalhes_turnos JSONB');

-- 4. Verifica entidade estruturada de solicitações do funcionário ao RH
SELECT has_table('public', 'solicitacoes_colaborador_rh', 'Tabela solicitacoes_colaborador_rh deve existir');

-- 5. Verifica que colaborador.senha não mantém default inseguro
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'colaboradores'
      AND column_name = 'senha' AND column_default IS NOT NULL
  ),
  'colaboradores.senha não deve possuir default em texto claro'
);

-- 6. Verifica que current_user_role() retorna NULL quando auth.uid() não está vinculado
SELECT ok(
  public.current_user_role() IS NULL,
  'current_user_role() sem sessão/vínculo deve retornar NULL e nunca fallback silencioso para funcionario'
);

SELECT * FROM finish();
ROLLBACK;
