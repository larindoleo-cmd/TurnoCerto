-- ============================================================================
-- TESTE: supabase/tests/schema_canonico_test.sql
-- FINALIDADE: Validação automatizada de regras e constraints do schema canônico
-- ============================================================================

BEGIN;
SELECT plan(10);

-- Teste 1: Tabela empresas existe
SELECT has_table('public', 'empresas', 'Tabela public.empresas deve existir');

-- Teste 2: Tabela condominios é autoritativa e possui colunas canônicas
SELECT columns_are(
  'public',
  'condominios',
  ARRAY[
    'id', 'nome', 'tipo', 'cnpj', 'contrato_numero', 'endereco', 'bairro',
    'cidade', 'supervisor', 'telefone_supervisor', 'vagas_contratadas',
    'vagas_ocupadas', 'status', 'motivo_atencao', 'tipo_escala_padrao',
    'cobertura_percentual', 'contato_sindico', 'telefone_sindico',
    'instrucoes_guarita', 'foto_url', 'latitude', 'longitude',
    'raio_gps_metros', 'ativo', 'created_at', 'updated_at', 'empresa_id',
    'lat', 'lng', 'raio_tolerancia_metros', 'cep', 'icone', 'cor',
    'metodo_calibracao_gps', 'calibrado_em', 'calibrado_precisao_m'
  ],
  'Tabela condominios deve conter colunas canônicas e de retrocompatibilidade'
);

-- Teste 3: Coordenadas latitude/longitude em condominios são anuláveis (sem forçar SP)
SELECT col_is_null(
  'public', 'condominios', 'latitude',
  'Coluna latitude deve permitir NULL quando o posto ainda não foi calibrado'
);

SELECT col_is_null(
  'public', 'condominios', 'longitude',
  'Coluna longitude deve permitir NULL quando o posto ainda não foi calibrado'
);

-- Teste 4: Constraint de metodo_autenticacao em ponto_eventos
SELECT has_check(
  'public', 'ponto_eventos', 'chk_ponto_eventos_metodo_autenticacao',
  'ponto_eventos deve conter constraint chk_ponto_eventos_metodo_autenticacao'
);

-- Teste 5: Trigger trg_sync_condominios_to_postos existe
SELECT has_trigger(
  'public', 'condominios', 'trg_sync_condominios_to_postos',
  'Trigger de sincronização condominios -> postos deve estar ativo'
);

-- Teste 6: Trigger trg_sync_condominios_geo_columns existe
SELECT has_trigger(
  'public', 'condominios', 'trg_sync_condominios_geo_columns',
  'Trigger de sincronização geográfica lat/lng <-> latitude/longitude deve estar ativo'
);

-- Teste 7: Holerites possui tanto liquido_receber quanto salario_liquido
SELECT has_column(
  'public', 'holerites', 'liquido_receber',
  'Tabela holerites deve conter a coluna canônica liquido_receber'
);

SELECT has_column(
  'public', 'holerites', 'salario_liquido',
  'Tabela holerites deve conter a coluna de compatibilidade salario_liquido'
);

-- Teste 8: FK de empresa_id em colaboradores existe
SELECT has_fk(
  'public', 'colaboradores',
  'Tabela colaboradores deve ter Foreign Key para empresas'
);

SELECT * FROM finish();
ROLLBACK;
