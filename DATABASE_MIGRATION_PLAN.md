# PLANO DETALHADO DE MIGRAÇÃO DO BANCO SUPABASE (DATABASE_MIGRATION_PLAN.md)
## SISTEMA OPERACIONAL TURNOCERTO — SUPABASE / POSTGRESQL

**Projeto Supabase:** `https://cyyvubiythuzhdwbuogg.supabase.co`  
**Estratégia:** Migração Não Destrutiva, Idempotente e com Preservação de Registros  
**Estrutura de Migrações:** Padrão Temporal Supabase CLI (`supabase/migrations/YYYYMMDDHHMMSS_nome.sql`)

---

## 1. PREMISSAS, REQUISITOS E CRITÉRIOS DE SEGURANÇA

1. **Zero Downtime & Zero Data Loss:** Nenhuma tabela existente com dados legítimos será truncada (`TRUNCATE`) ou eliminada (`DROP TABLE`).
2. **Idempotência Rigorosa:** Todas as instruções DDL utilizam `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS`, `CREATE OR REPLACE FUNCTION` e `DROP POLICY IF EXISTS`. Podem ser executadas repetidas vezes com segurança.
3. **Compatibilidade Alfanumérica Dual:** Suporte transparente a identificadores do tipo `TEXT` (`"cond-1"`, `"colab-102"`) e `UUID` (`"a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"`).
4. **Isolamento em Transações:** Cada arquivo de migração é estruturado para execução transacional (`BEGIN ... COMMIT`) quando aplicável pelo motor PostgreSQL.

---

## 2. INVENTÁRIO DO PACOTE DE MIGRAÇÕES (`supabase/migrations/`)

| Ordem | Arquivo de Migração | Tipo | Finalidade Principal | Dependências |
|---|---|---|---|---|
| **01** | `20261108100001_diagnostico_inicial.sql` | Diagnóstico | Inspeciona tabelas existentes, colunas, tipos, constraints e contagem de registros no schema `public`. Não altera nenhum dado. | Nenhuma |
| **02** | `20261108100002_schema_estrutural_core.sql` | DDL | Cria ou padroniza as tabelas mestras: `condominios`, `colaboradores`, `profiles` e `postos`. Garante todas as colunas de identidade, eSocial e escala. | Extensões `uuid-ossp`, `pgcrypto` |
| **03** | `20261108100003_schema_operacional_rh.sql` | DDL | Cria as 6 tabelas operacionais ausentes: `ocorrencias`, `alertas`, `pontos`, `holerites`, `atestados` e `empresa_info`. | 20261108100002 |
| **04** | `20261108100004_integridade_chaves_constraints.sql` | DDL/DML | Adiciona Foreign Keys seguras (`ON DELETE CASCADE` ou `ON DELETE SET NULL`) e Check Constraints de validação para status e enums. | 20261108100003 |
| **05** | `20261108100005_seguranca_rls_storage.sql` | DCL/DDL | Habilita Row Level Security (RLS) nas 9 tabelas, cria políticas para `anon` e `authenticated`, cria os 4 buckets do Storage e suas regras de acesso. | 20261108100004 |
| **06** | `20261108100006_indices_performance.sql` | DDL | Cria índices B-Tree e parciais sobre chaves estrangeiras, campos de ordenação (`data_hora DESC`) e buscas por status (`status = 'pendente'`). | 20261108100005 |
| **07** | `20261108100007_triggers_automacoes.sql` | DDL | Cria funções PL/pgSQL e gatilhos para auto-atualização de `updated_at`, espelhamento `condominios` ↔ `postos` e recálculo de vagas. | 20261108100006 |
| **08** | `20261108100008_normalizacao_limpeza_dados.sql` | DML | Higieniza dados legados: sanitiza CPFs, remove postos duplicados órfãos e recalcula a taxa de ocupação dos condomínios. | 20261108100007 |
| **09** | `20261108100009_validacao_integridade_final.sql` | Teste | Executa validação automatizada de ciclo completo (INSERT, SELECT, UPDATE, DELETE) em todas as tabelas e reporta o status de conformidade. | 20261108100008 |

---

## 3. FASES DETALHADAS DE EXECUÇÃO

### FASE 1: Diagnóstico e Reconhecimento Estrutural
- **Script:** `20261108100001_diagnostico_inicial.sql`
- **Ação:** Executa queries informativas contra `information_schema` e `pg_catalog`.
- **Risco:** Zero. Apenas leitura.
- **Saída:** Diagnóstico do número de colunas, tabelas criadas e estado das permissões.

### FASE 2: Estruturação das Tabelas Core
- **Script:** `20261108100002_schema_estrutural_core.sql`
- **Ação:** Criação ou adequação de:
  - `public.condominios`: adiciona `vagas_totais`, `vagas_ocupadas`, `cobertura_percentual`, `latitude`, `longitude`, `raio_tolerancia_metros`.
  - `public.colaboradores`: adiciona campos de eSocial (`pis`, `ctps`, `nome_mae`), bancários (`pix`, `banco`, `agencia`, `conta`), benefícios (`recebe_vr`, `valor_vr`, `recebe_va`, `valor_va`, `valor_extra_ft`, `valor_bonus`) e dados contratuais.
  - `public.profiles`: garante sincronização com o Supabase Auth.
  - `public.postos`: ajusta tipo das chaves para refletir `condominios`.
- **Risco:** Mínimo. Uso de blocos `DO $$ ... END $$` verificando a existência prévia de cada coluna antes do `ALTER TABLE`.

### FASE 3: Criação do Módulo Operacional e RH
- **Script:** `20261108100003_schema_operacional_rh.sql`
- **Ação:** Criação definitiva das 6 tabelas operacionais:
  - `public.ocorrencias`
  - `public.alertas`
  - `public.pontos`
  - `public.holerites`
  - `public.atestados`
  - `public.empresa_info` (com seed do registro matriz).
- **Risco:** Baixo. Tabelas novas não colidem com dados existentes.

### FASE 4: Chaves Estrangeiras e Integridade
- **Script:** `20261108100004_integridade_chaves_constraints.sql`
- **Ação:** Criação de vínculos relacionais entre:
  - `colaboradores.condominio_id` -> `condominios.id` (`ON DELETE SET NULL`)
  - `ocorrencias.posto_id` -> `condominios.id` (`ON DELETE CASCADE`)
  - `alertas.posto_id` -> `condominios.id` (`ON DELETE CASCADE`)
  - `alertas.colaborador_id` -> `colaboradores.id` (`ON DELETE SET NULL`)
  - `pontos.colaborador_id` -> `colaboradores.id` (`ON DELETE CASCADE`)
  - `holerites.colaborador_id` -> `colaboradores.id` (`ON DELETE CASCADE`)
  - `atestados.colaborador_id` -> `colaboradores.id` (`ON DELETE CASCADE`)
- **Tratamento de Órfãos:** O script inclui tratamento prévio para desvincular ou criar registros dummy caso existam IDs órfãos antes da criação das constraints.

### FASE 5: Segurança, RLS e Supabase Storage
- **Script:** `20261108100005_seguranca_rls_storage.sql`
- **Ação:** 
  - Habilita `ROW LEVEL SECURITY` em todas as tabelas.
  - Cria policies de leitura e escrita para operações legítimas do app (incluindo inserção de pontos e ocorrências).
  - Provisiona buckets em `storage.buckets` (`fotos-colaboradores`, `documentos-atestados`, `documentos-holerites`, `ocorrencias-anexos`) e suas políticas de acesso no schema `storage.objects`.

### FASE 6: Otimização de Índices e Performance
- **Script:** `20261108100006_indices_performance.sql`
- **Ação:** Adiciona índices B-Tree específicos para acelerar joins de condomínio/colaborador e ordenações de data/hora, além de índices parciais para alertas não resolvidos.

### FASE 7: Triggers e Automações de Banco
- **Script:** `20261108100007_triggers_automacoes.sql`
- **Ação:**
  - Gatilho `trigger_set_timestamp` em todas as tabelas com `updated_at`.
  - Gatilho `trigger_sync_condominio_to_posto` para manter a tabela legada `postos` atualizada sem intervenção manual.
  - Gatilho `trigger_recalcular_vagas_condominio` para atualizar `vagas_ocupadas` e `cobertura_percentual` automaticamente quando um colaborador for alocado ou desalocado.

### FASE 8: Normalização e Limpeza de Dados Legados
- **Script:** `20261108100008_normalizacao_limpeza_dados.sql`
- **Ação:** Higieniza registros históricos legados, limpa duplicidades em `postos` e normaliza formatações.

### FASE 9: Validação e Teste Automatizado
- **Script:** `20261108100009_validacao_integridade_final.sql`
- **Ação:** Simula um ciclo de vida operacional completo em transação de teste. Verifica o status final de persistência.

---

## 4. INSTRUÇÕES DE EXECUÇÃO

### Opção A: Execução via Supabase Dashboard (Recomendado para Usuários)
1. Conecte-se ao [Painel do Supabase](https://supabase.com/dashboard) no projeto do TurnoCerto.
2. Acesse o menu lateral **SQL Editor**.
3. Crie uma nova query (`New query`).
4. Copie e cole o conteúdo de cada migração em ordem (de `20261108100001` até `20261108100009`).
5. Clique em **Run** e certifique-se de que a mensagem "Success. No rows returned" ou os relatórios esperados foram exibidos.

### Opção B: Execução via Supabase CLI
```bash
# Caso utilize a CLI local conectada ao projeto:
supabase db push
# Ou execute individualmente:
supabase db execute --file supabase/migrations/20261108100001_diagnostico_inicial.sql
```
