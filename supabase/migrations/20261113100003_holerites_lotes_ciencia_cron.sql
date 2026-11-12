-- ============================================================================
-- TurnoCerto: Migração Incremental 20261113100003
-- Escopo: Holerites em Lote, Agendamento Real (America/Sao_Paulo), Retificação,
--         Logs/Retentativa e Confirmação de Recebimento e Ciência
-- ============================================================================

-- 1. Lotes de Folha / Holerites
CREATE TABLE IF NOT EXISTS public.holerite_lotes (
  id TEXT PRIMARY KEY DEFAULT ('lote-' || replace(gen_random_uuid()::text, '-', '')),
  empresa_id TEXT NOT NULL DEFAULT 'emp-matriz-principal' REFERENCES public.empresas(id) ON DELETE RESTRICT,
  competencia TEXT NOT NULL, -- Ex: '2026-04' ou 'Abril/2026'
  competencia_label TEXT NOT NULL,
  titulo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (
    status IN ('rascunho', 'agendado', 'publicando', 'publicado', 'erro', 'retificado')
  ),
  agendado_para TIMESTAMPTZ,
  publicado_em TIMESTAMPTZ,
  total_itens INTEGER NOT NULL DEFAULT 0,
  total_erros INTEGER NOT NULL DEFAULT 0,
  ultimo_erro TEXT,
  tentativas INTEGER NOT NULL DEFAULT 0,
  criado_por UUID,
  criado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_holerite_lotes_status_agenda
  ON public.holerite_lotes(empresa_id, status, agendado_para);

-- 2. Extensão Incremental de holerites (sem remover colunas existentes)
ALTER TABLE public.holerites
  ADD COLUMN IF NOT EXISTS lote_id TEXT REFERENCES public.holerite_lotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS versao INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS competencia TEXT,
  ADD COLUMN IF NOT EXISTS status_publicacao TEXT NOT NULL DEFAULT 'rascunho' CHECK (
    status_publicacao IN ('rascunho', 'agendado', 'publicado', 'erro', 'retificado')
  ),
  ADD COLUMN IF NOT EXISTS agendado_para TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS publicado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS storage_bucket TEXT DEFAULT 'documentos-holerites',
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS pdf_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS retificado_de_id TEXT REFERENCES public.holerites(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motivo_retificacao TEXT,
  ADD COLUMN IF NOT EXISTS ciencia_confirmada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ciencia_usuario_id UUID,
  ADD COLUMN IF NOT EXISTS ciencia_declaracao_versao TEXT,
  ADD COLUMN IF NOT EXISTS ultimo_erro TEXT;

CREATE INDEX IF NOT EXISTS idx_holerites_lote_status
  ON public.holerites(empresa_id, lote_id, status_publicacao);
CREATE INDEX IF NOT EXISTS idx_holerites_colab_publicacao
  ON public.holerites(colaborador_id, status_publicacao, versao DESC);

-- Garantir no máximo uma ciência gravada por versão do holerite e logar eventos
CREATE TABLE IF NOT EXISTS public.holerite_eventos (
  id TEXT PRIMARY KEY DEFAULT ('holev-' || replace(gen_random_uuid()::text, '-', '')),
  empresa_id TEXT NOT NULL DEFAULT 'emp-matriz-principal' REFERENCES public.empresas(id) ON DELETE RESTRICT,
  holerite_id TEXT REFERENCES public.holerites(id) ON DELETE CASCADE,
  lote_id TEXT REFERENCES public.holerite_lotes(id) ON DELETE CASCADE,
  acao TEXT NOT NULL CHECK (
    acao IN ('rascunho_criado', 'agendado', 'publicado', 'erro_publicacao', 'retificado', 'pdf_gerado', 'baixado', 'ciencia_confirmada', 'reprocessado')
  ),
  ator_id UUID,
  ator_nome TEXT,
  detalhes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_holerite_eventos_hol
  ON public.holerite_eventos(holerite_id, created_at DESC);

-- 3. RPC de Confirmação de Recebimento e Ciência (NÃO é assinatura ICP-Brasil)
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

  SELECT * INTO v_hol FROM public.holerites WHERE id = p_holerite_id;
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

  IF v_hol.ciencia_confirmada_em IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'ja_confirmado',
      'ciencia_confirmada_em', v_hol.ciencia_confirmada_em,
      'ciencia_declaracao_versao', v_hol.ciencia_declaracao_versao
    );
  END IF;

  UPDATE public.holerites
  SET status_envio = 'Assinado',
      ciencia_confirmada_em = v_now,
      ciencia_usuario_id = v_uid,
      ciencia_declaracao_versao = p_declaracao_versao,
      pdf_sha256 = COALESCE(pdf_sha256, p_pdf_sha256)
  WHERE id = p_holerite_id;

  INSERT INTO public.holerite_eventos (
    empresa_id, holerite_id, lote_id, acao, ator_id, ator_nome, detalhes, metadata
  ) VALUES (
    v_hol.empresa_id, v_hol.id, v_hol.lote_id, 'ciencia_confirmada', v_uid, v_colab.nome,
    'Recebimento e ciência confirmados pelo colaborador (não implica concordância automática com verbas).',
    jsonb_build_object('declaracao_versao', p_declaracao_versao, 'pdf_sha256', COALESCE(v_hol.pdf_sha256, p_pdf_sha256))
  );

  RETURN jsonb_build_object(
    'status', 'confirmado',
    'ciencia_confirmada_em', v_now,
    'ciencia_declaracao_versao', p_declaracao_versao
  );
END;
$$;

-- 4. RPC Executada por Edge Function / Cron / Cloudflare Worker para Publicar Lotes Agendados
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
BEGIN
  FOR v_lote IN
    SELECT * FROM public.holerite_lotes
    WHERE status = 'agendado'
      AND agendado_para IS NOT NULL
      AND agendado_para <= v_now
    FOR UPDATE SKIP LOCKED
  LOOP
    v_lotes_proc := v_lotes_proc + 1;

    UPDATE public.holerite_lotes
    SET status = 'publicando', tentativas = tentativas + 1, updated_at = v_now
    WHERE id = v_lote.id;

    BEGIN
      FOR v_hol IN
        SELECT * FROM public.holerites
        WHERE lote_id = v_lote.id
          AND status_publicacao IN ('rascunho', 'agendado', 'erro')
      LOOP
        UPDATE public.holerites
        SET status_publicacao = 'publicado',
            publicado_em = COALESCE(publicado_em, v_now),
            status_envio = CASE WHEN ciencia_confirmada_em IS NOT NULL THEN 'Assinado' ELSE 'Aguardando Assinatura' END,
            ultimo_erro = NULL
        WHERE id = v_hol.id;

        INSERT INTO public.notificacoes_sistema (
          empresa_id, destinatario_colaborador_id, categoria, titulo, mensagem,
          referencia_tipo, referencia_id, link_destino
        ) VALUES (
          v_hol.empresa_id, v_hol.colaborador_id, 'holerite',
          format('Holerite %s disponível', v_hol.mes_referencia),
          format('Seu demonstrativo de pagamento (%s) foi publicado e está disponível para download e ciência.', v_hol.mes_referencia),
          'holerite', v_hol.id, 'documentos'
        );

        INSERT INTO public.holerite_eventos (
          empresa_id, holerite_id, lote_id, acao, detalhes
        ) VALUES (
          v_hol.empresa_id, v_hol.id, v_lote.id, 'publicado',
          format('Publicado automaticamente no horário agendado (%s).', v_now)
        );

        v_itens_pub := v_itens_pub + 1;
      END LOOP;

      UPDATE public.holerite_lotes
      SET status = 'publicado',
          publicado_em = v_now,
          ultimo_erro = NULL,
          total_erros = 0,
          updated_at = v_now
      WHERE id = v_lote.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.holerite_lotes
      SET status = 'erro',
          ultimo_erro = SQLERRM,
          total_erros = total_erros + 1,
          updated_at = v_now
      WHERE id = v_lote.id;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'lotes_processados', v_lotes_proc,
    'itens_publicados', v_itens_pub,
    'executado_em', v_now
  );
END;
$$;
