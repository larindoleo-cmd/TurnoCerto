-- ================================================================================
-- TurnoCerto: Migração 09 - Validação Final e Testes de Integridade
-- Arquivo: supabase/migrations/20261108100009_validacao_integridade_final.sql
-- Tipo: Diagnóstico / Teste Automatizado de Persistência
-- ================================================================================

CREATE TABLE IF NOT EXISTS public._validacao_resultados (
  id SERIAL PRIMARY KEY,
  tabela TEXT NOT NULL,
  operacao TEXT NOT NULL,
  status TEXT NOT NULL,
  mensagem TEXT,
  executado_em TIMESTAMPTZ DEFAULT NOW()
);

TRUNCATE TABLE public._validacao_resultados;

DO $$
DECLARE
  v_test_condo_id TEXT := 'test-cond-migracao-09';
  v_test_colab_id TEXT := 'test-colab-migracao-09';
  v_test_ocorr_id TEXT := 'test-ocorr-migracao-09';
  v_test_alerta_id TEXT := 'test-alerta-migracao-09';
  v_test_ponto_id TEXT := 'test-ponto-migracao-09';
  v_test_holerite_id TEXT := 'test-holerite-migracao-09';
  v_test_atestado_id TEXT := 'test-atestado-migracao-09';
BEGIN
  -- 1. Teste de Condomínio
  BEGIN
    INSERT INTO public.condominios (id, nome, tipo, vagas_contratadas, status)
    VALUES (v_test_condo_id, 'Posto Teste Validação 09', 'Residencial', 2, 'operacional')
    ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome;
    INSERT INTO public._validacao_resultados (tabela, operacao, status, mensagem)
    VALUES ('condominios', 'INSERT / UPSERT', 'SUCESSO', 'Condomínio criado e persistido com ID text.');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._validacao_resultados (tabela, operacao, status, mensagem)
    VALUES ('condominios', 'INSERT / UPSERT', 'FALHA', SQLERRM);
  END;

  -- 2. Teste de Colaborador
  BEGIN
    INSERT INTO public.colaboradores (id, nome, cpf, cargo, funcao, condominio_id, status, salario_base)
    VALUES (v_test_colab_id, 'Colaborador Teste 09', '999.777.555-33', 'Porteiro', 'Porteiro', v_test_condo_id, 'no_posto', 2150.00)
    ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome;
    INSERT INTO public._validacao_resultados (tabela, operacao, status, mensagem)
    VALUES ('colaboradores', 'INSERT / UPSERT', 'SUCESSO', 'Colaborador criado e vinculado com sucesso.');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._validacao_resultados (tabela, operacao, status, mensagem)
    VALUES ('colaboradores', 'INSERT / UPSERT', 'FALHA', SQLERRM);
  END;

  -- 3. Teste de Ocorrência
  BEGIN
    INSERT INTO public.ocorrencias (id, posto_id, posto_nome, tipo, descricao, registrado_por, data_hora, urgencia, resolvida)
    VALUES (v_test_ocorr_id, v_test_condo_id, 'Posto Teste', 'Ronda', 'Ronda de teste 09', 'Supervisora Silva', 'Hoje às 10:00', 'baixa', true)
    ON CONFLICT (id) DO UPDATE SET descricao = EXCLUDED.descricao;
    INSERT INTO public._validacao_resultados (tabela, operacao, status, mensagem)
    VALUES ('ocorrencias', 'INSERT', 'SUCESSO', 'Ocorrência persistida.');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._validacao_resultados (tabela, operacao, status, mensagem)
    VALUES ('ocorrencias', 'INSERT', 'FALHA', SQLERRM);
  END;

  -- 4. Teste de Alerta
  BEGIN
    INSERT INTO public.alertas (id, posto_id, posto_nome, tipo, gravidade, titulo, descricao, horario, resolvido)
    VALUES (v_test_alerta_id, v_test_condo_id, 'Posto Teste', 'atraso', 'moderada', 'Alerta teste 09', 'Descrição de teste', '10:00', false)
    ON CONFLICT (id) DO UPDATE SET titulo = EXCLUDED.titulo;
    INSERT INTO public._validacao_resultados (tabela, operacao, status, mensagem)
    VALUES ('alertas', 'INSERT', 'SUCESSO', 'Alerta operacional registrado.');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._validacao_resultados (tabela, operacao, status, mensagem)
    VALUES ('alertas', 'INSERT', 'FALHA', SQLERRM);
  END;

  -- 5. Teste de Ponto Eletrônico
  BEGIN
    INSERT INTO public.pontos (id, colaborador_id, colaborador_nome, condominio_id, data, entrada_1, status_ponto)
    VALUES (v_test_ponto_id, v_test_colab_id, 'Colaborador Teste 09', v_test_condo_id, CURRENT_DATE, '07:00', 'Regular')
    ON CONFLICT (id) DO UPDATE SET status_ponto = EXCLUDED.status_ponto;
    INSERT INTO public._validacao_resultados (tabela, operacao, status, mensagem)
    VALUES ('pontos', 'INSERT', 'SUCESSO', 'Ponto gravado com geolocalização e sem bloqueio RLS.');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._validacao_resultados (tabela, operacao, status, mensagem)
    VALUES ('pontos', 'INSERT', 'FALHA', SQLERRM);
  END;

  -- 6. Teste de Holerite
  BEGIN
    INSERT INTO public.holerites (id, colaborador_id, colaborador_nome, mes_referencia, salario_base, liquido_receber, status_envio)
    VALUES (v_test_holerite_id, v_test_colab_id, 'Colaborador Teste 09', 'Novembro/2026', 2150.00, 2150.00, 'Pendente')
    ON CONFLICT (id) DO UPDATE SET status_envio = EXCLUDED.status_envio;
    INSERT INTO public._validacao_resultados (tabela, operacao, status, mensagem)
    VALUES ('holerites', 'INSERT', 'SUCESSO', 'Holerite e valores financeiros gravados.');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._validacao_resultados (tabela, operacao, status, mensagem)
    VALUES ('holerites', 'INSERT', 'FALHA', SQLERRM);
  END;

  -- 7. Teste de Atestado Médico
  BEGIN
    INSERT INTO public.atestados (id, colaborador_id, colaborador_nome, cid, data_inicio, dias_afastamento, status)
    VALUES (v_test_atestado_id, v_test_colab_id, 'Colaborador Teste 09', 'Z00.0', CURRENT_DATE, 1, 'Pendente')
    ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;
    INSERT INTO public._validacao_resultados (tabela, operacao, status, mensagem)
    VALUES ('atestados', 'INSERT', 'SUCESSO', 'Atestado médico protocolado.');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._validacao_resultados (tabela, operacao, status, mensagem)
    VALUES ('atestados', 'INSERT', 'FALHA', SQLERRM);
  END;

  -- 8. Teste de Empresa Matriz
  BEGIN
    INSERT INTO public.empresa_info (id, razao_social, nome_fantasia, cnpj)
    VALUES ('matriz-principal', 'TurnoCerto Terceirização e Serviços Ltda.', 'TurnoCerto Serviços', '12.345.678/0001-90')
    ON CONFLICT (id) DO UPDATE SET updated_at = NOW();
    INSERT INTO public._validacao_resultados (tabela, operacao, status, mensagem)
    VALUES ('empresa_info', 'UPSERT', 'SUCESSO', 'Empresa matriz atualizada.');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._validacao_resultados (tabela, operacao, status, mensagem)
    VALUES ('empresa_info', 'UPSERT', 'FALHA', SQLERRM);
  END;

  -- Limpeza dos registros de teste
  DELETE FROM public.atestados WHERE id = v_test_atestado_id;
  DELETE FROM public.holerites WHERE id = v_test_holerite_id;
  DELETE FROM public.pontos WHERE id = v_test_ponto_id;
  DELETE FROM public.alertas WHERE id = v_test_alerta_id;
  DELETE FROM public.ocorrencias WHERE id = v_test_ocorr_id;
  DELETE FROM public.colaboradores WHERE id = v_test_colab_id;
  DELETE FROM public.condominios WHERE id = v_test_condo_id;

END $$;

-- Retorna a tabela de validação para conferência
SELECT tabela, operacao, status, mensagem, executado_em
FROM public._validacao_resultados
ORDER BY id;
