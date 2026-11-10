# PLANO DE ROLLBACK, RECUPERAÇÃO E CONTINGÊNCIA (ROLLBACK_PLAN.md)
## SISTEMA OPERACIONAL TURNOCERTO — SUPABASE / POSTGRESQL

Este documento descreve os procedimentos formais de recuperação de desastres, reversão de alterações estruturais e planos de contingência caso seja necessário reverter etapas específicas da migração sem causar perda de dados operacionais ou indisponibilidade no aplicativo.

---

## 1. PRINCÍPIOS GERAIS DO ROLLBACK

1. **Preservação Absoluta dos Dados Legítimos:** O rollback nunca deve executar `DROP TABLE` ou `TRUNCATE` em tabelas que já contenham cadastros ou registros de clientes.
2. **Reversibilidade Granular:** As alterações foram desenhadas em camadas independentes (Triggers, Índices, RLS, Constraints, Colunas). É possível reverter uma camada isolada (por exemplo, desativar um gatilho) mantendo as tabelas intactas.
3. **Backup Antes da Execução:** Recomenda-se realizar um dump prévio das tabelas existentes via Supabase Dashboard ou `pg_dump`:
   ```bash
   pg_dump -h db.cyyvubiythuzhdwbuogg.supabase.co -U postgres -d postgres -t condominios -t colaboradores -t profiles > backup_pre_migracao.sql
   ```

---

## 2. PROCEDIMENTOS DE REVERSÃO POR CAMADA

### 2.1. Reversão de Gatilhos e Triggers (Camada 7)
Se algum gatilho apresentar comportamento inesperado ou lentidão durante altas cargas de trabalho:
```sql
-- Desativação segura dos triggers
DROP TRIGGER IF EXISTS trigger_sync_condominio_to_posto ON public.condominios;
DROP TRIGGER IF EXISTS trigger_recalcular_vagas_condominio ON public.colaboradores;
DROP TRIGGER IF EXISTS trigger_colaboradores_updated_at ON public.colaboradores;
DROP TRIGGER IF EXISTS trigger_condominios_updated_at ON public.condominios;
DROP TRIGGER IF EXISTS trigger_ocorrencias_updated_at ON public.ocorrencias;
DROP TRIGGER IF EXISTS trigger_alertas_updated_at ON public.alertas;
DROP TRIGGER IF EXISTS trigger_holerites_updated_at ON public.holerites;
DROP TRIGGER IF EXISTS trigger_atestados_updated_at ON public.atestados;
DROP TRIGGER IF EXISTS trigger_empresa_info_updated_at ON public.empresa_info;

-- Remoção das funções de apoio
DROP FUNCTION IF EXISTS public.fn_sync_condominio_para_posto();
DROP FUNCTION IF EXISTS public.fn_recalcular_vagas_condominio();
DROP FUNCTION IF EXISTS public.set_current_timestamp_updated_at();
```
*Impacto:* A aplicação continuará funcionando normalmente através das rotinas padrão do React context, apenas sem os gatilhos em nível de banco.

---

### 2.2. Reversão de Políticas de Segurança e RLS (Camada 5)
Se alguma política de RLS bloquear requisições legítimas do frontend ou mobile:
```sql
-- Em caso de emergência, desabilita o RLS temporariamente para investigar
ALTER TABLE public.pontos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocorrencias DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.holerites DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.atestados DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa_info DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.condominios DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.colaboradores DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
```
*Impacto:* Restaura o acesso imediato de todas as chamadas `anon` e `authenticated` enquanto a regra de segurança é ajustada.

---

### 2.3. Reversão de Índices de Performance (Camada 6)
Caso algum índice B-Tree cause lentidão em operações de inserção em massa:
```sql
DROP INDEX IF EXISTS idx_colaboradores_condominio;
DROP INDEX IF EXISTS idx_colaboradores_cpf;
DROP INDEX IF EXISTS idx_colaboradores_status;
DROP INDEX IF EXISTS idx_pontos_colaborador_data;
DROP INDEX IF EXISTS idx_ocorrencias_posto_data;
DROP INDEX IF EXISTS idx_alertas_posto_status;
DROP INDEX IF EXISTS idx_holerites_colaborador_mes;
DROP INDEX IF EXISTS idx_atestados_colaborador_status;
```
*Impacto:* As tabelas voltam à velocidade de escrita original, sem alteração nos dados já gravados.

---

### 2.4. Reversão de Chaves Estrangeiras (Camada 4)
Se alguma constraint de chave estrangeira estiver rejeitando inserções devido a dados históricos desordenados:
```sql
ALTER TABLE public.colaboradores DROP CONSTRAINT IF EXISTS fk_colaboradores_condominio;
ALTER TABLE public.ocorrencias DROP CONSTRAINT IF EXISTS fk_ocorrencias_posto;
ALTER TABLE public.alertas DROP CONSTRAINT IF EXISTS fk_alertas_posto;
ALTER TABLE public.alertas DROP CONSTRAINT IF EXISTS fk_alertas_colaborador;
ALTER TABLE public.pontos DROP CONSTRAINT IF EXISTS fk_pontos_colaborador;
ALTER TABLE public.pontos DROP CONSTRAINT IF EXISTS fk_pontos_condominio;
ALTER TABLE public.holerites DROP CONSTRAINT IF EXISTS fk_holerites_colaborador;
ALTER TABLE public.atestados DROP CONSTRAINT IF EXISTS fk_atestados_colaborador;
```
*Impacto:* As tabelas mantêm todas as colunas e dados, liberando a inserção de registros mesmo que o ID pai não esteja presente.

---

## 3. SCRIPT MESTRE DE ROLLBACK EMERGENCIAL

O arquivo `/supabase/09_ROLLBACK_E_RECUPERACAO.sql` consolida todas essas ações em um único script seguro e documentado, pronto para ser colado no SQL Editor do Supabase se necessário.

---

## 4. MATRIZ DE DECISÃO DE INCIDENTES

| Sintoma Observado | Causa Mais Provável | Ação de Contingência Recomendada |
|---|---|---|
| Erro `42501` (permission denied) ao registrar ponto | Política de INSERT em `pontos` restritiva | Executar seção 2.2 para a tabela `pontos` e reaplicar a migração `20261108100005`. |
| Erro `23503` (foreign key violation) ao alocar | Posto criado localmente ainda não propagado | Executar seção 2.4 para remover temporariamente a FK correspondente. |
| Lentidão em queries com múltiplos joins | Bloqueio de tabela por trigger de recálculo | Executar seção 2.1 para desativar os triggers de recálculo. |
| Dados não refletindo no Supabase | Cliente Supabase sem credenciais válidas no app | Verificar URL e Anon Key no menu de configurações do TurnoCerto. |
