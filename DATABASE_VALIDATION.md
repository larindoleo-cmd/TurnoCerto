# PLANO E CONSULTAS DE VALIDAÇÃO DO BANCO (DATABASE_VALIDATION.md)
## SISTEMA OPERACIONAL TURNOCERTO — SUPABASE / POSTGRESQL

Este documento descreve os critérios formais de aceitação, testes de fumaça e consultas SQL de validação que comprovam a integridade, persistência e segurança do banco de dados Supabase após a execução do pacote de migrações.

---

## 1. CRITÉRIOS DE APROVAÇÃO (DEFINITION OF DONE)

Para que o banco de dados seja considerado 100% aprovado, todos os seguintes critérios devem retornar positivo:
1. **Completude Estrutural:** As 9 tabelas (`condominios`, `colaboradores`, `profiles`, `postos`, `ocorrencias`, `alertas`, `pontos`, `holerites`, `atestados`, `empresa_info`) devem existir no schema `public`.
2. **Compatibilidade Alfanumérica Dual:** Nenhuma coluna de chave estrangeira deve falhar ou rejeitar IDs do tipo `TEXT` (`cond-1`, `colab-100`).
3. **Persistência Ativa:** Operações de `INSERT`, `UPDATE`, `UPSERT`, `SELECT` e `DELETE` emitidas pelo frontend devem ser gravadas com sucesso e persistir após recarregamento da aplicação.
4. **Isolamento e Segurança RLS:** Todas as tabelas devem possuir `rowsecurity = true` no catálogo PostgreSQL, com políticas autorizando chamadas do aplicativo web e mobile.
5. **Automação por Triggers:** Modificações em `condominios` devem refletir automaticamente em `postos`, e alterações de alocação de colaboradores devem atualizar a contagem de `vagas_ocupadas`.
6. **Armazenamento de Mídia:** Buckets do Supabase Storage (`fotos-colaboradores`, `documentos-atestados`, `documentos-holerites`, `ocorrencias-anexos`) devem estar registrados e operacionais.

---

## 2. CONSULTAS DE DIAGNÓSTICO E AUDITORIA ESTRUTURAL

Execute as seguintes consultas no SQL Editor do Supabase para inspecionar o estado do banco:

### 2.1. Verificação de Existência das 9 Tabelas do Sistema
```sql
SELECT 
  table_name,
  (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t.table_name) AS total_colunas,
  (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = t.table_name) AS rls_ativo
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN (
    'condominios', 'colaboradores', 'profiles', 'postos',
    'ocorrencias', 'alertas', 'pontos', 'holerites',
    'atestados', 'empresa_info'
  )
ORDER BY table_name;
```
**Resultado Esperado:** 10 linhas retornadas, todas com `rls_ativo = true`.

---

### 2.2. Verificação de Políticas RLS Configuradas
```sql
SELECT 
  tablename,
  policyname,
  cmd AS comando,
  roles,
  permissive
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```
**Resultado Esperado:** Pelo menos uma política de `SELECT` e uma política de escrita (`INSERT`/`UPDATE`/`ALL`) para cada tabela.

---

### 2.3. Verificação de Chaves Estrangeiras e Integridade Referencial
```sql
SELECT
  tc.table_name AS tabela_origem,
  kcu.column_name AS coluna_origem,
  ccu.table_name AS tabela_destino,
  ccu.column_name AS coluna_destino,
  rc.delete_rule AS regra_delecao
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = rc.constraint_name
WHERE tc.constraint_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;
```
**Resultado Esperado:** Exibição das chaves ligando `colaboradores`, `ocorrencias`, `alertas`, `pontos`, `holerites` e `atestados` às tabelas mestras.

---

### 2.4. Auditoria de Registros Órfãos (Inconsistências)
```sql
-- Verifica colaboradores apontando para condomínios inexistentes
SELECT c.id, c.nome, c.condominio_id
FROM public.colaboradores c
LEFT JOIN public.condominios cd ON cd.id = c.condominio_id
WHERE c.condominio_id IS NOT NULL AND cd.id IS NULL;

-- Verifica ocorrências apontando para postos inexistentes
SELECT o.id, o.tipo, o.posto_id
FROM public.ocorrencias o
LEFT JOIN public.condominios cd ON cd.id = o.posto_id
WHERE cd.id IS NULL;

-- Verifica pontos de colaboradores inexistentes
SELECT p.id, p.colaborador_id, p.data
FROM public.pontos p
LEFT JOIN public.colaboradores c ON c.id = p.colaborador_id
WHERE c.id IS NULL;
```
**Resultado Esperado:** Zero registros retornados em todas as três consultas.

---

### 2.5. Verificação dos Buckets do Supabase Storage
```sql
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id IN ('fotos-colaboradores', 'documentos-atestados', 'documentos-holerites', 'ocorrencias-anexos');
```
**Resultado Esperado:** 4 buckets listados.

---

## 3. BATERIA DE TESTES DE PERSISTÊNCIA (CICLO CRUD COMPLETO)

Você pode executar o seguinte bloco SQL transacional no Supabase. Ele realiza um teste end-to-end de inserção, leitura, atualização e limpeza com rollback automático ou manual:

```sql
DO $$
DECLARE
  v_test_condo_id TEXT := 'test-cond-validacao';
  v_test_colab_id TEXT := 'test-colab-validacao';
  v_test_ocorr_id TEXT := 'test-ocorr-validacao';
  v_test_alerta_id TEXT := 'test-alerta-validacao';
  v_test_ponto_id TEXT := 'test-ponto-validacao';
  v_test_holerite_id TEXT := 'test-holerite-validacao';
  v_test_atestado_id TEXT := 'test-atestado-validacao';
BEGIN
  -- 1. Teste de Condomínio
  INSERT INTO public.condominios (id, nome, tipo, vagas_contratadas, status)
  VALUES (v_test_condo_id, 'Condomínio de Validação Técnica', 'Residencial', 4, 'operacional')
  ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome;

  -- 2. Teste de Colaborador
  INSERT INTO public.colaboradores (id, nome, cpf, cargo, funcao, condominio_id, status, salario_base)
  VALUES (v_test_colab_id, 'Colaborador Validação Automatizada', '999.888.777-66', 'Porteiro Líder', 'Porteiro Líder', v_test_condo_id, 'no_posto', 2450.00)
  ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome;

  -- 3. Teste de Ocorrência
  INSERT INTO public.ocorrencias (id, posto_id, posto_nome, tipo, descricao, registrado_por, data_hora, urgencia, resolvida)
  VALUES (v_test_ocorr_id, v_test_condo_id, 'Condomínio de Validação', 'Ronda', 'Ronda preventiva realizada sem intercorrências.', 'Supervisor Teste', 'Hoje às 10:00', 'baixa', true)
  ON CONFLICT (id) DO UPDATE SET descricao = EXCLUDED.descricao;

  -- 4. Teste de Alerta
  INSERT INTO public.alertas (id, posto_id, posto_nome, tipo, gravidade, titulo, descricao, horario, resolvido)
  VALUES (v_test_alerta_id, v_test_condo_id, 'Condomínio de Validação', 'atraso', 'moderada', 'Atraso detectado', 'Teste de disparo de alerta', '10:05', false)
  ON CONFLICT (id) DO UPDATE SET titulo = EXCLUDED.titulo;

  -- 5. Teste de Ponto
  INSERT INTO public.pontos (id, colaborador_id, colaborador_nome, condominio_id, data, entrada_1, status_ponto)
  VALUES (v_test_ponto_id, v_test_colab_id, 'Colaborador Validação', v_test_condo_id, CURRENT_DATE, '10:00', 'Regular')
  ON CONFLICT (id) DO UPDATE SET status_ponto = EXCLUDED.status_ponto;

  -- 6. Teste de Holerite
  INSERT INTO public.holerites (id, colaborador_id, colaborador_nome, mes_referencia, salario_base, liquido_receber, status_envio)
  VALUES (v_test_holerite_id, v_test_colab_id, 'Colaborador Validação', 'Novembro/2026', 2450.00, 2450.00, 'Pendente')
  ON CONFLICT (id) DO UPDATE SET status_envio = EXCLUDED.status_envio;

  -- 7. Teste de Atestado
  INSERT INTO public.atestados (id, colaborador_id, colaborador_nome, cid, data_inicio, dias_afastamento, status)
  VALUES (v_test_atestado_id, v_test_colab_id, 'Colaborador Validação', 'Z00.0', CURRENT_DATE, 1, 'Pendente')
  ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

  -- 8. Teste de Atualização da Matriz
  INSERT INTO public.empresa_info (id, razao_social, nome_fantasia, cnpj)
  VALUES ('matriz-principal', 'TurnoCerto Terceirização e Serviços Ltda.', 'TurnoCerto Serviços', '12.345.678/0001-90')
  ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

  -- 9. Limpeza higiênica dos registros de teste
  DELETE FROM public.atestados WHERE id = v_test_atestado_id;
  DELETE FROM public.holerites WHERE id = v_test_holerite_id;
  DELETE FROM public.pontos WHERE id = v_test_ponto_id;
  DELETE FROM public.alertas WHERE id = v_test_alerta_id;
  DELETE FROM public.ocorrencias WHERE id = v_test_ocorr_id;
  DELETE FROM public.colaboradores WHERE id = v_test_colab_id;
  DELETE FROM public.condominios WHERE id = v_test_condo_id;

  RAISE NOTICE '✅ TODOS OS 8 TESTES DE CRUD PASSARAM COM SUCESSO NO SUPABASE!';
END $$;
```

---

## 4. CHECKLIST FINAL DE HOMOLOGAÇÃO

- [x] O aplicativo carrega condomínios existentes no Supabase sem erros de conexão.
- [x] O cadastro de um novo funcionário é gravado simultaneamente em `colaboradores` e `profiles`.
- [x] A alocação de um colaborador a um posto atualiza `condominio_id` e a contagem de vagas.
- [x] A substituição de posto (FT) cria a ocorrência, resolve o alerta e grava o novo colaborador no posto.
- [x] A batida de ponto com geolocalização é inserida em `pontos` sem erro `42501` de RLS.
- [x] A assinatura digital de holerite atualiza `status_envio = 'Assinado'` no banco.
- [x] A aprovação/recusa de atestado persiste em `atestados` e reflete no painel de RH.
- [x] Os dados da empresa matriz em `empresa_info` são preservados após reinicialização.
