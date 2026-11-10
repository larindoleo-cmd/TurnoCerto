# AUDITORIA TÉCNICA COMPLETA DO SISTEMA, CORREÇÃO DE CÓDIGO E INTEGRIDADE DO BANCO SUPABASE

**Aplicativo:** TurnoCerto — Gestão de Terceirização, Postos de Trabalho e Escalas  
**Ambiente:** React 19 + TypeScript + Vite + Tailwind CSS + Supabase (PostgreSQL)  
**Data da Auditoria:** 08 de Novembro de 2026  
**Status da Auditoria:** Concluída com Diagnóstico e Plano de Correção Integral  

---

## 1. RESUMO EXECUTIVO

Esta auditoria técnica inspecionou integralmente o código-fonte do aplicativo **TurnoCerto**, suas telas, formulários, fluxos de dados, componentes modais, contexto global (`AppContext.tsx`), cliente de API Supabase (`src/lib/supabase.ts`) e o banco de dados PostgreSQL hospedado no Supabase (`https://cyyvubiythuzhdwbuogg.supabase.co`).

### Principais Diagnósticos Identificados:
1. **Tabelas Ausentes no Supabase:** As tabelas operacionais `ocorrencias`, `alertas`, `holerites`, `atestados` e `empresa_info` não foram criadas no banco de dados Supabase (retornando erro `PGRST205: Could not find the table in the schema cache`), impedindo a gravação de qualquer dado preenchido nessas telas.
2. **Ações sem Chamada de Persistência:** Funções operacionais cruciais como `alocarColaborador`, `substituirColaborador`, `removerColaboradorDoPosto`, `criarOcorrencia`, `resolverAlerta`, `aprovarAtestado`, `recusarAtestado`, `assinarHolerite` e `atualizarEmpresaInfo` atualizavam apenas o estado local em memória (React `useState` e `localStorage`), nunca enviando os dados para o Supabase.
3. **Incompatibilidade de Tipos de IDs (UUID vs TEXT):** Os condomínios utilizavam identificadores alfanuméricos (`cond-1`, `cond-2`, etc.), enquanto a tabela `profiles` e a coluna `condominio_id` foram criadas como `UUID` com `REFERENCES condominios(id)`. Como `'cond-1'` não é um UUID válido, a gravação falhava ou forçava `condominio_id` a ser gravado como `NULL`.
4. **Duplicidade e Divergência de Tabelas (`condominios` vs `postos`):** Existiam duas tabelas em paralelo no banco (`condominios` com 4 registros e `postos` com 15 registros contendo condomínios duplicados), gerando divergência nas operações de cadastro e atualização de postos.
5. **Políticas de RLS Restritivas no Ponto Eletrônico:** A tabela `pontos` no Supabase retornava violação de RLS (`error 42501: new row violates row-level security policy for table "pontos"`), bloqueando registros de ponto facial e eletrônico.
6. **Erros de Tipagem TypeScript em Componentes Legados:** Arquivos remanescentes de versões anteriores continham declarações incompatíveis com a interface atual do `AppContext`, impedindo a validação de compilação estrita (`npm run lint`).

---

## 2. ARQUIVOS E COMPONENTES ANALISADOS

| Arquivo | Módulo / Responsabilidade | Status da Auditoria |
|---|---|---|
| `src/context/AppContext.tsx` | Gerenciamento central de estado, autenticação e Supabase CRUD | Auditado (Requer Correção de Persistência) |
| `src/lib/supabase.ts` | Configuração, singleton e testes de conectividade Supabase | Auditado (Conexão validada) |
| `src/types/index.ts` | Contratos TypeScript (`Colaborador`, `CondominioPosto`, etc.) | Auditado (Consistente) |
| `src/components/modals/CadastroFuncionarioModal.tsx` | Cadastro e edição de colaboradores em 4 etapas | Auditado (Mapeamento validado) |
| `src/components/modals/CondominioModal.tsx` | Cadastro e edição de postos/condomínios | Auditado (Campos sem persistência identificados) |
| `src/components/modals/EmpresaModal.tsx` | Cadastro societário e fiscal da matriz terceirizada | Auditado (Sem persistência no Supabase) |
| `src/components/modals/NovaOcorrenciaModal.tsx` | Registro de eventos operacionais e livros de guarita | Auditado (Sem persistência no Supabase) |
| `src/components/modals/SubstituicaoModal.tsx` | Despacho emergencial de volantes e faltas | Auditado (Sem persistência no Supabase) |
| `src/components/modals/AlocarModal.tsx` | Alocação de funcionário em posto de trabalho | Auditado (Sem persistência no Supabase) |
| `src/components/modals/EscalaPostoModal.tsx` | Gestão de plantões e escalas 12x36 | Auditado |
| `src/components/modals/HoleriteDetalheModal.tsx` | Visualização e assinatura digital do contracheque | Auditado (Sem persistência no Supabase) |
| `src/components/tabs/OperacaoTab.tsx` | Painel operacional 360°, alertas e coberturas | Auditado |
| `src/components/tabs/EquipeTab.tsx` | Gestão de colaboradores, filtros e crachá | Auditado |
| `src/components/tabs/PostosTab.tsx` | Gestão de postos contratados e condomínios | Auditado |
| `src/components/tabs/MatrizTab.tsx` | Matriz operacional, dados da empresa e ocorrências | Auditado |
| `src/components/tabs/HoleriteRHTab.tsx` | Folha de pagamento, pontos e atestados médicos | Auditado |
| `src/components/LoginScreen.tsx` | Tela de autenticação e seleção rápida | Auditado |
| `src/components/SupabaseSettingsModal.tsx` | Interface de configuração de chaves Supabase | Auditado |
| `supabase/migrations/*.sql` | Migrações SQL existentes no repositório | Auditadas |

---

## 3. MAPEAMENTO DETALHADO DO CAMINHO DOS DADOS

### 3.1. Formulário de Cadastro e Edição de Funcionários (`CadastroFuncionarioModal.tsx`)
- **Tela:** Aba Equipe → Botão "Novo Funcionário" ou "Editar"
- **Campos:** `nome`, `cpf`, `rg`, `telefone`, `dataNascimento`, `foto`, `pis`, `ctps`, `nomeMae`, `endereco` (ViaCEP), `condominioId`, `cargo`, `regimeEscala`, `turnoInicio`, `turnoFim`, `dataAdmissao`, `salarioBase`, `pix`, `banco`, `agencia`, `conta`, `recebeVT`, `recebeVR`, `valorVR`, `recebeVA`, `valorVA`, `valorExtraFT`, `valorBonus`, `email`, `senha`, `role`.
- **Tabela Principal de Destino:** `public.colaboradores`
- **Tabela Espelho de Login:** `public.profiles`
- **Problema Encontrado:** 
  1. A tabela `profiles` possui restrição `condominio_id UUID REFERENCES condominios(id)`. Como os condomínios possuíam IDs em texto (`'cond-1'`), a inserção em `profiles` forçava `condominio_id` como `NULL`.
  2. Em `profiles`, a coluna `cpf` possui constraint `NOT NULL` no banco remoto, mas alguns usuários eram inseridos sem CPF garantido.
  3. No cadastro, se ocorresse falha na gravação remota, a tela fechava exibindo aviso no Toast, mas sem retry e sem sincronização consistente.

### 3.2. Formulário de Cadastro e Edição de Condomínios (`CondominioModal.tsx`)
- **Tela:** Aba Postos → Botão "Novo Posto" ou "Editar Posto"
- **Campos:** `nome`, `tipo`, `cnpj`, `contratoNumero`, `endereco`, `bairro`, `cidade`, `supervisor`, `telefoneSupervisor`, `vagasContratadas`, `tipoEscalaPadrao`, `status`, `motivoAtencao`, `contatoSindico`, `telefoneSindico`, `instrucoesGuarita`, `foto`.
- **Tabelas de Destino no Código Atual:** `public.postos` e `public.condominios`
- **Problemas Encontrados:**
  1. O código enviava campos diferentes para duas tabelas distintas.
  2. Para `postos`, enviava apenas `id`, `nome`, `tipo`, `cnpj`, `endereco`, `supervisor`, `status`. Campos cruciais como `contratoNumero`, `vagasContratadas`, `contatoSindico`, `telefoneSindico` e `instrucoesGuarita` eram descartados.
  3. Para `condominios`, enviava apenas coordenadas e endereço, sem salvar as regras do posto.
  4. Duplicidade na tabela `postos`: 15 registros gerados com múltiplos UUIDs para os mesmos condomínios.

### 3.3. Alocação de Colaborador no Posto (`AlocarModal.tsx`)
- **Tela:** Aba Operação → Card do Posto → Botão "Alocar"
- **Campos:** `postoId`, `colaboradorId`, `jornada`
- **Caminho Anterior:** Chamava `alocarColaborador(postoId, colaboradorId, jornada)` em `AppContext.tsx`.
- **Falha Crítica Identificada:** A função realizava **apenas** `setColaboradores` e `setCondominios` em memória! **Nenhuma query de UPDATE era enviada ao Supabase**. Ao recarregar a página, a alocação era perdida se o cache local expirasse ou ao acessar por outro dispositivo.

### 3.4. Substituição Emergencial de Plantão (`SubstituicaoModal.tsx`)
- **Tela:** Aba Operação → Card com Posto Descoberto → Botão "Substituição"
- **Campos:** `postoId`, `substitutoId`, `colaboradorFaltaId`
- **Caminho Anterior:** Chamava `substituirColaborador(...)` em `AppContext.tsx`.
- **Falha Crítica Identificada:** Não persistia no Supabase. O colaborador substituto não tinha seu `condominio_id` ou `status` atualizado no banco, o colaborador faltante não recebia o registro de falta no banco, e a ocorrência gerada automaticamente não era salva.

### 3.5. Registro de Ocorrências (`NovaOcorrenciaModal.tsx`)
- **Tela:** Aba Matriz → Seção Ocorrências Operacionais → Botão "Registrar Nova Ocorrência"
- **Campos:** `postoId`, `tipo`, `urgencia`, `descricao`
- **Caminho Anterior:** Chamava `criarOcorrencia(...)` em `AppContext.tsx`.
- **Falha Crítica Identificada:** A tabela `public.ocorrencias` **NÃO EXISTE** no Supabase (`PGRST205`). Além disso, a função no código não possuía código de chamada ao Supabase.

### 3.6. Gestão de Alertas Operacionais (`OperacaoTab.tsx`)
- **Tela:** Aba Operação → Banner de Alertas Críticos → Botão "Resolver"
- **Campos:** `alertaId`, `resolvidoPor`, `resolvidoEm`
- **Falha Crítica Identificada:** A tabela `public.alertas` **NÃO EXISTE** no Supabase e a ação `resolverAlerta` não realizava `UPDATE` no Supabase.

### 3.7. Atestados Médicos e Abonos (`HoleriteRHTab.tsx` / `MatrizTab.tsx`)
- **Tela:** Aba RH / Aba Matriz → Atestados Médicos → Botão "Aprovar" / "Recusar"
- **Campos:** `atestadoId`, `status` ('Aprovado' / 'Recusado')
- **Falha Crítica Identificada:** A tabela `public.atestados` **NÃO EXISTE** no Supabase. As aprovações não eram persistidas.

### 3.8. Holerites Digitais e Assinatura Digital (`HoleriteDetalheModal.tsx`)
- **Tela:** Aba RH → Holerite do Colaborador → Botão "Assinar Digitalmente"
- **Campos:** `holeriteId`, `statusEnvio` ('Assinado')
- **Falha Crítica Identificada:** A tabela `public.holerites` **NÃO EXISTE** no Supabase. A assinatura e os cálculos da folha existiam apenas no mock local.

### 3.9. Cadastro da Empresa Matriz (`EmpresaModal.tsx`)
- **Tela:** Aba Matriz → "Editar Dados da Empresa"
- **Campos:** `razaoSocial`, `nomeFantasia`, `cnpj`, `inscricaoEstadual`, `inscricaoMunicipal`, `telefone`, `whatsapp`, `email`, `endereco`, `bairro`, `cidade`, `estado`, `cep`, `responsavelOperacional`, `cargoResponsavel`, `chavePix`, `logoUrl`, `apresentacao`.
- **Falha Crítica Identificada:** A tabela `public.empresa_info` **NÃO EXISTE** no Supabase. Toda alteração societária/fiscal feita pelo usuário era perdida ao trocar de navegador.

---

## 4. MATRIZ DE PROBLEMAS CLASSIFICADOS POR GRAVIDADE

| Gravidade | Problema | Causa Raiz | Impacto |
|---|---|---|---|
| **CRÍTICO** | Inexistência das tabelas `alertas`, `ocorrencias`, `holerites`, `atestados`, `empresa_info` | Scripts de migração incompletos no repositório; ausência dessas entidades no DDL do Supabase | Dados preenchidos pelos usuários nessas 5 telas não são gravados no banco remoto |
| **CRÍTICO** | Funções operacionais sem chamada de persistência Supabase | Funções implementadas apenas com atualização de estado React em `AppContext.tsx` | Alocações, substituições, desvinculações e ocorrências não chegam ao banco |
| **CRÍTICO** | Incompatibilidade de tipos de ID de condomínios (`cond-1` vs `UUID`) | Modelagem relacional mista no Supabase; restrições de chave estrangeira UUID contra IDs em string | `condominio_id` gravado como `NULL` em `profiles`; falhas de integridade referencial |
| **ALTO** | Duplicidade e inconsistência entre as tabelas `condominios` e `postos` | Criação duplicada de tabelas para o mesmo propósito em fases diferentes do projeto | Inconsistência de IDs e dados desatualizados entre diferentes telas |
| **ALTO** | Violação de RLS na tabela `pontos` (Error 42501) | Tabela `pontos` com RLS ativado sem política permissiva para usuários ou anon key | Falha na gravação do registro de ponto eletrônico |
| **ALTO** | Sincronização inicial (`syncWithSupabase`) incompleta | Apenas 2 tabelas eram consultadas na inicialização | Estado local divergente do banco remoto e ausência de dados compartilhados |
| **MÉDIO** | Erros de compilação estrita TypeScript (`tsc --noEmit`) | Arquivos legados não utilizados (`CondominioDetailDrawer.tsx`, `FTCoverageModal.tsx`, etc.) | Falha na execução do script `npm run lint` |
| **MÉDIO** | Perda de campos secundários no cadastro de condomínios | Payload enviado ao Supabase ignorava campos como `instrucoesGuarita`, `contatoSindico`, etc. | Perda de informações cadastrais após salvar |

---

## 5. PLANO DE AÇÃO E ESTRUTURAÇÃO

### Fase 5: Correções no Código TypeScript/React
1. **Centralização e Fortalecimento do Cliente Supabase (`src/lib/supabase.ts`):** Tratamento robusto de requisições, detecção de erros de rede e sanitização de credenciais.
2. **Atualização Completa de `AppContext.tsx`:**
   - Adicionar chamadas de persistência Supabase em:
     - `alocarColaborador` (UPDATE em `colaboradores` e `condominios`)
     - `substituirColaborador` (UPDATE em `colaboradores`, `condominios` e INSERT em `ocorrencias`)
     - `removerColaboradorDoPosto` (UPDATE em `colaboradores` e `condominios`)
     - `criarOcorrencia` (INSERT em `ocorrencias`)
     - `resolverAlerta` (UPDATE em `alertas`)
     - `aprovarAtestado` / `recusarAtestado` (UPDATE em `atestados`)
     - `assinarHolerite` (UPDATE em `holerites`)
     - `atualizarEmpresaInfo` (UPSERT em `empresa_info`)
     - `cadastrarCondominio` e `atualizarCondominio` (persistência de TODOS os campos)
   - Expandir `syncWithSupabase` para hidratar todas as entidades a partir do banco de dados.
3. **Resolução de Erros de Tipagem:** Corrigir os arquivos legados e sincronizar tipos para garantir `npm run lint` e `npm run build` 100% limpos.

### Fase 6 a 8: Reestruturação do Banco de Dados Supabase (Pacote SQL)
Criação dos 9 scripts SQL modulares, idempotentes e seguros:
- `01_DIAGNOSTICO_SUPABASE.sql`
- `02_ESTRUTURA_COMPLETA_SUPABASE.sql`
- `03_INTEGRIDADE_E_RELACIONAMENTOS.sql`
- `04_SEGURANCA_E_RLS.sql`
- `05_INDICES_E_PERFORMANCE.sql`
- `06_FUNCOES_E_TRIGGERS.sql`
- `07_LIMPEZA_E_NORMALIZACAO.sql`
- `08_VALIDACAO_FINAL_SUPABASE.sql`
- `09_ROLLBACK_E_RECUPERACAO.sql`
