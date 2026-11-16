-- ============================================================================
-- TurnoCerto: Migração Incremental 20261114100005
-- Escopo:
--   1. Metadados contábeis em holerites (FGTS informativo, origem_calculo)
--   2. Hardening de confirmar_ciencia_holerite (exige hash íntegro já salvo,
--      nunca confia em hash enviado pelo cliente para preencher campo nulo,
--      rotula como 'Recebimento confirmado')
--   3. RPC retificar_holerite_transacional (nova versão + hash antes de retificar anterior)
--   4. Hardening de publicar_lotes_holerites_agendados() (idempotência de notificação,
--      exige storage_path + pdf_sha256, alerta operacional de falha e EXECUTE apenas service_role)
-- ============================================================================

ALTER TABLE public.holerites
  ADD COLUMN IF NOT EXISTS origem_calculo TEXT DEFAULT 'folha_importada_validada',
  ADD COLUMN IF NOT EXISTS fgts_informativo NUMERIC(10, 2) DEFAULT 0.00;

UPDATE public.holerites
SET fgts_informativo = COALESCE(NULLIF(fgts_informativo, 0), desconto_fgts, 0.00)
WHERE fgts_informativo IS NULL OR fgts_informativo = 0;

-- Normaliza rótulo legado 'Assinado' sem apagar ciência histórica já registrada
UPDATE public.holerites
SET status_envio = 'Recebimento confirmado'
WHERE status_envio = 'Assinado'
  AND ciencia_confirmada_em IS NOT NULL;

-- 1. Hardening de Ciência de Holerite (não é assinatura qualificada ICP-Brasil)
CREATE OR REPLACE FUNCTION public.confirmar_ciencia_holerite(
  p_holerite_id TEXT,
  p_pdf_sha256 TEXT DEFAULT NULL,
  p_declaracao_versao TEXT DEFAULT 'v1-recebimento-nao-concordancia'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_hol RECORD;
  v_colab RECORD;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória para confirmar recebimento.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_hol FROM public.holerites WHERE id = p_holerite_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Holerite não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF v_hol.status_publicacao <> 'publicado' THEN
    RAISE EXCEPTION 'Somente holerites publicados podem receber confirmação de ciência.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_colab FROM public.colaboradores WHERE id = v_hol.colaborador_id;
  IF v_colab.auth_user_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Apenas o colaborador titular pode confirmar recebimento do próprio holerite.' USING ERRCODE = '42501';
  END IF;

  -- Exige hash gravado previamente na emissão/publicação no servidor; nunca aceita preenchimento pelo browser
  IF v_hol.pdf_sha256 IS NULL OR LENGTH(TRIM(v_hol.pdf_sha256)) < 32 THEN
    RAISE EXCEPTION 'Integridade do PDF ainda não validada no servidor. Contate o RH.' USING ERRCODE = '22023';
  END IF;

  IF p_pdf_sha256 IS NOT NULL AND p_pdf_sha256 <> v_hol.pdf_sha256 THEN
    RAISE EXCEPTION 'Hash do PDF divergente do documento armazenado no servidor.' USING ERRCODE = '22023';
  END IF;

  IF v_hol.ciencia_confirmada_em IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'ja_confirmado',
      'ciencia_confirmada_em', v_hol.ciencia_confirmada_em,
      'ciencia_declaracao_versao', v_hol.ciencia_declaracao_versao,
      'pdf_sha256', v_hol.pdf_sha256
    );
  END IF;

  UPDATE public.holerites
  SET status_envio = 'Recebimento confirmado',
      ciencia_confirmada_em = v_now,
      ciencia_usuario_id = v_uid,
      ciencia_declaracao_versao = p_declaracao_versao
  WHERE id = p_holerite_id;

  INSERT INTO public.holerite_eventos (
    empresa_id, holerite_id, lote_id, acao, ator_id, ator_nome, detalhes, metadata
  ) VALUES (
    v_hol.empresa_id, v_hol.id, v_hol.lote_id, 'ciencia_confirmada', v_uid, v_colab.nome,
    'Recebimento e ciência confirmados pelo colaborador titular (sem implicar concordância automática com verbas).',
    jsonb_build_object(
      'declaracao_versao', p_declaracao_versao,
      'pdf_sha256', v_hol.pdf_sha256,
      'competencia', COALESCE(v_hol.competencia, v_hol.mes_referencia)
    )
  );

  INSERT INTO public.audit_logs (
    empresa_id, ator_auth_id, ator_colaborador_id, ator_nome, entidade, entidade_id, acao, detalhes
  ) VALUES (
    v_hol.empresa_id, v_uid, v_colab.id, v_colab.nome,
    'holerite', v_hol.id, 'ciencia_recebimento_confirmada',
    jsonb_build_object('declaracao_versao', p_declaracao_versao, 'pdf_sha256', v_hol.pdf_sha256)
  );

  RETURN jsonb_build_object(
    'status', 'confirmado',
    'ciencia_confirmada_em', v_now,
    'ciencia_declaracao_versao', p_declaracao_versao,
    'pdf_sha256', v_hol.pdf_sha256
  );
END;
$$;

-- 2. RPC Transacional de Retificação (nova versão ativa antes de marcar anterior como retificada)
CREATE OR REPLACE FUNCTION public.retificar_holerite_transacional(
  p_holerite_anterior_id TEXT,
  p_novo_id TEXT,
  p_motivo TEXT,
  p_storage_path TEXT,
  p_pdf_sha256 TEXT,
  p_salario_base NUMERIC DEFAULT NULL,
  p_adicional_periculosidade NUMERIC DEFAULT NULL,
  p_adicional_noturno NUMERIC DEFAULT NULL,
  p_horas_extras_50 NUMERIC DEFAULT NULL,
  p_valor_horas_extras NUMERIC DEFAULT NULL,
  p_plantoes_ft INTEGER DEFAULT NULL,
  p_valor_ft NUMERIC DEFAULT NULL,
  p_desconto_inss NUMERIC DEFAULT NULL,
  p_fgts_informativo NUMERIC DEFAULT NULL,
  p_desconto_vt NUMERIC DEFAULT NULL,
  p_desconto_vr NUMERIC DEFAULT NULL,
  p_bonus_assiduidade NUMERIC DEFAULT NULL,
  p_liquido_receber NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_emp TEXT := public.current_empresa_id();
  v_ator TEXT;
  v_old RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_nova_versao INTEGER;
BEGIN
  IF v_uid IS NULL OR NOT public.is_rh_or_gestor() THEN
    RAISE EXCEPTION 'Apenas RH ou gestão pode retificar holerites.' USING ERRCODE = '42501';
  END IF;

  IF p_storage_path IS NULL OR p_pdf_sha256 IS NULL OR LENGTH(TRIM(p_pdf_sha256)) < 32 THEN
    RAISE EXCEPTION 'Upload do novo PDF e hash SHA-256 são obrigatórios antes da retificação.' USING ERRCODE = '22023';
  END IF;

  IF p_motivo IS NULL OR LENGTH(TRIM(p_motivo)) < 5 THEN
    RAISE EXCEPTION 'Motivo da retificação obrigatório.' USING ERRCODE = '22023';
  END IF;

  SELECT nome INTO v_ator FROM public.profiles WHERE id = v_uid LIMIT 1;
  SELECT * INTO v_old FROM public.holerites WHERE id = p_holerite_anterior_id AND empresa_id = v_emp FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Holerite anterior não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  v_nova_versao := COALESCE(v_old.versao, 1) + 1;

  -- Primeiro insere e confirma a nova versão publicada
  INSERT INTO public.holerites (
    id, empresa_id, colaborador_id, colaborador_nome, matricula, funcao, posto_nome,
    mes_referencia, competencia, ano_referencia,
    salario_base, adicional_periculosidade, adicional_noturno, horas_extras_50, valor_horas_extras,
    plantoes_ft, valor_ft, desconto_inss, desconto_fgts, fgts_informativo, desconto_vt, desconto_vr,
    bonus_assiduidade, bonus_ativo, liquido_receber, salario_liquido,
    status_envio, data_emissao, lote_id, versao, status_publicacao, publicado_em,
    storage_bucket, storage_path, pdf_sha256, retificado_de_id, motivo_retificacao, origem_calculo
  ) VALUES (
    p_novo_id, v_old.empresa_id, v_old.colaborador_id, v_old.colaborador_nome, v_old.matricula, v_old.funcao, v_old.posto_nome,
    v_old.mes_referencia, v_old.competencia, COALESCE(v_old.ano_referencia, EXTRACT(YEAR FROM v_now)::INTEGER),
    COALESCE(p_salario_base, v_old.salario_base),
    COALESCE(p_adicional_periculosidade, v_old.adicional_periculosidade),
    COALESCE(p_adicional_noturno, v_old.adicional_noturno),
    COALESCE(p_horas_extras_50, v_old.horas_extras_50),
    COALESCE(p_valor_horas_extras, v_old.valor_horas_extras),
    COALESCE(p_plantoes_ft, v_old.plantoes_ft, 0),
    COALESCE(p_valor_ft, v_old.valor_ft, 0),
    COALESCE(p_desconto_inss, v_old.desconto_inss),
    COALESCE(p_fgts_informativo, v_old.fgts_informativo, v_old.desconto_fgts, 0),
    COALESCE(p_fgts_informativo, v_old.fgts_informativo, v_old.desconto_fgts, 0),
    COALESCE(p_desconto_vt, v_old.desconto_vt),
    COALESCE(p_desconto_vr, v_old.desconto_vr),
    COALESCE(p_bonus_assiduidade, v_old.bonus_assiduidade),
    v_old.bonus_ativo,
    COALESCE(p_liquido_receber, v_old.liquido_receber),
    COALESCE(p_liquido_receber, v_old.liquido_receber),
    'Aguardando Confirmação',
    CURRENT_DATE,
    v_old.lote_id,
    v_nova_versao,
    'publicado',
    v_now,
    'documentos-holerites',
    p_storage_path,
    p_pdf_sha256,
    v_old.id,
    p_motivo,
    v_old.origem_calculo
  );

  -- Somente após inserir com sucesso a nova versão, marca a anterior como retificada
  UPDATE public.holerites
  SET status_publicacao = 'retificado',
      motivo_retificacao = p_motivo,
      updated_at = v_now
  WHERE id = v_old.id;

  INSERT INTO public.holerite_eventos (
    empresa_id, holerite_id, lote_id, acao, ator_id, ator_nome, detalhes
  ) VALUES
    (v_emp, v_old.id, v_old.lote_id, 'retificado', v_uid, COALESCE(v_ator, 'RH'), format('Substituído pela versão %s (%s): %s', v_nova_versao, p_novo_id, p_motivo)),
    (v_emp, p_novo_id, v_old.lote_id, 'publicado', v_uid, COALESCE(v_ator, 'RH'), format('Versão %s publicada por retificação.', v_nova_versao));

  INSERT INTO public.notificacoes_sistema (
    empresa_id, destinatario_colaborador_id, categoria, titulo, mensagem, referencia_tipo, referencia_id, link_destino
  ) VALUES (
    v_emp, v_old.colaborador_id, 'holerite',
    format('Holerite %s retificado (v%s)', v_old.mes_referencia, v_nova_versao),
    format('Uma nova versão corrigida do seu holerite (%s) está disponível para download e confirmação de recebimento.', v_old.mes_referencia),
    'holerite', p_novo_id, 'documentos'
  );

  RETURN jsonb_build_object('novo_id', p_novo_id, 'versao', v_nova_versao, 'retificado_de_id', v_old.id);
END;
$$;

-- 3. Hardening da publicação automática agendada (idempotência + validação de PDF + alerta em erro)
CREATE OR REPLACE FUNCTION public.publicar_lotes_holerites_agendados()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lote RECORD;
  v_hol RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_lotes_proc INTEGER := 0;
  v_itens_pub INTEGER := 0;
  v_itens_erro INTEGER := 0;
  v_ja_notificado BOOLEAN;
BEGIN
  FOR v_lote IN
    SELECT * FROM public.holerite_lotes
    WHERE status = 'agendado'
      AND agendado_para IS NOT NULL
      AND agendado_para <= v_now
    FOR UPDATE SKIP LOCKED
  LOOP
    v_lotes_proc := v_lotes_proc + 1;
    v_itens_erro := 0;

    UPDATE public.holerite_lotes
    SET status = 'publicando', tentativas = tentativas + 1, updated_at = v_now
    WHERE id = v_lote.id;

    BEGIN
      FOR v_hol IN
        SELECT * FROM public.holerites
        WHERE lote_id = v_lote.id
          AND status_publicacao IN ('rascunho', 'agendado', 'erro')
        FOR UPDATE
      LOOP
        -- Exige PDF armazenado e SHA-256 válido antes de liberar publicação ao funcionário
        IF v_hol.storage_path IS NULL OR LENGTH(TRIM(v_hol.storage_path)) = 0
           OR v_hol.pdf_sha256 IS NULL OR LENGTH(TRIM(v_hol.pdf_sha256)) < 32 THEN
          v_itens_erro := v_itens_erro + 1;
          UPDATE public.holerites
          SET status_publicacao = 'erro',
              ultimo_erro = 'PDF ausente no bucket privado ou SHA-256 não validado.'
          WHERE id = v_hol.id;

          INSERT INTO public.holerite_eventos (
            empresa_id, holerite_id, lote_id, acao, detalhes
          ) VALUES (
            v_hol.empresa_id, v_hol.id, v_lote.id, 'erro_publicacao',
            'Publicação bloqueada: PDF ausente no Storage privado ou hash SHA-256 ausente.'
          );
          CONTINUE;
        END IF;

        UPDATE public.holerites
        SET status_publicacao = 'publicado',
            publicado_em = COALESCE(publicado_em, v_now),
            status_envio = CASE WHEN ciencia_confirmada_em IS NOT NULL THEN 'Recebimento confirmado' ELSE 'Aguardando Confirmação' END,
            ultimo_erro = NULL
        WHERE id = v_hol.id;

        SELECT EXISTS (
          SELECT 1 FROM public.notificacoes_sistema ns
          WHERE ns.referencia_tipo = 'holerite'
            AND ns.referencia_id = v_hol.id
            AND ns.destinatario_colaborador_id = v_hol.colaborador_id
        ) INTO v_ja_notificado;

        IF NOT v_ja_notificado THEN
          INSERT INTO public.notificacoes_sistema (
            empresa_id, destinatario_colaborador_id, categoria, titulo, mensagem,
            referencia_tipo, referencia_id, link_destino
          ) VALUES (
            v_hol.empresa_id, v_hol.colaborador_id, 'holerite',
            format('Holerite %s disponível', v_hol.mes_referencia),
            format('Seu demonstrativo de pagamento (%s) foi publicado e está disponível para download e confirmação de recebimento.', v_hol.mes_referencia),
            'holerite', v_hol.id, 'documentos'
          );
        END IF;

        INSERT INTO public.holerite_eventos (
          empresa_id, holerite_id, lote_id, acao, detalhes
        ) VALUES (
          v_hol.empresa_id, v_hol.id, v_lote.id, 'publicado',
          format('Publicado automaticamente no horário agendado (%s).', v_now)
        );

        v_itens_pub := v_itens_pub + 1;
      END LOOP;

      IF v_itens_erro > 0 THEN
        UPDATE public.holerite_lotes
        SET status = 'erro',
            total_erros = v_itens_erro,
            ultimo_erro = format('%s item(ns) sem PDF/SHA-256 válido no bucket privado.', v_itens_erro),
            updated_at = v_now
        WHERE id = v_lote.id;

        INSERT INTO public.notificacoes_sistema (
          empresa_id, destinatario_role, categoria, titulo, mensagem, referencia_tipo, referencia_id, link_destino
        ) VALUES
          (v_lote.empresa_id, 'rh', 'holerite',
           format('Falha parcial no lote %s', v_lote.competencia_label),
           format('%s holerite(s) não puderam ser publicados por ausência de PDF/hash no Storage privado.', v_itens_erro),
           'holerite_lote', v_lote.id, 'rh'),
          (v_lote.empresa_id, 'admin', 'holerite',
           format('Falha parcial no lote %s', v_lote.competencia_label),
           format('%s holerite(s) não puderam ser publicados por ausência de PDF/hash no Storage privado.', v_itens_erro),
           'holerite_lote', v_lote.id, 'rh');
      ELSE
        UPDATE public.holerite_lotes
        SET status = 'publicado',
            publicado_em = v_now,
            ultimo_erro = NULL,
            total_erros = 0,
            updated_at = v_now
        WHERE id = v_lote.id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.holerite_lotes
      SET status = 'erro',
          ultimo_erro = SQLERRM,
          total_erros = total_erros + 1,
          updated_at = v_now
      WHERE id = v_lote.id;

      INSERT INTO public.notificacoes_sistema (
        empresa_id, destinatario_role, categoria, titulo, mensagem, referencia_tipo, referencia_id, link_destino
      ) VALUES
        (v_lote.empresa_id, 'rh', 'holerite',
         format('Erro no agendamento do lote %s', v_lote.competencia_label),
         format('Falha automática ao publicar lote: %s', SQLERRM),
         'holerite_lote', v_lote.id, 'rh');
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'lotes_processados', v_lotes_proc,
    'itens_publicados', v_itens_pub,
    'itens_com_erro', v_itens_erro,
    'executado_em', v_now
  );
END;
$$;

-- Garantir execução exclusiva pelo backend autorizado (Edge Function com service_role)
REVOKE ALL ON FUNCTION public.publicar_lotes_holerites_agendados() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publicar_lotes_holerites_agendados() TO service_role;
GRANT EXECUTE ON FUNCTION public.confirmar_ciencia_holerite(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.retificar_holerite_transacional(TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, INTEGER, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO authenticated;

-- 4. RPCs Transacionais para emissão de item em lote e publicação manual (com validação server-side de PDF/hash e notificações)
CREATE OR REPLACE FUNCTION public.emitir_item_holerite_transacional(
  p_holerite_id TEXT,
  p_lote_id TEXT,
  p_colaborador_id TEXT,
  p_competencia TEXT,
  p_mes_referencia TEXT,
  p_salario_base NUMERIC,
  p_adicional_periculosidade NUMERIC,
  p_adicional_noturno NUMERIC,
  p_horas_extras_50 NUMERIC,
  p_valor_horas_extras NUMERIC,
  p_plantoes_ft INTEGER,
  p_valor_ft NUMERIC,
  p_desconto_inss NUMERIC,
  p_fgts_informativo NUMERIC,
  p_desconto_vt NUMERIC,
  p_desconto_vr NUMERIC,
  p_bonus_assiduidade NUMERIC,
  p_bonus_ativo BOOLEAN,
  p_liquido_receber NUMERIC,
  p_status_publicacao TEXT,
  p_agendado_para TIMESTAMPTZ DEFAULT NULL,
  p_storage_path TEXT DEFAULT NULL,
  p_pdf_sha256 TEXT DEFAULT NULL,
  p_origem_calculo TEXT DEFAULT 'folha_importada_validada'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_emp TEXT := public.current_empresa_id();
  v_ator TEXT;
  v_colab RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_status_envio TEXT;
  v_ja_notificado BOOLEAN;
BEGIN
  IF v_uid IS NULL OR v_emp IS NULL OR NOT public.is_rh_or_gestor() THEN
    RAISE EXCEPTION 'Apenas RH ou gestão pode emitir holerites.' USING ERRCODE = '42501';
  END IF;

  IF p_status_publicacao NOT IN ('rascunho', 'agendado', 'publicado') THEN
    RAISE EXCEPTION 'Status de publicação inválido.' USING ERRCODE = '22023';
  END IF;

  IF p_status_publicacao <> 'rascunho' AND (p_storage_path IS NULL OR LENGTH(TRIM(p_storage_path)) = 0 OR p_pdf_sha256 IS NULL OR LENGTH(TRIM(p_pdf_sha256)) < 32) THEN
    RAISE EXCEPTION 'PDF armazenado e hash SHA-256 são obrigatórios para agendamento ou publicação.' USING ERRCODE = '22023';
  END IF;

  SELECT nome INTO v_ator FROM public.profiles WHERE id = v_uid LIMIT 1;
  SELECT * INTO v_colab FROM public.colaboradores WHERE id = p_colaborador_id AND empresa_id = v_emp;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Colaborador não encontrado no escopo da empresa.' USING ERRCODE = 'P0002';
  END IF;

  v_status_envio := CASE WHEN p_status_publicacao = 'publicado' THEN 'Aguardando Confirmação' ELSE 'Pendente' END;

  INSERT INTO public.holerites (
    id, empresa_id, colaborador_id, colaborador_nome, matricula, funcao, posto_nome,
    mes_referencia, competencia, ano_referencia,
    salario_base, adicional_periculosidade, adicional_noturno, horas_extras_50, valor_horas_extras,
    plantoes_ft, valor_ft, desconto_inss, desconto_fgts, fgts_informativo, desconto_vt, desconto_vr,
    bonus_assiduidade, bonus_ativo, liquido_receber, salario_liquido,
    status_envio, data_emissao, lote_id, versao, status_publicacao, agendado_para, publicado_em,
    storage_bucket, storage_path, pdf_sha256, origem_calculo
  ) VALUES (
    p_holerite_id, v_emp, v_colab.id, v_colab.nome, v_colab.matricula, v_colab.funcao, COALESCE(v_colab.posto_nome, 'Matriz'),
    p_mes_referencia, p_competencia, EXTRACT(YEAR FROM v_now)::INTEGER,
    p_salario_base, p_adicional_periculosidade, p_adicional_noturno, p_horas_extras_50, p_valor_horas_extras,
    COALESCE(p_plantoes_ft, 0), COALESCE(p_valor_ft, 0), p_desconto_inss, p_fgts_informativo, p_fgts_informativo, p_desconto_vt, p_desconto_vr,
    COALESCE(p_bonus_assiduidade, 0), COALESCE(p_bonus_ativo, TRUE), p_liquido_receber, p_liquido_receber,
    v_status_envio, to_char(v_now AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY'),
    p_lote_id, 1, p_status_publicacao, p_agendado_para,
    CASE WHEN p_status_publicacao = 'publicado' THEN v_now ELSE NULL END,
    'documentos-holerites', p_storage_path, p_pdf_sha256, COALESCE(p_origem_calculo, 'folha_importada_validada')
  );

  INSERT INTO public.holerite_eventos (
    empresa_id, holerite_id, lote_id, acao, ator_id, ator_nome, detalhes
  ) VALUES (
    v_emp, p_holerite_id, p_lote_id,
    CASE WHEN p_status_publicacao = 'publicado' THEN 'publicado' WHEN p_status_publicacao = 'agendado' THEN 'agendado' ELSE 'rascunho_criado' END,
    v_uid, COALESCE(v_ator, 'RH'),
    format('Holerite %s v1 (%s) · SHA256 %s.', p_mes_referencia, p_status_publicacao, LEFT(COALESCE(p_pdf_sha256, ''), 12))
  );

  IF p_status_publicacao = 'publicado' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.notificacoes_sistema ns
      WHERE ns.referencia_tipo = 'holerite'
        AND ns.referencia_id = p_holerite_id
        AND ns.destinatario_colaborador_id = v_colab.id
    ) INTO v_ja_notificado;

    IF NOT v_ja_notificado THEN
      INSERT INTO public.notificacoes_sistema (
        empresa_id, destinatario_colaborador_id, categoria, titulo, mensagem, referencia_tipo, referencia_id, link_destino
      ) VALUES (
        v_emp, v_colab.id, 'holerite',
        format('Holerite %s disponível', p_mes_referencia),
        format('Seu demonstrativo de pagamento (%s) foi publicado. Confirme o recebimento na aba Documentos.', p_mes_referencia),
        'holerite', p_holerite_id, 'documentos'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('holerite_id', p_holerite_id, 'status_publicacao', p_status_publicacao);
END;
$$;

CREATE OR REPLACE FUNCTION public.publicar_lote_holerites_manual_transacional(p_lote_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_emp TEXT := public.current_empresa_id();
  v_ator TEXT;
  v_lote RECORD;
  v_hol RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_pub_count INTEGER := 0;
  v_ja_notificado BOOLEAN;
BEGIN
  IF v_uid IS NULL OR v_emp IS NULL OR NOT public.is_rh_or_gestor() THEN
    RAISE EXCEPTION 'Apenas RH ou gestão pode publicar lotes de holerite.' USING ERRCODE = '42501';
  END IF;

  SELECT nome INTO v_ator FROM public.profiles WHERE id = v_uid LIMIT 1;
  SELECT * INTO v_lote FROM public.holerite_lotes WHERE id = p_lote_id AND empresa_id = v_emp FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote de holerites não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  FOR v_hol IN
    SELECT * FROM public.holerites
    WHERE lote_id = p_lote_id AND empresa_id = v_emp
      AND status_publicacao IN ('rascunho', 'agendado', 'erro')
    FOR UPDATE
  LOOP
    IF v_hol.storage_path IS NULL OR LENGTH(TRIM(v_hol.storage_path)) = 0
       OR v_hol.pdf_sha256 IS NULL OR LENGTH(TRIM(v_hol.pdf_sha256)) < 32 THEN
      RAISE EXCEPTION 'Holerite % (%s) sem PDF ou SHA-256 no Storage privado.', v_hol.id, v_hol.colaborador_nome USING ERRCODE = '22023';
    END IF;

    UPDATE public.holerites
    SET status_publicacao = 'publicado',
        publicado_em = COALESCE(publicado_em, v_now),
        status_envio = CASE WHEN ciencia_confirmada_em IS NOT NULL THEN 'Recebimento confirmado' ELSE 'Aguardando Confirmação' END,
        ultimo_erro = NULL
    WHERE id = v_hol.id;

    SELECT EXISTS (
      SELECT 1 FROM public.notificacoes_sistema ns
      WHERE ns.referencia_tipo = 'holerite'
        AND ns.referencia_id = v_hol.id
        AND ns.destinatario_colaborador_id = v_hol.colaborador_id
    ) INTO v_ja_notificado;

    IF NOT v_ja_notificado THEN
      INSERT INTO public.notificacoes_sistema (
        empresa_id, destinatario_colaborador_id, categoria, titulo, mensagem, referencia_tipo, referencia_id, link_destino
      ) VALUES (
        v_emp, v_hol.colaborador_id, 'holerite',
        format('Holerite %s disponível', v_hol.mes_referencia),
        format('Seu demonstrativo de pagamento (%s) foi publicado para consulta e confirmação de recebimento.', v_hol.mes_referencia),
        'holerite', v_hol.id, 'documentos'
      );
    END IF;

    v_pub_count := v_pub_count + 1;
  END LOOP;

  UPDATE public.holerite_lotes
  SET status = 'publicado',
      publicado_em = v_now,
      total_erros = 0,
      ultimo_erro = NULL,
      updated_at = v_now
  WHERE id = p_lote_id;

  INSERT INTO public.holerite_eventos (
    empresa_id, lote_id, acao, ator_id, ator_nome, detalhes
  ) VALUES (
    v_emp, p_lote_id, 'publicado', v_uid, COALESCE(v_ator, 'RH'),
    format('Lote %s publicado manualmente pelo RH (%s itens).', v_lote.competencia_label, v_pub_count)
  );

  RETURN jsonb_build_object('lote_id', p_lote_id, 'status', 'publicado', 'itens_publicados', v_pub_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.emitir_item_holerite_transacional(TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, INTEGER, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, NUMERIC, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publicar_lote_holerites_manual_transacional(TEXT) TO authenticated;

