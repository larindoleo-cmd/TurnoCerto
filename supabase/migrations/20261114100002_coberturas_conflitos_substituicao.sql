-- ============================================================================
-- TurnoCerto: Migração Incremental 20261114100002
-- Escopo:
--   1. Correção de fn_validar_conflito_cobertura() com interseção real de
--      intervalos absolutos em America/Sao_Paulo (turnos noturnos & fronteiras)
--   2. RPC responder_aceite_cobertura para colaborador aceitar/recusar cobertura
--   3. Controle de período na substituição emergencial e RPC de retorno ao posto
-- ============================================================================

-- 1. Controle de período de afastamento/substituição em colaboradores
ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS afastamento_inicio DATE,
  ADD COLUMN IF NOT EXISTS afastamento_fim DATE,
  ADD COLUMN IF NOT EXISTS substituicao_ativa_id TEXT;

-- 2. Função trigger compartilhada de conflito temporal (mesma regra do frontend)
CREATE OR REPLACE FUNCTION public.fn_validar_conflito_cobertura()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cov RECORD;
  v_dia_new DATE;
  v_dia_old DATE;
  v_new_start TIMESTAMPTZ;
  v_new_end TIMESTAMPTZ;
  v_old_start TIMESTAMPTZ;
  v_old_end TIMESTAMPTZ;
BEGIN
  IF NEW.status IN ('aguardando_aceite', 'aprovada', 'em_andamento') THEN
    FOR v_cov IN
      SELECT c.*
      FROM public.coberturas_programadas c
      WHERE c.colaborador_id = NEW.colaborador_id
        AND c.id <> NEW.id
        AND c.status IN ('aguardando_aceite', 'aprovada', 'em_andamento')
        AND daterange(c.data_inicio, c.data_fim + 1, '[]') && daterange(NEW.data_inicio, NEW.data_fim + 1, '[]')
    LOOP
      v_dia_new := NEW.data_inicio;
      WHILE v_dia_new <= NEW.data_fim LOOP
        v_new_start := ((v_dia_new::timestamp + NEW.hora_inicio) AT TIME ZONE 'America/Sao_Paulo');
        v_new_end := (
          ((CASE WHEN NEW.hora_fim <= NEW.hora_inicio THEN v_dia_new + 1 ELSE v_dia_new END)::timestamp + NEW.hora_fim)
          AT TIME ZONE 'America/Sao_Paulo'
        );

        v_dia_old := v_cov.data_inicio;
        WHILE v_dia_old <= v_cov.data_fim LOOP
          v_old_start := ((v_dia_old::timestamp + v_cov.hora_inicio) AT TIME ZONE 'America/Sao_Paulo');
          v_old_end := (
            ((CASE WHEN v_cov.hora_fim <= v_cov.hora_inicio THEN v_dia_old + 1 ELSE v_dia_old END)::timestamp + v_cov.hora_fim)
            AT TIME ZONE 'America/Sao_Paulo'
          );

          -- Intervalo semi-aberto [inicio, fim): intervalos exatamente adjacentes NÃO conflitam
          IF v_new_start < v_old_end AND v_new_end > v_old_start THEN
            RAISE EXCEPTION 'Conflito de horário: colaborador % já possui cobertura/extra ativa (%) com sobreposição real neste período.', NEW.colaborador_id, v_cov.id
              USING ERRCODE = '23P01';
          END IF;
          v_dia_old := v_dia_old + 1;
        END LOOP;

        v_dia_new := v_dia_new + 1;
      END LOOP;
    END LOOP;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- 3. RPC para aceite/recusa do próprio colaborador sem abrir UPDATE irrestrito na tabela
CREATE OR REPLACE FUNCTION public.responder_aceite_cobertura(
  p_cobertura_id TEXT,
  p_aceitar BOOLEAN,
  p_motivo_recusa TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_cov RECORD;
  v_colab_id TEXT;
  v_colab_nome TEXT;
  v_novo_status TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.' USING ERRCODE = '42501';
  END IF;

  SELECT c.id, c.nome INTO v_colab_id, v_colab_nome
  FROM public.colaboradores c
  WHERE c.auth_user_id = v_uid
  LIMIT 1;

  SELECT * INTO v_cov FROM public.coberturas_programadas WHERE id = p_cobertura_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cobertura não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  IF v_cov.colaborador_id IS DISTINCT FROM v_colab_id THEN
    RAISE EXCEPTION 'Apenas o colaborador designado pode responder ao aceite desta cobertura.' USING ERRCODE = '42501';
  END IF;

  IF v_cov.status NOT IN ('aguardando_aceite', 'aprovada') THEN
    RAISE EXCEPTION 'Cobertura no status % não permite alterar aceite.', v_cov.status USING ERRCODE = '22023';
  END IF;

  v_novo_status := CASE WHEN p_aceitar THEN 'aprovada' ELSE 'recusada' END;

  UPDATE public.coberturas_programadas
  SET status = v_novo_status,
      aceite_colaborador = p_aceitar,
      aceite_em = NOW(),
      recusa_motivo = CASE WHEN NOT p_aceitar THEN COALESCE(NULLIF(TRIM(p_motivo_recusa), ''), 'Recusado pelo colaborador') ELSE NULL END,
      updated_at = NOW()
  WHERE id = p_cobertura_id;

  INSERT INTO public.coberturas_historico (empresa_id, cobertura_id, acao, ator_id, ator_nome, detalhes)
  VALUES (
    v_cov.empresa_id, p_cobertura_id,
    CASE WHEN p_aceitar THEN 'aceita' ELSE 'recusada' END,
    v_uid, v_colab_nome,
    CASE WHEN p_aceitar THEN 'Aceite confirmado pelo colaborador.' ELSE COALESCE(p_motivo_recusa, 'Recusada pelo colaborador.') END
  );

  INSERT INTO public.notificacoes_sistema (
    empresa_id, destinatario_role, categoria, titulo, mensagem, referencia_tipo, referencia_id
  ) VALUES (
    v_cov.empresa_id, 'supervisor', 'cobertura',
    CASE WHEN p_aceitar THEN format('Cobertura aceita — %s', v_colab_nome) ELSE format('Cobertura recusada — %s', v_colab_nome) END,
    format('Posto %s (%s a %s). %s', COALESCE(v_cov.posto_cobertura_nome, v_cov.posto_cobertura_id), v_cov.data_inicio, v_cov.data_fim, COALESCE(p_motivo_recusa, '')),
    'cobertura', p_cobertura_id
  );

  RETURN jsonb_build_object('cobertura_id', p_cobertura_id, 'status', v_novo_status, 'aceite_colaborador', p_aceitar);
END;
$$;

-- 4. Atualização de registrar_substituicao_emergencial com janela de ausência + RPC de retorno
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

  SELECT role, empresa_id INTO v_role, v_empresa FROM public.profiles WHERE id = v_uid;
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

  IF p_alerta_id IS NOT NULL THEN
    UPDATE public.alertas
    SET resolvido = TRUE,
        resolvido_em = NOW()::text,
        resolvido_por = v_uid::text
    WHERE id = p_alerta_id AND empresa_id = v_posto.empresa_id;
  END IF;

  -- Registra ausência limitada ao período informado sem alterar posto-base nem escala original
  IF p_colaborador_falta_id IS NOT NULL THEN
    UPDATE public.colaboradores
    SET status = CASE WHEN CURRENT_DATE BETWEEN p_data_inicio AND p_data_fim THEN 'falta' ELSE status END,
        afastamento_inicio = p_data_inicio,
        afastamento_fim = p_data_fim,
        substituicao_ativa_id = v_cov_id,
        motivo_status = format('Substituído temporariamente por %s (%s a %s)', v_sub.nome, p_data_inicio, p_data_fim)
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
    'substituto_id', v_sub.id,
    'data_inicio', p_data_inicio,
    'data_fim', p_data_fim
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.retornar_colaborador_substituicao(
  p_colaborador_id TEXT,
  p_cobertura_id TEXT DEFAULT NULL
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
  v_colab RECORD;
  v_cov_id TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.' USING ERRCODE = '42501';
  END IF;

  SELECT role, empresa_id INTO v_role, v_empresa FROM public.profiles WHERE id = v_uid;
  IF COALESCE(v_role, '') NOT IN ('admin', 'supervisor', 'rh') THEN
    RAISE EXCEPTION 'Sem permissão para concluir substituição.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_colab FROM public.colaboradores WHERE id = p_colaborador_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Colaborador não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF v_empresa IS NOT NULL AND v_colab.empresa_id <> v_empresa THEN
    RAISE EXCEPTION 'Violação de escopo de empresa.' USING ERRCODE = '42501';
  END IF;

  v_cov_id := COALESCE(p_cobertura_id, v_colab.substituicao_ativa_id);

  UPDATE public.colaboradores
  SET status = 'no_posto',
      afastamento_inicio = NULL,
      afastamento_fim = NULL,
      substituicao_ativa_id = NULL,
      motivo_status = NULL,
      updated_at = NOW()
  WHERE id = p_colaborador_id;

  IF v_cov_id IS NOT NULL THEN
    UPDATE public.coberturas_programadas
    SET status = 'concluida', updated_at = NOW()
    WHERE id = v_cov_id
      AND empresa_id = v_colab.empresa_id
      AND status IN ('aprovada', 'em_andamento');

    INSERT INTO public.coberturas_historico (empresa_id, cobertura_id, acao, ator_id, detalhes)
    VALUES (v_colab.empresa_id, v_cov_id, 'concluida', v_uid, 'Colaborador titular retornado ao posto.');
  END IF;

  RETURN jsonb_build_object('colaborador_id', p_colaborador_id, 'status', 'no_posto', 'cobertura_id', v_cov_id);
END;
$$;

-- 5. RPCs Transacionais de Cobertura/Extra Programada (respeita RLS sem INSERT direto em histórico/notificações)
CREATE OR REPLACE FUNCTION public.criar_cobertura_programada_transacional(
  p_colaborador_id TEXT,
  p_posto_cobertura_id TEXT,
  p_tipo TEXT,
  p_data_inicio DATE,
  p_data_fim DATE,
  p_hora_inicio TIME,
  p_hora_fim TIME,
  p_motivo TEXT DEFAULT NULL,
  p_substituido_colaborador_id TEXT DEFAULT NULL,
  p_alerta_origem_id TEXT DEFAULT NULL,
  p_valor_extra_ft NUMERIC DEFAULT NULL,
  p_exige_aceite BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT := public.current_user_role();
  v_emp TEXT := public.current_empresa_id();
  v_ator_nome TEXT;
  v_colab RECORD;
  v_posto RECORD;
  v_cov_id TEXT;
  v_status TEXT;
BEGIN
  IF v_uid IS NULL OR v_emp IS NULL OR COALESCE(v_role, '') NOT IN ('admin', 'supervisor', 'rh') THEN
    RAISE EXCEPTION 'Apenas admin, supervisão ou RH pode programar coberturas/extras.' USING ERRCODE = '42501';
  END IF;

  IF p_data_fim < p_data_inicio THEN
    RAISE EXCEPTION 'Data final não pode ser anterior à data inicial.' USING ERRCODE = '22023';
  END IF;

  IF p_tipo NOT IN ('extra', 'cobertura', 'substituicao', 'alocacao_temporaria') THEN
    RAISE EXCEPTION 'Tipo de cobertura inválido.' USING ERRCODE = '22023';
  END IF;

  SELECT nome INTO v_ator_nome FROM public.profiles WHERE id = v_uid LIMIT 1;
  SELECT * INTO v_colab FROM public.colaboradores WHERE id = p_colaborador_id AND empresa_id = v_emp;
  SELECT * INTO v_posto FROM public.condominios WHERE id = p_posto_cobertura_id AND empresa_id = v_emp;
  IF v_colab.id IS NULL OR v_posto.id IS NULL THEN
    RAISE EXCEPTION 'Colaborador ou posto não encontrado no escopo da empresa.' USING ERRCODE = 'P0002';
  END IF;

  v_cov_id := 'cov-' || replace(gen_random_uuid()::text, '-', '');
  v_status := CASE WHEN COALESCE(p_exige_aceite, FALSE) THEN 'aguardando_aceite' ELSE 'aprovada' END;

  INSERT INTO public.coberturas_programadas (
    id, empresa_id, colaborador_id, colaborador_nome,
    posto_principal_id, posto_cobertura_id, posto_cobertura_nome,
    tipo, data_inicio, data_fim, hora_inicio, hora_fim,
    motivo, substituido_colaborador_id, alerta_origem_id,
    valor_extra_ft, status, aceite_colaborador, criado_por, criado_por_nome, aprovado_por
  ) VALUES (
    v_cov_id, v_emp, v_colab.id, v_colab.nome,
    v_colab.condominio_id, v_posto.id, v_posto.nome,
    p_tipo, p_data_inicio, p_data_fim, p_hora_inicio, p_hora_fim,
    p_motivo, p_substituido_colaborador_id, p_alerta_origem_id,
    COALESCE(p_valor_extra_ft, v_colab.valor_extra_ft, 0),
    v_status,
    CASE WHEN COALESCE(p_exige_aceite, FALSE) THEN NULL ELSE TRUE END,
    v_uid,
    COALESCE(v_ator_nome, 'Gestão'),
    CASE WHEN v_status = 'aprovada' THEN v_uid ELSE NULL END
  );

  INSERT INTO public.coberturas_historico (empresa_id, cobertura_id, acao, ator_id, ator_nome, detalhes)
  VALUES (
    v_emp, v_cov_id, 'criada', v_uid, COALESCE(v_ator_nome, 'Gestão'),
    format('%s em %s (%s a %s, %s-%s)', p_tipo, v_posto.nome, p_data_inicio, p_data_fim, p_hora_inicio, p_hora_fim)
  );

  INSERT INTO public.notificacoes_sistema (
    empresa_id, destinatario_colaborador_id, categoria, titulo, mensagem, referencia_tipo, referencia_id, link_destino
  ) VALUES (
    v_emp, v_colab.id, 'cobertura',
    CASE WHEN COALESCE(p_exige_aceite, FALSE)
      THEN format('Convite de %s em %s', CASE WHEN p_tipo = 'extra' THEN 'Extra/FT' ELSE 'Cobertura' END, v_posto.nome)
      ELSE format('Nova %s programada em %s', p_tipo, v_posto.nome)
    END,
    format('%s a %s (%s-%s). Seu posto-base permanece preservado.', p_data_inicio, p_data_fim, p_hora_inicio, p_hora_fim),
    'cobertura', v_cov_id, 'minha_escala'
  );

  RETURN jsonb_build_object(
    'cobertura_id', v_cov_id,
    'status', v_status,
    'aceite_colaborador', CASE WHEN COALESCE(p_exige_aceite, FALSE) THEN NULL ELSE TRUE END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.atualizar_status_cobertura_transacional(
  p_cobertura_id TEXT,
  p_novo_status TEXT,
  p_detalhes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT := public.current_user_role();
  v_emp TEXT := public.current_empresa_id();
  v_ator_nome TEXT;
  v_cov RECORD;
  v_acao TEXT;
BEGIN
  IF v_uid IS NULL OR v_emp IS NULL OR COALESCE(v_role, '') NOT IN ('admin', 'supervisor', 'rh') THEN
    RAISE EXCEPTION 'Apenas admin, supervisão ou RH pode atualizar status de cobertura.' USING ERRCODE = '42501';
  END IF;

  IF p_novo_status NOT IN ('aprovada', 'concluida', 'cancelada') THEN
    RAISE EXCEPTION 'Status de cobertura inválido: %', p_novo_status USING ERRCODE = '22023';
  END IF;

  SELECT nome INTO v_ator_nome FROM public.profiles WHERE id = v_uid LIMIT 1;
  SELECT * INTO v_cov FROM public.coberturas_programadas WHERE id = p_cobertura_id AND empresa_id = v_emp FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cobertura não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.coberturas_programadas
  SET status = p_novo_status,
      aprovado_por = CASE WHEN p_novo_status = 'aprovada' THEN COALESCE(aprovado_por, v_uid) ELSE aprovado_por END,
      updated_at = NOW()
  WHERE id = p_cobertura_id;

  v_acao := CASE WHEN p_novo_status = 'cancelada' THEN 'cancelada' WHEN p_novo_status = 'concluida' THEN 'concluida' ELSE 'aprovada' END;

  INSERT INTO public.coberturas_historico (empresa_id, cobertura_id, acao, ator_id, ator_nome, detalhes)
  VALUES (v_emp, p_cobertura_id, v_acao, v_uid, COALESCE(v_ator_nome, 'Gestão'), COALESCE(p_detalhes, format('Status alterado para %s.', p_novo_status)));

  RETURN jsonb_build_object('cobertura_id', p_cobertura_id, 'status', p_novo_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_cobertura_programada_transacional(TEXT, TEXT, TEXT, DATE, DATE, TIME, TIME, TEXT, TEXT, TEXT, NUMERIC, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atualizar_status_cobertura_transacional(TEXT, TEXT, TEXT) TO authenticated;

