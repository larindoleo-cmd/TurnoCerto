# Guia de Homologação e Implantação — TurnoCerto

Este documento descreve o roteiro seguro de validação em ambiente de homologação (staging) antes de qualquer promoção para produção. **Nenhuma alteração foi aplicada automaticamente em produção.**

---

## 1. Pré-requisitos e Variáveis de Ambiente

Configure no projeto **Staging/Homologação** (sem expor secrets no repositório):

- **Frontend (Cloudflare Pages / Vite)**:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- **Supabase Edge Function (`publish-scheduled-holerites`)**:
  - `SUPABASE_URL` (injetada automaticamente pelo Supabase)
  - `SUPABASE_SERVICE_ROLE_KEY` (necessária apenas no servidor da Edge Function)
  - `CRON_SECRET` (segredo compartilhado com o Cloudflare Cron Worker)
- **Cloudflare Cron Worker (`cloudflare/wrangler.toml`)**:
  - `SUPABASE_PUBLISH_HOLERITES_URL` (ex: `https://<project-ref>.supabase.co/functions/v1/publish-scheduled-holerites`)
  - `CRON_SECRET` (mesmo valor definido na Edge Function)

---

## 2. Aplicação Incremental das Migrations no Staging

Verifique quais migrations já constam no histórico do banco de homologação antes de aplicar as novas migrations incrementais:

```bash
supabase migration list
```

As novas migrations adicionadas em ordem estrita e não destrutiva são:
1. `supabase/migrations/20261113100001_gps_multiposto_coberturas.sql` — Campos multi-posto/acurácia GPS, tabelas `coberturas_programadas` e `coberturas_historico`, e RPC transacional `registrar_ponto_transacional`.
2. `supabase/migrations/20261113100002_documentos_rh_storage.sql` — Fluxo bidirecional RH <-> Colaborador (`documento_solicitacoes`, extensões versionadas em `colaborador_documentos`, `documento_historico` e bucket privado `documentos-funcionarios`).
3. `supabase/migrations/20261113100003_holerites_lotes_ciencia_cron.sql` — Lotes (`holerite_lotes`), eventos (`holerite_eventos`), retificação versionada, agendamento (`America/Sao_Paulo`), bucket privado `documentos-holerites` e RPC `confirmar_ciencia_holerite`.
4. `supabase/migrations/20261113100004_notificacoes_rls_hardening.sql` — Funções canônicas de escopo (`current_user_role`, `current_empresa_id`, `current_colaborador_id`), revogação de acesso `anon`, remoção de policies permissivas antigas (`USING (true)`, `email LIKE '%admin%'`) e isolamento estrito por empresa/titularidade em tabelas e Storage.

Aplicar somente em ambiente de **staging/homologação**:

```bash
supabase link --project-ref <SEU_STAGING_PROJECT_REF>
supabase db push --dry-run
supabase db push
```

---

## 3. Verificação de Auditoria RLS via pgTAP (Staging)

Execute a suíte pgTAP incluída em `supabase/tests/rls_security_audit_test.sql`:

```bash
supabase test db
```

Critérios verificados pela suíte:
- Existência das funções canônicas (`current_user_role`, `current_empresa_id`, `current_colaborador_id`, `registrar_ponto_transacional`, `confirmar_ciencia_holerite`).
- RLS habilitado em todas as tabelas operacionais e sensíveis.
- Zero policies com `role = 'anon'` ou `qual = 'true'` / `with_check = 'true'`.
- Presença dos buckets privados `documentos-funcionarios` e `documentos-holerites` (`public = false`).

---

## 4. Deploy da Edge Function e Cron Worker (Staging)

1. Deploy da Edge Function:
```bash
supabase functions deploy publish-scheduled-holerites --no-verify-jwt
supabase secrets set CRON_SECRET="<SEGREDO_FORTE>"
```

2. Deploy do Cloudflare Cron Worker (`*/5 * * * *`):
```bash
cd cloudflare
wrangler secret put SUPABASE_PUBLISH_HOLERITES_URL
wrangler secret put CRON_SECRET
wrangler deploy
```

3. Build do Frontend para Cloudflare Pages (SPA fallback já configurado em `public/_redirects`):
```bash
npm ci --legacy-peer-deps
npm run lint
npm test
npm run build
```

---

## 5. Checklist de QA Manual em Homologação

1. **Auth & Perfil**:
   - Login como Admin, Supervisor, RH e Funcionário sem credenciais fixas ou botões de autopreenchimento.
   - Redefinição de senha via link oficial de recuperação do Supabase Auth.
2. **GPS & Ponto Multi-Posto** (preservando captura facial 128D):
   - Batida no posto principal -> classificada como `posto_regular`.
   - Batida em outro posto ativo da mesma empresa sem cobertura -> classificada como `divergencia_posto`, notifica supervisor/RH e **não altera** `colaboradores.condominio_id`.
   - Batida em outro posto com cobertura vigente -> classificada como `cobertura_programada` ou `extra_programada`.
   - Leitura GPS com accuracy acima do configurado em `empresa_info.max_gps_accuracy_m` -> estado `inconclusivo` (não bloqueia como "fora do raio").
   - Fora de todos os postos ativos calibrados com confiança -> estado `fora_do_raio` bloqueia batida padrão.
   - Posto ativo sem coordenadas -> gera alerta `posto_sem_coordenadas` e não é usado para provar ausência.
   - Turno noturno (entrada 19:00, saída 07:00) e múltiplos turnos no mesmo dia.
   - Comprovante de ponto baixado em PDF binário real (`%PDF-`).
3. **Extras, Coberturas e Substituições**:
   - Criar cobertura em `EscalaPostoModal` e validar conflito de horário.
   - Substituição de emergência em `SubstituicaoModal` cria cobertura temporária e resolve somente o alerta de origem, mantendo o posto habitual do substituto.
   - Colaborador visualiza `Minha Escala` com separação entre escala habitual e cobertura, podendo aceitar ou recusar convites.
4. **Documentos (RH <-> Funcionário)**:
   - RH cria solicitação de documento.
   - Colaborador envia PDF/JPG/PNG (<= 10 MB); tentativa com arquivo adulterado (ex: HTML renomeado para `.pdf`) é bloqueada por magic bytes.
   - RH visualiza via URL assinada (120s), aprova/recusa/solicita atualização; colaborador reenvia nova versão (`v2`) preservando histórico.
5. **Holerites, Agendamento e Ciência**:
   - RH gera lote em rascunho ou agendado no horário de Brasília (`America/Sao_Paulo`).
   - Cron/Edge Function publica no horário agendado e notifica colaboradores.
   - Retificação gera nova versão preservando a anterior marcada como `retificado`.
   - Colaborador baixa PDF binário real (`%PDF-`) e confirma recebimento e ciência (com aviso explícito de que recebimento não implica concordância com valores).
6. **Notificações & Higiene**:
   - Marcar uma notificação como lida afeta apenas o item selecionado.
   - Nenhuma ocorrência de `window.alert`, `window.confirm`, `window.prompt` ou `window.open`.
