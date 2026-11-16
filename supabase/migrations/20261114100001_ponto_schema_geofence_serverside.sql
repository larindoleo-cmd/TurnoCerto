-- ============================================================================
-- TurnoCerto: Migração Incremental 20261114100001
-- Escopo:
--   1. Remoção de senha em texto claro em public.colaboradores (Fase 1)
--   2. Unificação canônica de public.pontos (entrada_1..saida_2, DATE, multi-turno)
--   3. Event Sourcing de ponto_eventos -> reconstrução idempotente de pontos
--   4. Geofence 100% server-side (Haversine, margem de precisão GPS, max_gps_accuracy_m,
--      alerta de posto não calibrado, controle estrito de excecao_autorizada,
--      matching exato de coberturas em America/Sao_Paulo e idempotência concorrente)
-- ============================================================================

-- 1. Limpeza de default e conteúdo legado de senha em texto claro
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'colaboradores' AND column_name = 'senha'
  ) THEN
    ALTER TABLE public.colaboradores ALTER COLUMN senha DROP DEFAULT;
    UPDATE public.colaboradores SET senha = NULL WHERE senha IS NOT NULL;
  END IF;
END $$;

-- 2. Metadados de auditoria de geofence e revisão offline em ponto_eventos
ALTER TABLE public.ponto_eventos
  ADD COLUMN IF NOT EXISTS regra_geofence_versao TEXT DEFAULT 'haversine-v2-margin',
  ADD COLUMN IF NOT EXISTS regra_raio_m INTEGER,
  ADD COLUMN IF NOT EXISTS precisao_max_empresa_m INTEGER,
  ADD COLUMN IF NOT EXISTS revisao_pendente BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS ultimo_ponto TEXT,
  ADD COLUMN IF NOT EXISTS motivo_status TEXT;

-- 3. Unificação canônica da tabela public.pontos (preservando entrada_1..saida_2 e data DATE)
ALTER TABLE public.pontos
  ADD COLUMN IF NOT EXISTS entrada_1 TEXT DEFAULT '--:--',
  ADD COLUMN IF NOT EXISTS saida_1 TEXT DEFAULT '--:--',
  ADD COLUMN IF NOT EXISTS entrada_2 TEXT DEFAULT '--:--',
  ADD COLUMN IF NOT EXISTS saida_2 TEXT DEFAULT '--:--',
  ADD COLUMN IF NOT EXISTS turno_index INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS detalhes_turnos JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill seguro caso ambiente remoto possua colunas sem sublinhado (entrada1..saida2) de versão anterior
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='pontos' AND column_name='entrada1') THEN
    UPDATE public.pontos
    SET
      entrada_1 = COALESCE(NULLIF(entrada_1, '--:--'), entrada1, '--:--'),
      saida_1   = COALESCE(NULLIF(saida_1, '--:--'), saida1, '--:--'),
      entrada_2 = COALESCE(NULLIF(entrada_2, '--:--'), entrada2, '--:--'),
      saida_2   = COALESCE(NULLIF(saida_2, '--:--'), saida2, '--:--');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pontos_empresa_colab_data_turno
  ON public.pontos(empresa_id, colaborador_id, data, turno_index);

-- 4. Função de cálculo Haversine em metros (independe de extensão PostGIS externa)
CREATE OR REPLACE FUNCTION public.fn_haversine_metros(
  p_lat1 DOUBLE PRECISION,
  p_lon1 DOUBLE PRECISION,
  p_lat2 DOUBLE PRECISION,
  p_lon2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT 2.0 * 6371000.0 * ASIN(
    LEAST(1.0, SQRT(
      POWER(SIN(RADIANS(p_lat2 - p_lat1) / 2.0), 2) +
      COS(RADIANS(p_lat1)) * COS(RADIANS(p_lat2)) *
      POWER(SIN(RADIANS(p_lon2 - p_lon1) / 2.0), 2)
    ))
  );
$$;

-- 5. Função auxiliar determinística: verifica cobertura/extra vigente na data/hora exata (America/Sao_Paulo)
CREATE OR REPLACE FUNCTION public.fn_buscar_cobertura_vigente(
  p_empresa_id TEXT,
  p_colaborador_id TEXT,
  p_posto_id TEXT,
  p_momento TIMESTAMPTZ,
  p_exige_aceite BOOLEAN DEFAULT FALSE
)
RETURNS public.coberturas_programadas
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_local_ts TIMESTAMP := p_momento AT TIME ZONE 'America/Sao_Paulo';
  v_cov public.coberturas_programadas;
  v_dia DATE;
  v_ini TIMESTAMP;
  v_fim TIMESTAMP;
BEGIN
  FOR v_cov IN
    SELECT *
    FROM public.coberturas_programadas cp
    WHERE cp.empresa_id = p_empresa_id
      AND cp.colaborador_id = p_colaborador_id
      AND cp.posto_cobertura_id = p_posto_id
      AND cp.status IN ('aprovada', 'em_andamento')
      AND (NOT p_exige_aceite OR COALESCE(cp.aceite_colaborador, FALSE) = TRUE)
      AND v_local_ts::date BETWEEN cp.data_inicio AND (cp.data_fim + 1)
    ORDER BY cp.created_at DESC
  LOOP
    v_dia := v_cov.data_inicio;
    WHILE v_dia <= v_cov.data_fim LOOP
      v_ini := (v_dia::timestamp + v_cov.hora_inicio);
      IF v_cov.hora_fim <= v_cov.hora_inicio THEN
        v_fim := ((v_dia + 1)::timestamp + v_cov.hora_fim);
      ELSE
        v_fim := (v_dia::timestamp + v_cov.hora_fim);
      END IF;

      -- Tolera 30 minutos antes do início e 30 minutos após o término para batida de entrada/saída
      IF v_local_ts >= (v_ini - INTERVAL '30 minutes') AND v_local_ts <= (v_fim + INTERVAL '30 minutes') THEN
        RETURN v_cov;
      END IF;
      v_dia := v_dia + 1;
    END LOOP;
  END LOOP;

  RETURN NULL;
END;
$$;

-- 6. Projeção derivada (Event Sourcing): reconstrói public.pontos a partir de public.ponto_eventos
CREATE OR REPLACE FUNCTION public.fn_reconstruir_espelho_ponto(
  p_empresa_id TEXT,
  p_colaborador_id TEXT,
  p_data DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_colab_nome TEXT;
  v_ev RECORD;
  v_turno INTEGER := 1;
  v_e1 TEXT := '--:--';
  v_s1 TEXT := '--:--';
  v_e2 TEXT := '--:--';
  v_s2 TEXT := '--:--';
  v_last_gps TEXT := '';
  v_status TEXT := 'Regular';
  v_detalhes JSONB := '[]'::jsonb;
  v_count INTEGER := 0;
  v_hora TEXT;
BEGIN
  SELECT nome INTO v_colab_nome FROM public.colaboradores WHERE id = p_colaborador_id;

  FOR v_ev IN
    SELECT *
    FROM public.ponto_eventos pe
    WHERE pe.empresa_id = p_empresa_id
      AND pe.colaborador_id = p_colaborador_id
      AND (pe.server_timestamp AT TIME ZONE 'America/Sao_Paulo')::date = p_data
    ORDER BY pe.server_timestamp ASC, pe.id ASC
  LOOP
    v_count := v_count + 1;
    v_hora := to_char(v_ev.server_timestamp AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI');
    v_last_gps := format('%s (±%sm)', COALESCE(v_ev.posto_detectado_nome, v_ev.posto_nome, 'GPS'), COALESCE(ROUND(v_ev.accuracy_m)::text, '?'));

    IF v_ev.revisao_pendente THEN
      v_status := 'Incompleto';
    ELSIF v_ev.classificacao_posto = 'divergencia_posto' AND v_status <> 'Incompleto' THEN
      v_status := 'Divergente';
    ELSIF v_ev.classificacao_posto IN ('cobertura_programada', 'extra_programada') AND v_status NOT IN ('Incompleto', 'Divergente') THEN
      v_status := CASE WHEN v_ev.classificacao_posto = 'extra_programada' THEN 'Hora Extra' ELSE 'Cobertura' END;
    END IF;

    v_detalhes := v_detalhes || jsonb_build_array(
      jsonb_build_object(
        'evento_id', v_ev.id,
        'tipo_evento', v_ev.tipo_evento,
        'hora', v_hora,
        'posto_id', v_ev.posto_detectado_id,
        'posto_nome', COALESCE(v_ev.posto_detectado_nome, v_ev.posto_nome),
        'classificacao_posto', v_ev.classificacao_posto,
        'geofence_status', v_ev.geofence_status,
        'revisao_pendente', v_ev.revisao_pendente
      )
    );

    -- Suporta múltiplos turnos sem sobrescrever turno anterior já fechado
    IF v_ev.tipo_evento = 'entrada' AND v_e1 <> '--:--' AND v_s2 <> '--:--' THEN
      INSERT INTO public.pontos (
        id, empresa_id, colaborador_id, colaborador_nome, data, turno_index,
        entrada_1, saida_1, entrada_2, saida_2, total_horas, status_ponto, status,
        localizacao_gps, detalhes_turnos, updated_at
      ) VALUES (
        format('pto-%s-%s-t%s', p_colaborador_id, to_char(p_data, 'YYYYMMDD'), v_turno),
        p_empresa_id, p_colaborador_id, COALESCE(v_colab_nome, 'Colaborador'), p_data, v_turno,
        v_e1, v_s1, v_e2, v_s2, 'Turno concluído', v_status, v_status,
        v_last_gps, v_detalhes, NOW()
      )
      ON CONFLICT (empresa_id, colaborador_id, data, turno_index) DO UPDATE SET
        entrada_1 = EXCLUDED.entrada_1,
        saida_1 = EXCLUDED.saida_1,
        entrada_2 = EXCLUDED.entrada_2,
        saida_2 = EXCLUDED.saida_2,
        status_ponto = EXCLUDED.status_ponto,
        status = EXCLUDED.status,
        localizacao_gps = EXCLUDED.localizacao_gps,
        detalhes_turnos = EXCLUDED.detalhes_turnos,
        updated_at = NOW();

      v_turno := v_turno + 1;
      v_e1 := '--:--'; v_s1 := '--:--'; v_e2 := '--:--'; v_s2 := '--:--';
    END IF;

    IF v_ev.tipo_evento = 'entrada' AND v_e1 = '--:--' THEN
      v_e1 := v_hora;
    ELSIF v_ev.tipo_evento = 'saida_intervalo' AND v_s1 = '--:--' THEN
      v_s1 := v_hora;
    ELSIF v_ev.tipo_evento = 'retorno_intervalo' AND v_e2 = '--:--' THEN
      v_e2 := v_hora;
    ELSIF v_ev.tipo_evento = 'saida' AND v_s2 = '--:--' THEN
      v_s2 := v_hora;
    END IF;
  END LOOP;

  IF v_count > 0 THEN
    INSERT INTO public.pontos (
      id, empresa_id, colaborador_id, colaborador_nome, data, turno_index,
      entrada_1, saida_1, entrada_2, saida_2, total_horas, status_ponto, status,
      localizacao_gps, detalhes_turnos, updated_at
    ) VALUES (
      format('pto-%s-%s-t%s', p_colaborador_id, to_char(p_data, 'YYYYMMDD'), v_turno),
      p_empresa_id, p_colaborador_id, COALESCE(v_colab_nome, 'Colaborador'), p_data, v_turno,
      v_e1, v_s1, v_e2, v_s2,
      CASE WHEN v_s2 <> '--:--' THEN 'Concluído' ELSE 'Em andamento' END,
      v_status, v_status, v_last_gps, v_detalhes, NOW()
    )
    ON CONFLICT (empresa_id, colaborador_id, data, turno_index) DO UPDATE SET
      entrada_1 = EXCLUDED.entrada_1,
      saida_1 = EXCLUDED.saida_1,
      entrada_2 = EXCLUDED.entrada_2,
      saida_2 = EXCLUDED.saida_2,
      total_horas = EXCLUDED.total_horas,
      status_ponto = EXCLUDED.status_ponto,
      status = EXCLUDED.status,
      localizacao_gps = EXCLUDED.localizacao_gps,
      detalhes_turnos = EXCLUDED.detalhes_turnos,
      updated_at = NOW();
  END IF;
END;
$$;

-- 7. RPC Transacional de Registro de Ponto com Geofence 100% Server-Side
CREATE OR REPLACE FUNCTION public.registrar_ponto_transacional(
  p_colaborador_id TEXT,
  p_tipo_evento TEXT,
  p_metodo_autenticacao TEXT,
  p_idempotency_key TEXT,
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_accuracy_m DOUBLE PRECISION DEFAULT NULL,
  p_posto_detectado_id TEXT DEFAULT NULL,
  p_decisao_geofence TEXT DEFAULT NULL,
  p_distance_m DOUBLE PRECISION DEFAULT NULL,
  p_ambiguidade_detectada BOOLEAN DEFAULT FALSE,
  p_credential_id TEXT DEFAULT NULL,
  p_foto_biometria_url TEXT DEFAULT NULL,
  p_motivo_excecao TEXT DEFAULT NULL,
  p_device_info JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_caller_role TEXT;
  v_caller_empresa TEXT;
  v_colab RECORD;
  v_empresa RECORD;
  v_existing RECORD;
  v_posto RECORD;
  v_posto_base RECORD;
  v_cobertura public.coberturas_programadas;
  v_classificacao TEXT := 'posto_regular';
  v_decisao_final TEXT;
  v_verification TEXT := 'confirmado';
  v_revisao_pendente BOOLEAN := FALSE;
  v_distance_final DOUBLE PRECISION := NULL;
  v_ambiguidade BOOLEAN := FALSE;
  v_match_count INTEGER := 0;
  v_inconclusivo_count INTEGER := 0;
  v_calibrados_count INTEGER := 0;
  v_uncalibrated_names TEXT;
  v_max_acc INTEGER := 80;
  v_exige_aceite BOOLEAN := FALSE;
  v_modo_offline BOOLEAN := COALESCE((p_device_info->>'offlineSync')::boolean, FALSE);
  v_evento_id TEXT;
  v_comprovante TEXT;
  v_now TIMESTAMPTZ := NOW();
  v_now_br TIMESTAMPTZ := NOW() AT TIME ZONE 'America/Sao_Paulo';
  v_hora_str TEXT := to_char(NOW() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI');
  v_cand RECORD;
  v_dist DOUBLE PRECISION;
  v_raio INTEGER;
  v_is_within BOOLEAN;
  v_is_inconclusive BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória para registrar ponto.' USING ERRCODE = '42501';
  END IF;

  IF p_idempotency_key IS NULL OR LENGTH(TRIM(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'Chave de idempotência inválida.' USING ERRCODE = '22023';
  END IF;

  -- Lock transacional determinístico para impedir corrida em cliques duplicados simultâneos
  PERFORM pg_advisory_xact_lock(hashtext(p_idempotency_key));

  SELECT * INTO v_existing
  FROM public.ponto_eventos
  WHERE idempotency_key = p_idempotency_key
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', CASE WHEN v_existing.revisao_pendente THEN 'pendente_revisao' ELSE 'duplicado' END,
      'duplicado', TRUE,
      'evento_id', v_existing.id,
      'comprovante_numero', v_existing.comprovante_numero,
      'server_timestamp', v_existing.server_timestamp,
      'classificacao_posto', v_existing.classificacao_posto,
      'decisao_geofence', v_existing.decisao_geofence,
      'distance_m', v_existing.distance_m,
      'posto_detectado_id', v_existing.posto_detectado_id,
      'posto_detectado_nome', v_existing.posto_detectado_nome,
      'coverage_assignment_id', v_existing.coverage_assignment_id,
      'revisao_pendente', v_existing.revisao_pendente
    );
  END IF;

  -- Valida perfil e vínculo estrito (sem role silencioso)
  SELECT role, empresa_id INTO v_caller_role, v_caller_empresa
  FROM public.profiles
  WHERE id = v_uid
  LIMIT 1;

  SELECT * INTO v_colab FROM public.colaboradores WHERE id = p_colaborador_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Colaborador não encontrado (%).', p_colaborador_id USING ERRCODE = 'P0002';
  END IF;

  IF v_caller_role IS NULL OR v_caller_empresa IS NULL THEN
    -- Permite apenas se o colaborador tiver vínculo direto validado em auth_user_id e role explícito
    IF v_colab.auth_user_id IS DISTINCT FROM v_uid OR v_colab.role IS NULL THEN
      RAISE EXCEPTION 'Perfil de acesso ou vínculo empresarial inválido. Procure o RH.' USING ERRCODE = '42501';
    END IF;
    v_caller_role := v_colab.role;
    v_caller_empresa := v_colab.empresa_id;
  END IF;

  IF v_caller_empresa <> v_colab.empresa_id THEN
    RAISE EXCEPTION 'Violação de isolamento multiempresa.' USING ERRCODE = '42501';
  END IF;

  IF v_colab.auth_user_id IS DISTINCT FROM v_uid AND v_caller_role NOT IN ('admin', 'supervisor') THEN
    RAISE EXCEPTION 'Sem permissão para registrar ponto em nome de outro colaborador.' USING ERRCODE = '42501';
  END IF;

  IF p_metodo_autenticacao NOT IN ('biometria_facial', 'biometria_passkey', 'autenticador_dispositivo', 'excecao_autorizada') THEN
    RAISE EXCEPTION 'Método de autenticação inválido: %', p_metodo_autenticacao USING ERRCODE = '22023';
  END IF;

  IF p_tipo_evento NOT IN ('entrada', 'saida_intervalo', 'retorno_intervalo', 'saida') THEN
    RAISE EXCEPTION 'Tipo de batida inválido: %', p_tipo_evento USING ERRCODE = '22023';
  END IF;

  -- Exceção autorizada é estritamente privativa de admin/supervisor com motivo obrigatório
  IF p_metodo_autenticacao = 'excecao_autorizada' THEN
    IF v_caller_role NOT IN ('admin', 'supervisor') THEN
      RAISE EXCEPTION 'Apenas admin ou supervisor pode registrar exceção autorizada.' USING ERRCODE = '42501';
    END IF;
    IF p_motivo_excecao IS NULL OR LENGTH(TRIM(p_motivo_excecao)) < 5 THEN
      RAISE EXCEPTION 'Motivo obrigatório (mínimo 5 caracteres) para exceção autorizada.' USING ERRCODE = '22023';
    END IF;
  END IF;

  SELECT * INTO v_empresa FROM public.empresas WHERE id = v_colab.empresa_id;
  v_max_acc := COALESCE(v_empresa.max_gps_accuracy_m, 80);
  v_exige_aceite := COALESCE(v_empresa.exige_aceite_cobertura, FALSE);

  SELECT * INTO v_posto_base FROM public.condominios WHERE id = v_colab.condominio_id;

  -- Verifica se há postos ativos sem coordenadas na empresa e gera alerta operacional de calibração
  SELECT COUNT(*), STRING_AGG(c.nome, ', ' ORDER BY c.nome)
  INTO v_calibrados_count, v_uncalibrated_names
  FROM public.condominios c
  WHERE c.empresa_id = v_colab.empresa_id
    AND COALESCE(c.ativo, TRUE) = TRUE
    AND (c.latitude IS NULL OR c.longitude IS NULL);

  IF v_calibrados_count > 0 AND v_uncalibrated_names IS NOT NULL THEN
    INSERT INTO public.alertas (
      id, empresa_id, tipo, gravidade, titulo, descricao,
      posto_id, posto_nome, colaborador_id, colaborador_nome, horario, resolvido
    )
    SELECT
      'alr-cal-' || replace(gen_random_uuid()::text, '-', ''),
      v_colab.empresa_id, 'posto_sem_coordenadas', 'moderada',
      'Posto(s) ativo(s) sem calibração GPS',
      format('Os postos [%s] estão ativos sem latitude/longitude calibradas. Realize a calibração GPS.', v_uncalibrated_names),
      COALESCE(v_colab.condominio_id, (SELECT id FROM public.condominios WHERE empresa_id = v_colab.empresa_id LIMIT 1)),
      COALESCE(v_posto_base.nome, v_colab.posto_nome, 'Posto'),
      v_colab.id, v_colab.nome, v_hora_str, FALSE
    WHERE NOT EXISTS (
      SELECT 1 FROM public.alertas a
      WHERE a.empresa_id = v_colab.empresa_id
        AND a.tipo = 'posto_sem_coordenadas'
        AND a.resolvido = FALSE
    );
  END IF;

  -- Validação geográfica integral no servidor (nunca confia em p_decisao_geofence / p_posto_detectado_id / p_distance_m)
  IF p_metodo_autenticacao = 'excecao_autorizada' THEN
    v_decisao_final := 'dentro_do_raio';
    v_posto := v_posto_base;
    v_distance_final := NULL;
  ELSE
    -- Valida coordenadas e precisão positiva
    IF p_latitude IS NULL OR p_longitude IS NULL OR p_accuracy_m IS NULL THEN
      IF v_modo_offline THEN
        v_decisao_final := 'gps_indisponivel';
        v_verification := 'pendente';
        v_revisao_pendente := TRUE;
        v_posto := v_posto_base;
      ELSE
        RAISE EXCEPTION 'GPS indisponível: envie latitude, longitude e precisão válidas ou utilize exceção administrativa.' USING ERRCODE = '22023';
      END IF;
    ELSIF p_latitude < -90.0 OR p_latitude > 90.0 OR p_longitude < -180.0 OR p_longitude > 180.0 OR p_accuracy_m <= 0 THEN
      RAISE EXCEPTION 'Coordenadas ou precisão GPS fora dos limites físicos válidos.' USING ERRCODE = '22023';
    ELSIF p_accuracy_m > v_max_acc THEN
      IF v_modo_offline THEN
        v_decisao_final := 'inconclusivo';
        v_verification := 'pendente';
        v_revisao_pendente := TRUE;
        v_posto := v_posto_base;
      ELSE
        RAISE EXCEPTION 'GPS inconclusivo: precisão atual (%m) excede o limite máximo da empresa (%m). Tente novamente.', ROUND(p_accuracy_m), v_max_acc
          USING ERRCODE = '22023';
      END IF;
    ELSE
      -- Avalia TODOS os postos ativos e calibrados da mesma empresa via Haversine
      SELECT COUNT(*) INTO v_calibrados_count
      FROM public.condominios c
      WHERE c.empresa_id = v_colab.empresa_id
        AND COALESCE(c.ativo, TRUE) = TRUE
        AND c.latitude IS NOT NULL
        AND c.longitude IS NOT NULL;

      IF v_calibrados_count = 0 THEN
        RAISE EXCEPTION 'Nenhum posto ativo possui calibração GPS na empresa (%). Cadastre as coordenadas do posto.', COALESCE(v_uncalibrated_names, 'sem postos')
          USING ERRCODE = '22023';
      END IF;

      FOR v_cand IN
        SELECT c.*,
               public.fn_haversine_metros(p_latitude, p_longitude, c.latitude, c.longitude) AS calc_dist_m,
               COALESCE(c.raio_gps_metros, c.raio_tolerancia_metros, 150) AS calc_raio_m
        FROM public.condominios c
        WHERE c.empresa_id = v_colab.empresa_id
          AND COALESCE(c.ativo, TRUE) = TRUE
          AND c.latitude IS NOT NULL
          AND c.longitude IS NOT NULL
        ORDER BY
          (c.id = v_colab.condominio_id) DESC,
          public.fn_haversine_metros(p_latitude, p_longitude, c.latitude, c.longitude) ASC
      LOOP
        v_dist := v_cand.calc_dist_m;
        v_raio := v_cand.calc_raio_m;
        v_is_within := (v_dist + p_accuracy_m) <= v_raio;
        v_is_inconclusive := (NOT v_is_within) AND ((v_dist - p_accuracy_m) <= v_raio);

        IF v_is_within THEN
          v_match_count := v_match_count + 1;
          IF v_posto.id IS NULL THEN
            v_posto := v_cand;
            v_distance_final := ROUND(v_dist::numeric, 2);
          ELSE
            -- Desempata favorecendo posto com cobertura ativa se o primeiro não for posto habitual
            IF v_posto.id <> COALESCE(v_colab.condominio_id, '') THEN
              SELECT * INTO v_cobertura
              FROM public.fn_buscar_cobertura_vigente(v_colab.empresa_id, v_colab.id, v_cand.id, v_now, v_exige_aceite);
              IF v_cobertura.id IS NOT NULL THEN
                v_posto := v_cand;
                v_distance_final := ROUND(v_dist::numeric, 2);
              END IF;
            END IF;
          END IF;
        ELSIF v_is_inconclusive THEN
          v_inconclusivo_count := v_inconclusivo_count + 1;
          IF v_posto.id IS NULL THEN
            v_posto := v_cand;
            v_distance_final := ROUND(v_dist::numeric, 2);
          END IF;
        ELSIF v_distance_final IS NULL THEN
          v_distance_final := ROUND(v_dist::numeric, 2);
        END IF;
      END LOOP;

      v_ambiguidade := (v_match_count > 1);

      IF v_match_count > 0 THEN
        v_decisao_final := 'dentro_do_raio';
      ELSIF v_inconclusivo_count > 0 THEN
        IF v_modo_offline THEN
          v_decisao_final := 'inconclusivo';
          v_verification := 'pendente';
          v_revisao_pendente := TRUE;
        ELSE
          RAISE EXCEPTION 'GPS inconclusivo na fronteira do posto (distância %m, margem ±%m). Tente novamente.', ROUND(COALESCE(v_distance_final, 0)), ROUND(p_accuracy_m)
            USING ERRCODE = '22023';
        END IF;
      ELSE
        -- Prova confiável de estar fora de todos os postos ativos calibrados da empresa
        RAISE EXCEPTION 'Fora de todos os postos cadastrados da empresa (menor distância: %m). Registro bloqueado.', ROUND(COALESCE(v_distance_final, 0))
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  -- Classificação multi-posto e cobertura considerando janela horária exata em America/Sao_Paulo (sem alterar colaboradores.condominio_id)
  v_cobertura := NULL;
  IF v_posto.id IS NOT NULL THEN
    SELECT * INTO v_cobertura
    FROM public.fn_buscar_cobertura_vigente(v_colab.empresa_id, v_colab.id, v_posto.id, v_now, v_exige_aceite);

    IF v_cobertura.id IS NOT NULL THEN
      v_classificacao := CASE WHEN v_cobertura.tipo = 'extra' THEN 'extra_programada' ELSE 'cobertura_programada' END;
      IF v_verification = 'confirmado' THEN
        UPDATE public.coberturas_programadas
        SET status = 'em_andamento', updated_at = v_now
        WHERE id = v_cobertura.id AND status = 'aprovada';

        INSERT INTO public.coberturas_historico (empresa_id, cobertura_id, acao, ator_id, ator_nome, detalhes)
        VALUES (v_colab.empresa_id, v_cobertura.id, 'executada_no_ponto', v_uid, v_colab.nome,
                format('Batida %s registrada no posto %s às %s.', p_tipo_evento, v_posto.nome, v_hora_str));

        INSERT INTO public.notificacoes_sistema (
          empresa_id, destinatario_role, categoria, titulo, mensagem, referencia_tipo, referencia_id
        ) VALUES
          (v_colab.empresa_id, 'supervisor', 'cobertura',
           format('Cobertura/Extra Executada — %s', v_colab.nome),
           format('%s registrou %s em %s conforme programação.', v_colab.nome, p_tipo_evento, v_posto.nome),
           'cobertura', v_cobertura.id);
      END IF;
    ELSIF v_colab.condominio_id IS NOT NULL AND v_posto.id <> v_colab.condominio_id THEN
      v_classificacao := 'divergencia_posto';
    ELSE
      v_classificacao := 'posto_regular';
    END IF;
  END IF;

  v_evento_id := 'pe-' || replace(gen_random_uuid()::text, '-', '');
  v_comprovante := 'TC-' || to_char(v_now_br, 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  INSERT INTO public.ponto_eventos (
    id, empresa_id, colaborador_id, colaborador_nome, auth_user_id,
    condominio_id, condominio_nome, posto_nome,
    posto_base_id, posto_detectado_id, posto_detectado_nome,
    coverage_assignment_id, classificacao_posto,
    tipo_evento, label_evento, server_timestamp,
    latitude, longitude, accuracy_m, accuracy_real_m,
    geofence_status, decisao_geofence, distance_m, ambiguidade_detectada,
    regra_geofence_versao, regra_raio_m, precisao_max_empresa_m, revisao_pendente,
    credential_id, foto_biometria_url, metodo_autenticacao, verification_status,
    idempotency_key, comprovante_numero, motivo_excecao,
    is_cobertura, posto_original_id, posto_original_nome, device_info, criado_em
  ) VALUES (
    v_evento_id, v_colab.empresa_id, v_colab.id, v_colab.nome, v_uid,
    COALESCE(v_posto.id, v_colab.condominio_id),
    COALESCE(v_posto.nome, v_colab.posto_nome, 'Posto'),
    COALESCE(v_posto.nome, v_colab.posto_nome, 'Posto'),
    v_colab.condominio_id, v_posto.id, v_posto.nome,
    v_cobertura.id, v_classificacao,
    p_tipo_evento,
    CASE p_tipo_evento
      WHEN 'entrada' THEN 'Entrada registrada'
      WHEN 'saida_intervalo' THEN 'Saída para intervalo'
      WHEN 'retorno_intervalo' THEN 'Retorno do intervalo'
      ELSE 'Saída registrada'
    END,
    v_now,
    p_latitude, p_longitude, p_accuracy_m, p_accuracy_m,
    v_decisao_final, v_decisao_final, v_distance_final, v_ambiguidade,
    'haversine-v2-margin', COALESCE(v_posto.raio_gps_metros, v_posto.raio_tolerancia_metros, 150), v_max_acc, v_revisao_pendente,
    p_credential_id, p_foto_biometria_url, p_metodo_autenticacao, v_verification,
    p_idempotency_key, v_comprovante, p_motivo_excecao,
    (v_classificacao <> 'posto_regular'),
    v_colab.condominio_id, COALESCE(v_posto_base.nome, v_colab.posto_nome),
    COALESCE(p_device_info, '{}'::jsonb), v_now
  );

  -- Atualiza projeção consolidada diária a partir dos eventos imutáveis
  PERFORM public.fn_reconstruir_espelho_ponto(v_colab.empresa_id, v_colab.id, v_now_br::date);

  -- Atualiza apenas último ponto e presença sem alterar condominio_id nem escala habitual
  UPDATE public.colaboradores
  SET ultimo_ponto = format('%s - %s', v_hora_str, COALESCE(v_posto.nome, v_colab.posto_nome)),
      status = CASE WHEN p_tipo_evento IN ('entrada', 'retorno_intervalo') AND NOT v_revisao_pendente THEN 'no_posto' ELSE status END
  WHERE id = v_colab.id;

  -- Notifica gestores em divergência de posto ou revisão pendente de fila offline
  IF v_classificacao = 'divergencia_posto' OR v_revisao_pendente THEN
    INSERT INTO public.alertas (
      id, empresa_id, tipo, gravidade, titulo, descricao,
      posto_id, posto_nome, colaborador_id, colaborador_nome, horario, resolvido,
      latitude_tentativa, longitude_tentativa, distancia_tentativa_m
    ) VALUES (
      'alr-' || replace(gen_random_uuid()::text, '-', ''),
      v_colab.empresa_id,
      CASE WHEN v_revisao_pendente THEN 'atraso' ELSE 'posto_divergente' END,
      'moderada',
      CASE WHEN v_revisao_pendente
        THEN format('Ponto Offline Pendente de Revisão: %s', v_colab.nome)
        ELSE format('Divergência de Posto: %s', v_colab.nome)
      END,
      CASE WHEN v_revisao_pendente
        THEN format('Sincronização offline (%s) sem prova GPS suficiente (%s). Necessária auditoria do supervisor.', p_tipo_evento, v_decisao_final)
        ELSE format('Ponto (%s) registrado em %s sem cobertura programada; posto-base mantido em %s.',
                    p_tipo_evento, COALESCE(v_posto.nome, 'Outro posto'), COALESCE(v_posto_base.nome, v_colab.posto_nome, 'Base'))
      END,
      COALESCE(v_posto.id, v_colab.condominio_id),
      COALESCE(v_posto.nome, v_colab.posto_nome, 'Posto'),
      v_colab.id, v_colab.nome, v_hora_str, FALSE,
      p_latitude, p_longitude, v_distance_final
    );

    INSERT INTO public.notificacoes_sistema (
      empresa_id, destinatario_role, categoria, titulo, mensagem, referencia_tipo, referencia_id
    ) VALUES
      (v_colab.empresa_id, 'supervisor', CASE WHEN v_revisao_pendente THEN 'ponto' ELSE 'divergencia_posto' END,
       CASE WHEN v_revisao_pendente THEN format('Ponto Offline para Revisão — %s', v_colab.nome) ELSE format('Divergência de Posto — %s', v_colab.nome) END,
       CASE WHEN v_revisao_pendente THEN format('Batida offline sem evidência GPS suficiente (%s).', v_decisao_final) ELSE format('Batida registrada no posto %s sem cobertura programada vinculada.', COALESCE(v_posto.nome, 'desconhecido')) END,
       'ponto_evento', v_evento_id),
      (v_colab.empresa_id, 'rh', CASE WHEN v_revisao_pendente THEN 'ponto' ELSE 'divergencia_posto' END,
       CASE WHEN v_revisao_pendente THEN format('Ponto Offline para Revisão — %s', v_colab.nome) ELSE format('Divergência de Posto — %s', v_colab.nome) END,
       CASE WHEN v_revisao_pendente THEN format('Batida offline sem evidência GPS suficiente (%s).', v_decisao_final) ELSE format('Batida registrada no posto %s sem cobertura programada vinculada.', COALESCE(v_posto.nome, 'desconhecido')) END,
       'ponto_evento', v_evento_id);
  END IF;

  IF v_ambiguidade THEN
    INSERT INTO public.audit_logs (
      empresa_id, ator_auth_id, ator_colaborador_id, ator_nome, entidade, entidade_id, acao, detalhes
    ) VALUES (
      v_colab.empresa_id, v_uid, v_colab.id, v_colab.nome,
      'ponto_evento', v_evento_id, 'geofence_sobreposicao_detectada',
      jsonb_build_object('posto_selecionado_id', v_posto.id, 'distance_m', v_distance_final, 'accuracy_m', p_accuracy_m)
    );
  END IF;

  RETURN jsonb_build_object(
    'status', CASE WHEN v_revisao_pendente THEN 'pendente_revisao' ELSE 'confirmado' END,
    'duplicado', FALSE,
    'evento_id', v_evento_id,
    'comprovante_numero', v_comprovante,
    'server_timestamp', v_now,
    'classificacao_posto', v_classificacao,
    'decisao_geofence', v_decisao_final,
    'distance_m', v_distance_final,
    'ambiguidade_detectada', v_ambiguidade,
    'revisao_pendente', v_revisao_pendente,
    'coverage_assignment_id', v_cobertura.id,
    'posto_detectado_id', v_posto.id,
    'posto_detectado_nome', v_posto.nome,
    'posto_base_id', v_colab.condominio_id,
    'posto_base_nome', COALESCE(v_posto_base.nome, v_colab.posto_nome)
  );
END;
$$;

COMMENT ON FUNCTION public.registrar_ponto_transacional IS 'Registra evento imutável de ponto recalculando Haversine, margem de precisão GPS, cobertura horária e projeção em pontos exclusivamente no servidor.';
