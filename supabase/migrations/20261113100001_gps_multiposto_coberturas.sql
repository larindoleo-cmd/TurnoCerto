-- ============================================================================
-- TurnoCerto: Migração Incremental 20261113100001
-- Escopo: GPS Multi-Posto, Precisão Configurável, Coberturas/Extras,
--         Identidade Auth->Colaborador e RPC Transacional de Ponto/Substituição
-- NÃO destrutiva: não utiliza DROP TABLE nem altera colunas verificadas em
-- schema_canonico_test.sql (public.condominios mantém exatamente 36 colunas).
-- ============================================================================

-- 1. Configuração de Precisão Máxima GPS e Política de Cobertura por Empresa
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS max_gps_accuracy_m INTEGER NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS exige_aceite_cobertura BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.empresas DROP CONSTRAINT IF EXISTS chk_empresas_max_gps_accuracy_m;
ALTER TABLE public.empresas
  ADD CONSTRAINT chk_empresas_max_gps_accuracy_m
  CHECK (max_gps_accuracy_m BETWEEN 10 AND 500);

-- 2. Vínculo Forte Auth <-> Colaborador <-> Profile e Suporte ao Papel 'rh'
ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS auth_user_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS uq_colaboradores_auth_user_id
  ON public.colaboradores(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

ALTER TABLE public.colaboradores DROP CONSTRAINT IF EXISTS colaboradores_role_check;
ALTER TABLE public.colaboradores DROP CONSTRAINT IF EXISTS chk_colaboradores_role;
ALTER TABLE public.colaboradores
  ADD CONSTRAINT chk_colaboradores_role
  CHECK (role IS NULL OR role IN ('admin', 'supervisor', 'rh', 'funcionario'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS colaborador_id TEXT,
  ADD COLUMN IF NOT EXISTS empresa_id TEXT NOT NULL DEFAULT 'emp-matriz-principal';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS chk_profiles_role;
ALTER TABLE public.profiles
  ADD CONSTRAINT chk_profiles_role
  CHECK (role IS NULL OR role IN ('admin', 'supervisor', 'rh', 'funcionario'));

CREATE INDEX IF NOT EXISTS idx_profiles_colaborador_id ON public.profiles(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_profiles_empresa_role ON public.profiles(empresa_id, role);

-- 3. Extensão de ponto_eventos para Multi-Posto, Inconclusivo e Ambiguidade
ALTER TABLE public.ponto_eventos
  ADD COLUMN IF NOT EXISTS posto_base_id TEXT,
  ADD COLUMN IF NOT EXISTS posto_detectado_id TEXT,
  ADD COLUMN IF NOT EXISTS posto_detectado_nome TEXT,
  ADD COLUMN IF NOT EXISTS coverage_assignment_id TEXT,
  ADD COLUMN IF NOT EXISTS classificacao_posto TEXT NOT NULL DEFAULT 'posto_regular',
  ADD COLUMN IF NOT EXISTS accuracy_real_m DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS decisao_geofence TEXT,
  ADD COLUMN IF NOT EXISTS ambiguidade_detectada BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_cobertura BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS posto_original_id TEXT,
  ADD COLUMN IF NOT EXISTS posto_original_nome TEXT,
  ADD COLUMN IF NOT EXISTS device_info JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.ponto_eventos DROP CONSTRAINT IF EXISTS chk_ponto_eventos_geofence_status;
ALTER TABLE public.ponto_eventos DROP CONSTRAINT IF EXISTS ponto_eventos_geofence_status_check;
ALTER TABLE public.ponto_eventos
  ADD CONSTRAINT chk_ponto_eventos_geofence_status
  CHECK (geofence_status IN ('dentro_do_raio', 'fora_do_raio', 'inconclusivo', 'gps_indisponivel', 'pendente'));

ALTER TABLE public.ponto_eventos DROP CONSTRAINT IF EXISTS chk_ponto_eventos_classificacao_posto;
ALTER TABLE public.ponto_eventos
  ADD CONSTRAINT chk_ponto_eventos_classificacao_posto
  CHECK (classificacao_posto IN ('posto_regular', 'cobertura_programada', 'extra_programada', 'divergencia_posto'));

ALTER TABLE public.ponto_eventos DROP CONSTRAINT IF EXISTS chk_ponto_eventos_decisao_geofence;
ALTER TABLE public.ponto_eventos
  ADD CONSTRAINT chk_ponto_eventos_decisao_geofence
  CHECK (decisao_geofence IS NULL OR decisao_geofence IN ('dentro_do_raio', 'fora_do_raio', 'inconclusivo', 'gps_indisponivel', 'pendente'));

CREATE INDEX IF NOT EXISTS idx_ponto_eventos_posto_detectado
  ON public.ponto_eventos(empresa_id, posto_detectado_id, server_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ponto_eventos_classificacao
  ON public.ponto_eventos(empresa_id, classificacao_posto, server_timestamp DESC);

-- 4. Tabelas de Extras, Coberturas Programadas e Histórico de Escalas
CREATE TABLE IF NOT EXISTS public.coberturas_programadas (
  id TEXT PRIMARY KEY DEFAULT ('cov-' || replace(gen_random_uuid()::text, '-', '')),
  empresa_id TEXT NOT NULL DEFAULT 'emp-matriz-principal' REFERENCES public.empresas(id) ON DELETE RESTRICT,
  colaborador_id TEXT NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  colaborador_nome TEXT,
  posto_principal_id TEXT REFERENCES public.condominios(id) ON DELETE SET NULL,
  posto_cobertura_id TEXT NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  posto_cobertura_nome TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('extra', 'cobertura', 'substituicao', 'alocacao_temporaria')),
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  motivo TEXT,
  substituido_colaborador_id TEXT REFERENCES public.colaboradores(id) ON DELETE SET NULL,
  alerta_origem_id TEXT,
  valor_extra_ft NUMERIC(10, 2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aprovada' CHECK (
    status IN ('aguardando_aceite', 'aprovada', 'recusada', 'em_andamento', 'concluida', 'cancelada')
  ),
  aceite_colaborador BOOLEAN,
  aceite_em TIMESTAMPTZ,
  recusa_motivo TEXT,
  criado_por UUID,
  criado_por_nome TEXT,
  aprovado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_cobertura_datas_validas CHECK (data_fim >= data_inicio)
);

CREATE INDEX IF NOT EXISTS idx_coberturas_empresa_status_datas
  ON public.coberturas_programadas(empresa_id, status, data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_coberturas_colaborador_datas
  ON public.coberturas_programadas(colaborador_id, data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_coberturas_posto_datas
  ON public.coberturas_programadas(posto_cobertura_id, data_inicio, data_fim);

CREATE TABLE IF NOT EXISTS public.coberturas_historico (
  id TEXT PRIMARY KEY DEFAULT ('covh-' || replace(gen_random_uuid()::text, '-', '')),
  empresa_id TEXT NOT NULL DEFAULT 'emp-matriz-principal' REFERENCES public.empresas(id) ON DELETE RESTRICT,
  cobertura_id TEXT NOT NULL REFERENCES public.coberturas_programadas(id) ON DELETE CASCADE,
  acao TEXT NOT NULL CHECK (acao IN ('criada', 'aprovada', 'aceita', 'recusada', 'cancelada', 'concluida', 'executada_no_ponto', 'editada')),
  ator_id UUID,
  ator_nome TEXT,
  detalhes TEXT,
  dados_anteriores JSONB,
  dados_novos JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coberturas_historico_cov
  ON public.coberturas_historico(cobertura_id, created_at DESC);

-- Prevenir sobreposição de turnos ativos/aprovados para o mesmo colaborador
CREATE OR REPLACE FUNCTION public.fn_validar_conflito_cobertura()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_conflito_id TEXT;
BEGIN
  IF NEW.status IN ('aguardando_aceite', 'aprovada', 'em_andamento') THEN
    SELECT c.id INTO v_conflito_id
    FROM public.coberturas_programadas c
    WHERE c.colaborador_id = NEW.colaborador_id
      AND c.id <> NEW.id
      AND c.status IN ('aguardando_aceite', 'aprovada', 'em_andamento')
      AND daterange(c.data_inicio, c.data_fim, '[]') && daterange(NEW.data_inicio, NEW.data_fim, '[]')
      AND (
        -- Mesmo dia ou faixas horárias sobrepostas (suportando turno noturno que vira o dia)
        (
          (NEW.hora_fim > NEW.hora_inicio AND c.hora_fim > c.hora_inicio)
          AND (NEW.hora_inicio < c.hora_fim AND NEW.hora_fim > c.hora_inicio)
        )
        OR (NEW.hora_fim <= NEW.hora_inicio OR c.hora_fim <= c.hora_inicio)
      )
    LIMIT 1;

    IF v_conflito_id IS NOT NULL THEN
      RAISE EXCEPTION 'Conflito de horário: colaborador % já possui cobertura/extra ativa (%) no período informado.', NEW.colaborador_id, v_conflito_id
        USING ERRCODE = '23P01';
    END IF;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_conflito_cobertura ON public.coberturas_programadas;
CREATE TRIGGER trg_validar_conflito_cobertura
  BEFORE INSERT OR UPDATE ON public.coberturas_programadas
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_validar_conflito_cobertura();

-- 5. Tabelas de Notificações Persistentes e Auditoria Geral
CREATE TABLE IF NOT EXISTS public.notificacoes_sistema (
  id TEXT PRIMARY KEY DEFAULT ('notif-' || replace(gen_random_uuid()::text, '-', '')),
  empresa_id TEXT NOT NULL DEFAULT 'emp-matriz-principal' REFERENCES public.empresas(id) ON DELETE RESTRICT,
  destinatario_colaborador_id TEXT REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  destinatario_role TEXT CHECK (destinatario_role IS NULL OR destinatario_role IN ('admin', 'supervisor', 'rh', 'funcionario')),
  categoria TEXT NOT NULL CHECK (categoria IN ('ponto', 'divergencia_posto', 'cobertura', 'documento', 'holerite', 'alerta_config', 'sistema')),
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  referencia_tipo TEXT,
  referencia_id TEXT,
  link_destino TEXT,
  lida BOOLEAN NOT NULL DEFAULT FALSE,
  lida_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_sistema_dest_colab
  ON public.notificacoes_sistema(empresa_id, destinatario_colaborador_id, lida, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notificacoes_sistema_dest_role
  ON public.notificacoes_sistema(empresa_id, destinatario_role, lida, created_at DESC);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY DEFAULT ('aud-' || replace(gen_random_uuid()::text, '-', '')),
  empresa_id TEXT NOT NULL DEFAULT 'emp-matriz-principal' REFERENCES public.empresas(id) ON DELETE RESTRICT,
  ator_auth_id UUID,
  ator_colaborador_id TEXT,
  ator_nome TEXT,
  entidade TEXT NOT NULL,
  entidade_id TEXT NOT NULL,
  acao TEXT NOT NULL,
  detalhes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_empresa_entidade
  ON public.audit_logs(empresa_id, entidade, created_at DESC);

-- 6. Ampliar tipos de alertas para suportar configuração GPS e cobertura/divergência
ALTER TABLE public.alertas DROP CONSTRAINT IF EXISTS alertas_tipo_check;
ALTER TABLE public.alertas DROP CONSTRAINT IF EXISTS chk_alertas_tipo;
ALTER TABLE public.alertas
  ADD CONSTRAINT chk_alertas_tipo
  CHECK (tipo IN (
    'posto_descoberto',
    'falta',
    'atraso',
    'atestado_pendente',
    'tentativa_ponto_fora_posto',
    'ponto_posto_cobertura',
    'posto_divergente',
    'posto_sem_coordenadas',
    'solicitacao_biometria',
    'solicitacao_senha',
    'biometria_pendente'
  ));

-- 7. RPC Transacional de Registro de Ponto (Multi-Posto + Idempotência + Sem Alterar Posto Base)
CREATE OR REPLACE FUNCTION public.registrar_ponto_transacional(
  p_colaborador_id TEXT,
  p_tipo_evento TEXT,
  p_metodo_autenticacao TEXT,
  p_idempotency_key TEXT,
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_accuracy_m DOUBLE PRECISION DEFAULT NULL,
  p_posto_detectado_id TEXT DEFAULT NULL,
  p_decisao_geofence TEXT DEFAULT 'dentro_do_raio',
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
  v_posto RECORD;
  v_posto_base_nome TEXT;
  v_existing RECORD;
  v_cobertura RECORD;
  v_classificacao TEXT := 'posto_regular';
  v_evento_id TEXT;
  v_comprovante TEXT;
  v_now TIMESTAMPTZ := NOW();
  v_now_br TIMESTAMPTZ := NOW() AT TIME ZONE 'America/Sao_Paulo';
  v_data_str TEXT := to_char(NOW() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY');
  v_hora_str TEXT := to_char(NOW() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI');
  v_ponto_id TEXT;
  v_max_acc INTEGER := 80;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória para registrar ponto.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_colab FROM public.colaboradores WHERE id = p_colaborador_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Colaborador não encontrado (%).', p_colaborador_id USING ERRCODE = 'P0002';
  END IF;

  SELECT role, empresa_id INTO v_caller_role, v_caller_empresa
  FROM public.profiles
  WHERE id = v_uid;

  IF v_colab.auth_user_id IS DISTINCT FROM v_uid
     AND COALESCE(v_caller_role, '') NOT IN ('admin', 'supervisor') THEN
    RAISE EXCEPTION 'Sem permissão para registrar ponto em nome de outro colaborador.' USING ERRCODE = '42501';
  END IF;

  IF v_caller_empresa IS NOT NULL AND v_caller_empresa <> v_colab.empresa_id THEN
    RAISE EXCEPTION 'Violação de isolamento multiempresa.' USING ERRCODE = '42501';
  END IF;

  -- Idempotência estrita
  SELECT * INTO v_existing
  FROM public.ponto_eventos
  WHERE idempotency_key = p_idempotency_key
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'duplicado',
      'duplicado', TRUE,
      'evento_id', v_existing.id,
      'comprovante_numero', v_existing.comprovante_numero,
      'server_timestamp', v_existing.server_timestamp,
      'classificacao_posto', v_existing.classificacao_posto
    );
  END IF;

  -- Validação de método e decisão geofence no servidor
  IF p_metodo_autenticacao NOT IN ('biometria_facial', 'biometria_passkey', 'autenticador_dispositivo', 'excecao_autorizada') THEN
    RAISE EXCEPTION 'Método de autenticação inválido: %', p_metodo_autenticacao USING ERRCODE = '22023';
  END IF;

  IF p_tipo_evento NOT IN ('entrada', 'saida_intervalo', 'retorno_intervalo', 'saida') THEN
    RAISE EXCEPTION 'Tipo de batida inválido: %', p_tipo_evento USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(max_gps_accuracy_m, 80) INTO v_max_acc
  FROM public.empresas WHERE id = v_colab.empresa_id;

  IF p_decisao_geofence IN ('fora_do_raio', 'inconclusivo', 'gps_indisponivel')
     AND p_metodo_autenticacao <> 'excecao_autorizada' THEN
    RAISE EXCEPTION 'Localização não validada para confirmação de ponto (%).', p_decisao_geofence USING ERRCODE = '22023';
  END IF;

  IF p_posto_detectado_id IS NOT NULL THEN
    SELECT * INTO v_posto
    FROM public.condominios
    WHERE id = p_posto_detectado_id
      AND empresa_id = v_colab.empresa_id
      AND COALESCE(ativo, TRUE) = TRUE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Posto detectado inativo ou pertencente a outra empresa.' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT nome INTO v_posto_base_nome
  FROM public.condominios
  WHERE id = v_colab.condominio_id;

  -- Classificação multi-posto sem alterar colaboradores.condominio_id
  IF v_posto.id IS NOT NULL AND v_colab.condominio_id IS NOT NULL AND v_posto.id <> v_colab.condominio_id THEN
    SELECT * INTO v_cobertura
    FROM public.coberturas_programadas cp
    WHERE cp.empresa_id = v_colab.empresa_id
      AND cp.colaborador_id = v_colab.id
      AND cp.posto_cobertura_id = v_posto.id
      AND cp.status IN ('aprovada', 'em_andamento')
      AND (v_now_br::date BETWEEN cp.data_inicio AND cp.data_fim)
    ORDER BY cp.created_at DESC
    LIMIT 1;

    IF FOUND THEN
      v_classificacao := CASE WHEN v_cobertura.tipo = 'extra' THEN 'extra_programada' ELSE 'cobertura_programada' END;
      UPDATE public.coberturas_programadas
      SET status = 'em_andamento', updated_at = v_now
      WHERE id = v_cobertura.id AND status = 'aprovada';
      INSERT INTO public.coberturas_historico (empresa_id, cobertura_id, acao, ator_id, ator_nome, detalhes)
      VALUES (v_colab.empresa_id, v_cobertura.id, 'executada_no_ponto', v_uid, v_colab.nome,
              format('Batida %s registrada no posto %s.', p_tipo_evento, v_posto.nome));
    ELSE
      v_classificacao := 'divergencia_posto';
    END IF;
  ELSE
    -- Mesmo quando no próprio posto, verifica se há extra programada vigente
    IF v_posto.id IS NOT NULL THEN
      SELECT * INTO v_cobertura
      FROM public.coberturas_programadas cp
      WHERE cp.empresa_id = v_colab.empresa_id
        AND cp.colaborador_id = v_colab.id
        AND cp.posto_cobertura_id = v_posto.id
        AND cp.tipo = 'extra'
        AND cp.status IN ('aprovada', 'em_andamento')
        AND (v_now_br::date BETWEEN cp.data_inicio AND cp.data_fim)
      LIMIT 1;
      IF FOUND THEN
        v_classificacao := 'extra_programada';
      END IF;
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
    p_decisao_geofence, p_decisao_geofence, p_distance_m, p_ambiguidade_detectada,
    p_credential_id, p_foto_biometria_url, p_metodo_autenticacao, 'confirmado',
    p_idempotency_key, v_comprovante, p_motivo_excecao,
    (v_classificacao <> 'posto_regular'),
    v_colab.condominio_id, COALESCE(v_posto_base_nome, v_colab.posto_nome),
    COALESCE(p_device_info, '{}'::jsonb), v_now
  );

  -- Atualiza espelho diário em pontos sem duplicar a linha do dia
  SELECT id INTO v_ponto_id
  FROM public.pontos
  WHERE empresa_id = v_colab.empresa_id
    AND colaborador_id = v_colab.id
    AND data = v_data_str
  LIMIT 1;

  IF v_ponto_id IS NULL THEN
    v_ponto_id := 'pto-' || replace(gen_random_uuid()::text, '-', '');
    INSERT INTO public.pontos (
      id, empresa_id, colaborador_id, colaborador_nome, data,
      entrada1, saida1, entrada2, saida2, total_horas, status_ponto, localizacao_gps
    ) VALUES (
      v_ponto_id, v_colab.empresa_id, v_colab.id, v_colab.nome, v_data_str,
      CASE WHEN p_tipo_evento = 'entrada' THEN v_hora_str ELSE '--:--' END,
      CASE WHEN p_tipo_evento = 'saida_intervalo' THEN v_hora_str ELSE '--:--' END,
      CASE WHEN p_tipo_evento = 'retorno_intervalo' THEN v_hora_str ELSE '--:--' END,
      CASE WHEN p_tipo_evento = 'saida' THEN v_hora_str ELSE '--:--' END,
      'Em andamento',
      CASE WHEN v_classificacao = 'posto_regular' THEN 'Regular' ELSE 'Hora Extra' END,
      format('%s (±%sm)', COALESCE(v_posto.nome, v_colab.posto_nome, 'GPS'), COALESCE(round(p_accuracy_m)::text, '?'))
    );
  ELSE
    UPDATE public.pontos SET
      entrada1 = CASE WHEN p_tipo_evento = 'entrada' THEN v_hora_str ELSE entrada1 END,
      saida1 = CASE WHEN p_tipo_evento = 'saida_intervalo' THEN v_hora_str ELSE saida1 END,
      entrada2 = CASE WHEN p_tipo_evento = 'retorno_intervalo' THEN v_hora_str ELSE entrada2 END,
      saida2 = CASE WHEN p_tipo_evento = 'saida' THEN v_hora_str ELSE saida2 END,
      localizacao_gps = format('%s (±%sm)', COALESCE(v_posto.nome, v_colab.posto_nome, 'GPS'), COALESCE(round(p_accuracy_m)::text, '?'))
    WHERE id = v_ponto_id;
  END IF;

  -- Atualiza último ponto do colaborador sem mexer em condominio_id ou escala habitual
  UPDATE public.colaboradores
  SET ultimo_ponto = format('%s - %s', v_hora_str, COALESCE(v_posto.nome, v_colab.posto_nome)),
      status = CASE WHEN p_tipo_evento IN ('entrada', 'retorno_intervalo') THEN 'no_posto' ELSE status END
  WHERE id = v_colab.id;

  -- Notifica gestores caso haja divergência de posto ou ambiguidade de geofence
  IF v_classificacao = 'divergencia_posto' THEN
    INSERT INTO public.alertas (
      id, empresa_id, tipo, gravidade, titulo, descricao,
      posto_id, posto_nome, colaborador_id, colaborador_nome, horario, resolvido,
      latitude_tentativa, longitude_tentativa, distancia_tentativa_m
    ) VALUES (
      'alr-' || replace(gen_random_uuid()::text, '-', ''),
      v_colab.empresa_id, 'posto_divergente', 'moderada',
      format('Divergência de Posto: %s', v_colab.nome),
      format('Ponto (%s) registrado em %s sem cobertura programada; posto-base mantido em %s.',
             p_tipo_evento, COALESCE(v_posto.nome, 'Outro posto'), COALESCE(v_posto_base_nome, v_colab.posto_nome, 'Base')),
      COALESCE(v_posto.id, v_colab.condominio_id),
      COALESCE(v_posto.nome, v_colab.posto_nome, 'Posto'),
      v_colab.id, v_colab.nome, v_hora_str, FALSE,
      p_latitude, p_longitude, p_distance_m
    );

    INSERT INTO public.notificacoes_sistema (
      empresa_id, destinatario_role, categoria, titulo, mensagem, referencia_tipo, referencia_id
    ) VALUES
      (v_colab.empresa_id, 'supervisor', 'divergencia_posto',
       format('Divergência de Posto — %s', v_colab.nome),
       format('Batida registrada no posto %s sem cobertura programada vinculada.', COALESCE(v_posto.nome, 'desconhecido')),
       'ponto_evento', v_evento_id),
      (v_colab.empresa_id, 'rh', 'divergencia_posto',
       format('Divergência de Posto — %s', v_colab.nome),
       format('Batida registrada no posto %s sem cobertura programada vinculada.', COALESCE(v_posto.nome, 'desconhecido')),
       'ponto_evento', v_evento_id);
  END IF;

  IF p_ambiguidade_detectada THEN
    INSERT INTO public.audit_logs (
      empresa_id, ator_auth_id, ator_colaborador_id, ator_nome, entidade, entidade_id, acao, detalhes
    ) VALUES (
      v_colab.empresa_id, v_uid, v_colab.id, v_colab.nome,
      'ponto_evento', v_evento_id, 'geofence_sobreposicao_detectada',
      jsonb_build_object('posto_selecionado_id', v_posto.id, 'distance_m', p_distance_m, 'accuracy_m', p_accuracy_m)
    );
  END IF;

  RETURN jsonb_build_object(
    'status', 'confirmado',
    'duplicado', FALSE,
    'evento_id', v_evento_id,
    'comprovante_numero', v_comprovante,
    'server_timestamp', v_now,
    'classificacao_posto', v_classificacao,
    'coverage_assignment_id', v_cobertura.id,
    'posto_detectado_id', v_posto.id,
    'posto_detectado_nome', v_posto.nome
  );
END;
$$;

-- 8. RPC Transacional de Substituição Emergencial (NÃO altera condominio_id permanente!)
CREATE OR REPLACE FUNCTION public.registrar_substituicao_emergencial(
  p_posto_id TEXT,
  p_substituto_id TEXT,
  p_colaborador_falta_id TEXT DEFAULT NULL,
  p_alerta_id TEXT DEFAULT NULL,
  p_data_inicio DATE DEFAULT CURRENT_DATE,
  p_data_fim DATE DEFAULT CURRENT_DATE,
  p_hora_inicio TIME DEFAULT '07:00',
  p_hora_fim TIME DEFAULT '19:00',
  p_motivo TEXT DEFAULT 'Substituição emergencial operacional'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_empresa TEXT;
  v_posto RECORD;
  v_sub RECORD;
  v_cov_id TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.' USING ERRCODE = '42501';
  END IF;

  SELECT role, empresa_id INTO v_role, v_empresa
  FROM public.profiles WHERE id = v_uid;

  IF COALESCE(v_role, '') NOT IN ('admin', 'supervisor') THEN
    RAISE EXCEPTION 'Apenas supervisão ou administração pode registrar substituição.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_posto FROM public.condominios WHERE id = p_posto_id;
  SELECT * INTO v_sub FROM public.colaboradores WHERE id = p_substituto_id;
  IF v_posto.id IS NULL OR v_sub.id IS NULL THEN
    RAISE EXCEPTION 'Posto ou colaborador substituto não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF v_empresa IS NOT NULL AND (v_posto.empresa_id <> v_empresa OR v_sub.empresa_id <> v_empresa) THEN
    RAISE EXCEPTION 'Violação de escopo de empresa.' USING ERRCODE = '42501';
  END IF;

  v_cov_id := 'cov-' || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.coberturas_programadas (
    id, empresa_id, colaborador_id, colaborador_nome,
    posto_principal_id, posto_cobertura_id, posto_cobertura_nome,
    tipo, data_inicio, data_fim, hora_inicio, hora_fim,
    motivo, substituido_colaborador_id, alerta_origem_id,
    valor_extra_ft, status, aceite_colaborador, criado_por, aprovado_por
  ) VALUES (
    v_cov_id, v_posto.empresa_id, v_sub.id, v_sub.nome,
    v_sub.condominio_id, v_posto.id, v_posto.nome,
    'substituicao', p_data_inicio, p_data_fim, p_hora_inicio, p_hora_fim,
    p_motivo, p_colaborador_falta_id, p_alerta_id,
    COALESCE(v_sub.valor_extra_ft, 0), 'aprovada', TRUE, v_uid, v_uid
  );

  INSERT INTO public.coberturas_historico (empresa_id, cobertura_id, acao, ator_id, detalhes)
  VALUES (v_posto.empresa_id, v_cov_id, 'criada', v_uid, p_motivo);

  -- Resolve somente o alerta específico informado (nunca outros alertas não relacionados)
  IF p_alerta_id IS NOT NULL THEN
    UPDATE public.alertas
    SET resolvido = TRUE,
        resolvido_em = NOW(),
        resolvido_por = v_uid::text
    WHERE id = p_alerta_id AND empresa_id = v_posto.empresa_id;
  END IF;

  IF p_colaborador_falta_id IS NOT NULL THEN
    UPDATE public.colaboradores
    SET status = 'falta',
        motivo_status = format('Substituído temporariamente por %s (%s)', v_sub.nome, p_data_inicio)
    WHERE id = p_colaborador_falta_id AND empresa_id = v_posto.empresa_id;
  END IF;

  INSERT INTO public.notificacoes_sistema (
    empresa_id, destinatario_colaborador_id, categoria, titulo, mensagem, referencia_tipo, referencia_id, link_destino
  ) VALUES (
    v_posto.empresa_id, v_sub.id, 'cobertura',
    format('Substituição programada em %s', v_posto.nome),
    format('Você foi designado para cobertura temporária no posto %s (%s a %s, %s-%s). Seu posto-base permanece inalterado.',
           v_posto.nome, p_data_inicio, p_data_fim, p_hora_inicio, p_hora_fim),
    'cobertura', v_cov_id, 'minha_escala'
  );

  RETURN jsonb_build_object(
    'cobertura_id', v_cov_id,
    'status', 'aprovada',
    'posto_id', v_posto.id,
    'substituto_id', v_sub.id
  );
END;
$$;
