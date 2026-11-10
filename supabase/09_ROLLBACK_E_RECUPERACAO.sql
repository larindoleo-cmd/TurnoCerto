-- ================================================================================
-- 09 — ROLLBACK_E_RECUPERACAO.sql
-- TurnoCerto: Procedimentos de Recuperação, Contingência e Rollback
-- Documentação e scripts de reversão controlada caso necessário
-- ================================================================================

-- AVISO IMPORTANTE:
-- Não execute este script em produção a menos que você queira reverter as migrações criadas.
-- Para dados já gravados, NUNCA utilize DROP SCHEMA ou TRUNCATE.

-- ================================================================================
-- ETAPA A: ROLLBACK DE TRIGGERS E FUNÇÕES (NÃO DESTRUTIVO)
-- ================================================================================
DROP TRIGGER IF EXISTS trigger_sync_condominio_posto ON public.condominios;
DROP FUNCTION IF EXISTS public.sync_condominio_to_posto();

DROP TRIGGER IF EXISTS trigger_condominios_updated_at ON public.condominios;
DROP TRIGGER IF EXISTS trigger_colaboradores_updated_at ON public.colaboradores;
DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS trigger_ocorrencias_updated_at ON public.ocorrencias;
DROP TRIGGER IF EXISTS trigger_alertas_updated_at ON public.alertas;
DROP TRIGGER IF EXISTS trigger_holerites_updated_at ON public.holerites;
DROP TRIGGER IF EXISTS trigger_pontos_updated_at ON public.pontos;
DROP TRIGGER IF EXISTS trigger_atestados_updated_at ON public.atestados;
DROP TRIGGER IF EXISTS trigger_empresa_info_updated_at ON public.empresa_info;

-- ================================================================================
-- ETAPA B: ROLLBACK DE ÍNDICES ADICIONAIS (NÃO DESTRUTIVO)
-- ================================================================================
DROP INDEX IF EXISTS public.idx_colaboradores_condominio_id;
DROP INDEX IF EXISTS public.idx_colaboradores_status;
DROP INDEX IF EXISTS public.idx_colaboradores_cpf;
DROP INDEX IF EXISTS public.idx_colaboradores_email;
DROP INDEX IF EXISTS public.idx_colaboradores_cargo;
DROP INDEX IF EXISTS public.idx_condominios_status;
DROP INDEX IF EXISTS public.idx_condominios_cnpj;
DROP INDEX IF EXISTS public.idx_condominios_nome;
DROP INDEX IF EXISTS public.idx_ocorrencias_posto_id;
DROP INDEX IF EXISTS public.idx_ocorrencias_resolvida;
DROP INDEX IF EXISTS public.idx_alertas_posto_id;
DROP INDEX IF EXISTS public.idx_alertas_resolvido;
DROP INDEX IF EXISTS public.idx_pontos_colaborador_data;
DROP INDEX IF EXISTS public.idx_holerites_colab_mes;
DROP INDEX IF EXISTS public.idx_atestados_colaborador_status;

-- ================================================================================
-- ETAPA C: ROLLBACK DE FOREIGN KEYS (PRESERVA DADOS, REMOVE APENAS TRAVAS)
-- ================================================================================
ALTER TABLE public.colaboradores DROP CONSTRAINT IF EXISTS fk_colaboradores_condominio;
ALTER TABLE public.ocorrencias DROP CONSTRAINT IF EXISTS fk_ocorrencias_posto;
ALTER TABLE public.alertas DROP CONSTRAINT IF EXISTS fk_alertas_posto;
ALTER TABLE public.pontos DROP CONSTRAINT IF EXISTS fk_pontos_colaborador;
ALTER TABLE public.atestados DROP CONSTRAINT IF EXISTS fk_atestados_colaborador;
ALTER TABLE public.holerites DROP CONSTRAINT IF EXISTS fk_holerites_colaborador;

-- ================================================================================
-- ETAPA D: BACKUP DE EMERGÊNCIA (CONSULTAS DE EXTRAÇÃO ANTES DE QUALQUER OPERAÇÃO)
-- ================================================================================
-- Execute e exporte como CSV no dashboard do Supabase caso queira guardar uma cópia:
-- SELECT * FROM public.colaboradores;
-- SELECT * FROM public.condominios;
-- SELECT * FROM public.ocorrencias;
-- SELECT * FROM public.alertas;
-- SELECT * FROM public.holerites;
-- SELECT * FROM public.pontos;
-- SELECT * FROM public.atestados;
-- SELECT * FROM public.empresa_info;
