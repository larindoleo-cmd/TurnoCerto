# PLANO DE BACKUP, RESTORE E CONTINGÊNCIA — TURNOCERTO
## BANCO DE DADOS SUPABASE / POSTGRESQL 15+

Este plano estabelece os procedimentos formais de segurança operacional, cópia de segurança pré-migration, restauração rápida e rollback para garantir 100% de disponibilidade e zero perda de dados reais durante a aplicação de migrations incrementais.

---

## 1. PREMISSAS DE SEGURANÇA E NÃO DESTRUTIVIDADE
1. **Trabalho 100% Incremental:** Nenhuma tabela existente é removida (`DROP TABLE` proibido).
2. **Preservação de Registros:** Nenhum registro é apagado; campos legados são preservados como retrocompatibilidade ou migrados via `COALESCE`.
3. **Execução Transacional:** Toda migration deve ser executada em bloco de transação (`BEGIN; ... COMMIT;`), assegurando reversão automática imediata em caso de erro.
4. **Isolamento de Ambiente:** Nenhum comando SQL remoto é disparado sem prévia validação sintática e checklist de integridade.

---

## 2. PROCEDIMENTO DE BACKUP COMPLETO (PRÉ-MIGRATION)

### 2.1. Snapshot Lógico via Supabase CLI / pg_dump
Antes de aplicar qualquer migration no banco de produção/homologação, execute o dump estrutural e de dados:

```bash
# Definir variáveis de conexão segura
export PGHOST="db.xxxx.supabase.co"
export PGPORT="5432"
export PGDATABASE="postgres"
export PGUSER="postgres"
# PGPASSWORD fornecido via cofre de segredos / prompt interativo

# 1. Backup completo (Schema + Dados) com timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
pg_dump \
  --format=custom \
  --compress=9 \
  --verbose \
  --schema=public \
  --file="backup_turnocerto_${TIMESTAMP}.dump"

# 2. Backup somente de dados em formato SQL puro legível
pg_dump \
  --data-only \
  --schema=public \
  --inserts \
  --file="backup_turnocerto_data_${TIMESTAMP}.sql"
```

### 2.2. Backup Rápido das Tabelas Críticas (JSON / CSV via SQL)
Caso necessite de uma cópia rápida de tabelas operacionais:

```sql
-- Executar via psql ou Dashboard SQL Editor:
\copy (SELECT * FROM public.condominios) TO 'backup_condominios.csv' WITH CSV HEADER;
\copy (SELECT * FROM public.colaboradores) TO 'backup_colaboradores.csv' WITH CSV HEADER;
\copy (SELECT * FROM public.ponto_eventos) TO 'backup_ponto_eventos.csv' WITH CSV HEADER;
\copy (SELECT * FROM public.holerites) TO 'backup_holerites.csv' WITH CSV HEADER;
\copy (SELECT * FROM public.alertas) TO 'backup_alertas.csv' WITH CSV HEADER;
\copy (SELECT * FROM public.ocorrencias) TO 'backup_ocorrencias.csv' WITH CSV HEADER;
```

---

## 3. PROCEDIMENTO DE RESTORE (RECUPERAÇÃO SEGURA)

### 3.1. Restauração Total em Caso de Incidente
Se for necessária a recuperação integral para o ponto imediatamente anterior:

```bash
# 1. Conectar e validar integridade do arquivo de dump
pg_restore --list backup_turnocerto_20261112_XXXXXX.dump

# 2. Restauração em modo transacional (com interrupção automática se houver erro)
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --single-transaction \
  --dbname="$DATABASE_URL" \
  backup_turnocerto_20261112_XXXXXX.dump
```

### 3.2. Restauração Seletiva por Tabela
Se apenas uma tabela específica necessitar de recuperação:

```bash
pg_restore \
  --table=ponto_eventos \
  --data-only \
  --dbname="$DATABASE_URL" \
  backup_turnocerto_20261112_XXXXXX.dump
```

---

## 4. CHECKLIST DE CHECAGENS DE INTEGRIDADE PÓS-MIGRATION

Após a aplicação do script `20261112100000_padronizacao_schema_canonico.sql`, execute imediatamente o arquivo:
`supabase/11_DIAGNOSTICO_E_VERIFICACAO_SCHEMA.sql`

O script valida os seguintes pontos cruciais:
- [ ] **Constraint `metodo_autenticacao`**: Deve aceitar exatamente `biometria_facial`, `biometria_passkey`, `autenticador_dispositivo`, `excecao_autorizada`.
- [ ] **Coordenadas de `condominios`**: `latitude` e `longitude` devem ser `DOUBLE PRECISION` anuláveis (sem forçar coordenadas de SP para postos novos não calibrados).
- [ ] **Sincronização `condominios` -> `postos`**: Contagem de linhas idêntica entre ambas as tabelas; trigger `trg_sync_condominios_to_postos` em status ativo.
- [ ] **Integridade Multiempresa**: `empresa_id` preenchido em 100% dos registros de todas as tabelas operacionais (0 NULLs).
- [ ] **Validação de Órfãos**: 0 colaboradores apontando para condomínios inexistentes; 0 alertas sem posto; 0 pontos sem colaborador.
- [ ] **Campos de Holerites**: Presença de `liquido_receber` e `salario_liquido`, `desconto_inss` e `inss`, `desconto_vt` e `vale_transporte`.

---

## 5. RECONCILIAÇÃO DO HISTÓRICO NO SUPABASE CLI (`supabase migration repair`)

### 5.1. Origem das Migrations com Prefixo Curto (`20261108_*`)
No diretório `supabase/migrations/` existem arquivos legados criados manualmente com formato curto:
- `20261108_cadastro_funcionarios_rls.sql`
- `20261108_tabela_colaboradores.sql`
- `20261110_biometria_facial_autorizacoes_v2.sql`
- `20261110_biometria_facial_core_v3.sql`

Enquanto outras migrations seguem o padrão canônico de 14 dígitos (`YYYYMMDDHHMMSS`):
- `20261108100001_diagnostico_inicial.sql` até `20261108120000_...`
- `20261112100000_padronizacao_schema_canonico.sql` (nova)

### 5.2. Como o Supabase CLI rastreia migrations
O Supabase CLI mantém uma tabela interna no banco chamada `supabase_migrations.schema_migrations` com a coluna `version`.
- Renomear ou apagar arquivos já aplicados em produção causará divergência entre o sistema de arquivos local e a tabela `supabase_migrations.schema_migrations`.
- **Regra de Ouro:** Não renomeie arquivos que já constam como aplicados no banco remoto.

### 5.3. Procedimento de Diagnóstico e Reconciliação

1. **Listar o status atual das migrations:**
   ```bash
   supabase migration list
   ```
   Isto indicará quais versões constam como `Applied (Remote)` e quais constam apenas como `Local`.

2. **Se o CLI acusar erro de versão irregular em migrations antigas já existentes no banco remoto:**
   Utilize o comando oficial de reparo apenas para sincronizar o status sem reaplicar o SQL:
   ```bash
   # Marca a versão curta como já aplicada sem reexecutar
   supabase migration repair --status applied 20261108_cadastro_funcionarios_rls
   supabase migration repair --status applied 20261108_tabela_colaboradores
   supabase migration repair --status applied 20261110_biometria_facial_autorizacoes_v2
   supabase migration repair --status applied 20261110_biometria_facial_core_v3
   ```

3. **Aplicação segura da nova migration canônica:**
   ```bash
   # Aplica de forma incremental somente a nova migration 20261112100000
   supabase db push
   ```
