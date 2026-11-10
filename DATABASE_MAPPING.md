# MAPA DE CORRESPONDÊNCIA CÓDIGO X BANCO DE DADOS (DATABASE_MAPPING.md)
## SISTEMA OPERACIONAL TURNOCERTO — SUPABASE / REACT / TYPESCRIPT

Este documento estabelece o mapeamento bidirecional rigoroso entre todas as entidades, interfaces, DTOs e funções do código React/TypeScript (`src/types/index.ts` e `src/context/AppContext.tsx`) e as tabelas, colunas, tipos e constraints do banco Supabase PostgreSQL.

---

## 1. ENTIDADE: COLABORADOR / FUNCIONÁRIO

### Interface TypeScript: `Colaborador` & DTO: `NovoFuncionarioPayload`
- **Tabela Primária:** `public.colaboradores`
- **Tabela Secundária (Auth/Profiles):** `public.profiles`
- **Funções de Persistência no Código:** `cadastrarFuncionario`, `atualizarFuncionario`, `excluirFuncionario`, `alocarColaborador`, `substituirColaborador`, `removerColaboradorDoPosto`, `syncWithSupabase`, `trocarSenha`.

| Campo TypeScript | Coluna Supabase (`colaboradores`) | Tipo SQL | Regra de Transformação / Conversão |
|---|---|---|---|
| `id: string` | `id` | `TEXT` | ID alfanumérico gerado (`colab-...`) ou UUID do usuário. |
| `nome: string` | `nome` e `full_name` | `TEXT` | Gravado em ambas as colunas para total compatibilidade com queries SQL e Auth. |
| `matricula: string` | `matricula` | `TEXT` | Se ausente, preenchido automaticamente com formato `'TC-XXXX'`. |
| `funcao: FuncaoColaborador` | `funcao` e `cargo` | `TEXT` | Gravado em `funcao` e espelhado em `cargo`. |
| `condominioId: string \| null` | `condominio_id` | `TEXT` | Chave estrangeira para `condominios.id`. Se nulo, representa a Reserva Central. |
| `postoNome: string` | *(calculado via JOIN/hidratado)*| - | Hidratado na aplicação associando `condominio_id` com o nome do condomínio. |
| `status: StatusColaborador` | `status` | `TEXT` | Enum no app (`'no_posto'`, `'folga'`, `'falta'`, `'afastado'`). Gravado diretamente em `status`. |
| `jornada: string` | `jornada` | `TEXT` | Formato amigável: `'{tipo_jornada} ({turno_inicio} - {turno_fim})'`. |
| `tipoEscala: string` | `tipo_jornada` | `TEXT` | `'12x36'`, `'6x1'`, `'5x2'`. |
| `turnoInicio?: string` | `turno_inicio` | `TIME` | Horário string HH:MM convertido em `TIME` (ex: `'07:00:00'`). |
| `turnoFim?: string` | `turno_fim` | `TIME` | Horário string HH:MM convertido em `TIME` (ex: `'19:00:00'`). |
| `foto: string` | `foto_url` | `TEXT` | URL da foto hospedada no bucket de Storage ou Unsplash padrão. |
| `telefone: string` | `telefone` | `TEXT` | Telefone com máscara ou dígitos limpos. |
| `cpf: string` | `cpf` | `TEXT` | CPF único. Higienizado na persistência e na consulta. |
| `rg?: string` | `rg` | `TEXT` | Número do documento de identidade. |
| `dataNascimento?: string` | `data_nascimento` | `DATE` | String ISO YYYY-MM-DD convertida para `DATE`. |
| `pis?: string` | `pis` | `TEXT` | PIS/PASEP para eSocial. |
| `ctps?: string` | `ctps` | `TEXT` | Número e série da Carteira de Trabalho. |
| `nomeMae?: string` | `nome_mae` | `TEXT` | Nome materno completo. |
| `endereco?: string` | `endereco` | `TEXT` | Endereço residencial completo. |
| `dataAdmissao: string` | `data_admissao` | `DATE` | Data de admissão na empresa. Default `CURRENT_DATE`. |
| `salarioBase: number` | `salario_base` | `NUMERIC(10,2)` | Convertido para float/decimal (`Number(dados.salarioBase) \|\| 2150.00`). |
| `bancoHoras: number` | `banco_horas` | `NUMERIC(6,2)` | Saldo de horas extras ou compensações acumuladas. |
| `pix?: string` | `pix` | `TEXT` | Chave PIX informada no cadastro. |
| `banco?: string` | `banco` | `TEXT` | Instituição bancária do colaborador. |
| `agencia?: string` | `agencia` | `TEXT` | Agência bancária. |
| `conta?: string` | `conta` | `TEXT` | Conta corrente ou salário. |
| `recebeVT?: boolean` | `recebe_vt` | `BOOLEAN` | Boolean (`true`/`false`). Default `true`. |
| `recebeVR?: boolean` | `recebe_vr` | `BOOLEAN` | Boolean (`true`/`false`). Default `true`. |
| `valorVR?: number` | `valor_vr` | `NUMERIC(10,2)` | Valor diário do VR (`Number(valorVR) \|\| 28.50`). |
| `recebeVA?: boolean` | `recebe_va` | `BOOLEAN` | Boolean (`true`/`false`). Default `true`. |
| `valorVA?: number` | `valor_va` | `NUMERIC(10,2)` | Valor mensal do VA (`Number(valorVA) \|\| 220.00`). |
| `valorExtraFT?: number` | `valor_extra_ft` | `NUMERIC(10,2)` | Diária de cobertura folguista FT (`Number(valorExtraFT) \|\| 160.00`). |
| `valorBonus?: number` | `valor_bonus` | `NUMERIC(10,2)` | Bônus assiduidade mensal (`Number(valorBonus) \|\| 0.00`). |
| `email?: string` | `email` | `TEXT` | E-mail para autenticação e notificações. |
| `senha?: string` | `senha` | `TEXT` | Senha sincronizada para acesso ao portal. |
| `role?: string` | `role` | `TEXT` | `'admin'`, `'supervisor'` ou `'funcionario'`. |
| `primeiroAcessoConcluido?: boolean` | `primeiro_acesso_concluido` | `BOOLEAN` | Indicador de alteração de senha inicial. |

---

## 2. ENTIDADE: CONDOMÍNIO / POSTO DE TRABALHO

### Interface TypeScript: `CondominioPosto`
- **Tabela Primária:** `public.condominios`
- **Tabela de Espelho:** `public.postos`
- **Funções de Persistência:** `cadastrarCondominio`, `atualizarCondominio`, `excluirCondominio`, `alocarColaborador`, `substituirColaborador`, `syncWithSupabase`.

| Campo TypeScript | Coluna Supabase (`condominios`) | Tipo SQL | Regra de Transformação / Conversão |
|---|---|---|---|
| `id: string` | `id` | `TEXT` | ID alfanumérico (`cond-...`) ou UUID. |
| `nome: string` | `nome` | `TEXT` | Nome do condomínio/posto. |
| `tipo: string` | `tipo` | `TEXT` | `'Residencial'`, `'Comercial'`, etc. Default `'Residencial'`. |
| `cnpj: string` | `cnpj` | `TEXT` | CNPJ formatado ou numérico. |
| `contratoNumero: string` | `contrato_numero` | `TEXT` | Código identificador do contrato terceirizado. |
| `endereco: string` | `endereco` | `TEXT` | Endereço físico da guarita / condomínio. |
| `bairro: string` | `bairro` | `TEXT` | Bairro do condomínio. |
| `cidade: string` | `cidade` | `TEXT` | Cidade e Estado. |
| `supervisor: string` | `supervisor` | `TEXT` | Nome do supervisor de área. |
| `telefoneSupervisor: string` | `telefone_supervisor` | `TEXT` | Telefone de contato do supervisor. |
| `vagasContratadas: number` | `vagas_contratadas` | `INTEGER` | Quantidade de postos contratados. |
| `status: string` | `status` | `TEXT` | `'operacional'`, `'atencao'`, `'critico'`. |
| `motivoAtencao?: string` | `motivo_atencao` | `TEXT` | Texto detalhado se o posto tiver pendência de escala. |
| `tipoEscalaPadrao: string` | `tipo_escala_padrao` | `TEXT` | Escala habitual da guarita. |
| `coberturaPercentual: number`| `cobertura_percentual`| `NUMERIC(5,2)` | Percentual numérico calculado (ex: 100.00). |
| `contatoSindico: string` | `contato_sindico` | `TEXT` | Nome do contato cliente. |
| `telefoneSindico: string` | `telefone_sindico` | `TEXT` | Telefone do síndico / zelador. |
| `instrucoesGuarita: string` | `instrucoes_guarita` | `TEXT` | Normas operacionais específicas do posto. |
| `foto?: string` | `foto_url` | `TEXT` | URL da foto da guarita / condomínio. |
| `plantaoAtual` (objeto) | *(reconstruído na hidratação)*| - | Montado em memória agrupando os colaboradores que possuem `condominio_id == cond.id`. |

---

## 3. ENTIDADE: OCORRÊNCIA OPERACIONAL

### Interface TypeScript: `Ocorrencia`
- **Tabela Primária:** `public.ocorrencias`
- **Funções de Persistência:** `criarOcorrencia`, `substituirColaborador`, `syncWithSupabase`.

| Campo TypeScript | Coluna Supabase (`ocorrencias`) | Tipo SQL | Regra de Transformação / Conversão |
|---|---|---|---|
| `id: string` | `id` | `TEXT` | ID da ocorrência (`ocorr-...`). |
| `postoId: string` | `posto_id` | `TEXT` | FK para `condominios.id`. |
| `postoNome: string` | `posto_nome` | `TEXT` | Nome descritivo do posto. |
| `tipo: string` | `tipo` | `TEXT` | Tipo da ocorrência. |
| `descricao: string` | `descricao` | `TEXT` | Relatório completo da ocorrência. |
| `registradoPor: string` | `registrado_por` | `TEXT` | Identificação de quem efetuou o registro. |
| `dataHora: string` | `data_hora` | `TEXT` | Texto com data e horário amigável para exibição direta. |
| `urgencia: string` | `urgencia` | `TEXT` | `'baixa'`, `'media'`, `'alta'`. |
| `resolvida: boolean` | `resolvida` | `BOOLEAN` | Boolean (`true`/`false`). |

---

## 4. ENTIDADE: ALERTA OPERACIONAL

### Interface TypeScript: `AlertaOperacional`
- **Tabela Primária:** `public.alertas`
- **Funções de Persistência:** `resolverAlerta`, `substituirColaborador`, `syncWithSupabase`.

| Campo TypeScript | Coluna Supabase (`alertas`) | Tipo SQL | Regra de Transformação / Conversão |
|---|---|---|---|
| `id: string` | `id` | `TEXT` | Chave primária (`alerta-...`). |
| `tipo: string` | `tipo` | `TEXT` | `'posto_descoberto'`, `'falta'`, `'atraso'`, `'atestado_pendente'`. |
| `gravidade: string` | `gravidade` | `TEXT` | `'critica'`, `'moderada'`, `'informativa'`. |
| `titulo: string` | `titulo` | `TEXT` | Título sintético do alerta. |
| `descricao: string` | `descricao` | `TEXT` | Descrição da anormalidade. |
| `postoId: string` | `posto_id` | `TEXT` | FK para `condominios.id`. |
| `postoNome: string` | `posto_nome` | `TEXT` | Nome do condomínio/posto. |
| `colaboradorId?: string` | `colaborador_id` | `TEXT` | FK opcional para `colaboradores.id`. |
| `colaboradorNome?: string`| `colaborador_nome` | `TEXT` | Nome do colaborador em falta/atraso. |
| `horario: string` | `horario` | `TEXT` | Horário da ocorrência do alerta (ex: `'07:00'`). |
| `resolvido: boolean` | `resolvido` | `BOOLEAN` | Boolean indicativo de resolução. |
| `resolvidoPor?: string` | `resolvido_por` | `TEXT` | Nome de quem atendeu o alerta. |
| `resolvidoEm?: string` | `resolvido_em` | `TEXT` | Horário/data em que foi solucionado. |

---

## 5. ENTIDADE: CONTROLE DE PONTO ELETRÔNICO

### Interface TypeScript: `PontoRegistro`
- **Tabela Primária:** `public.pontos`
- **Funções de Persistência:** `registrarPonto`, `syncWithSupabase`.

| Campo TypeScript | Coluna Supabase (`pontos`) | Tipo SQL | Regra de Transformação / Conversão |
|---|---|---|---|
| `id: string` | `id` | `TEXT` | Identificador do ponto (`ponto-...`). |
| `colaboradorId: string` | `colaborador_id` | `TEXT` | FK para `colaboradores.id`. |
| `colaboradorNome: string`| `colaborador_nome` | `TEXT` | Nome do colaborador. |
| `data: string` | `data` | `DATE` | Data do registro da jornada (YYYY-MM-DD). |
| `entrada1: string` | `entrada_1` | `TEXT` | Primeiro registro de entrada. |
| `saida1: string` | `saida_1` | `TEXT` | Início do intervalo. |
| `entrada2: string` | `entrada_2` | `TEXT` | Fim do intervalo. |
| `saida2: string` | `saida_2` | `TEXT` | Saída final do turno. |
| `totalHoras: string` | `total_horas` | `TEXT` | Saldo apurado de horas trabalhadas (ex: `'11h 00m'`). |
| `statusPonto: string` | `status_ponto` e `status` | `TEXT` | Situação: `'Regular'`, `'Atraso'`, `'Hora Extra'`, `'Falta'`. |
| `localizacaoGPS: string` | `localizacao_gps` | `TEXT` | Informação do geofence (ex: `'Dentro do Raio Geofence (12m)'`). |

---

## 6. ENTIDADE: HOLERITE DIGITAL & DEMONSTRATIVO

### Interface TypeScript: `HoleriteRegistro`
- **Tabela Primária:** `public.holerites`
- **Funções de Persistência:** `assinarHolerite`, `syncWithSupabase`.

| Campo TypeScript | Coluna Supabase (`holerites`) | Tipo SQL | Regra de Transformação / Conversão |
|---|---|---|---|
| `id: string` | `id` | `TEXT` | Identificador do holerite (`hol-...`). |
| `colaboradorId: string` | `colaborador_id` | `TEXT` | FK para `colaboradores.id`. |
| `colaboradorNome: string`| `colaborador_nome` | `TEXT` | Nome do colaborador. |
| `matricula: string` | `matricula` | `TEXT` | Matrícula do funcionário. |
| `funcao: string` | `funcao` | `TEXT` | Cargo na folha de pagamento. |
| `postoNome: string` | `posto_nome` | `TEXT` | Posto associado. |
| `mesReferencia: string` | `mes_referencia` | `TEXT` | Mês/Ano da competência (`'Outubro/2026'`). |
| `salarioBase: number` | `salario_base` | `NUMERIC(10,2)` | Salário base da categoria em R$. |
| `adicionalPericulosidade: number`| `adicional_periculosidade`| `NUMERIC(10,2)` | Valor do adicional periculosidade (30%). |
| `adicionalNoturno: number`| `adicional_noturno` | `NUMERIC(10,2)` | Adicional noturno pago. |
| `horasExtras50: number` | `horas_extras_50` | `NUMERIC(6,2)` | Total de horas extras apuradas. |
| `valorHorasExtras: number`| `valor_horas_extras` | `NUMERIC(10,2)` | Valor em R$ das horas extras. |
| `descontoINSS: number` | `desconto_inss` | `NUMERIC(10,2)` | Retenção INSS. |
| `descontoFGTS: number` | `desconto_fgts` | `NUMERIC(10,2)` | FGTS informativo. |
| `descontoVT: number` | `desconto_vt` | `NUMERIC(10,2)` | Desconto VT em folha. |
| `descontoVR: number` | `desconto_vr` | `NUMERIC(10,2)` | Desconto VR em folha. |
| `bonusAssiduidade?: number`| `bonus_assiduidade` | `NUMERIC(10,2)` | Bônus assiduidade. |
| `bonusAtivo?: boolean` | `bonus_ativo` | `BOOLEAN` | Se o funcionário manteve o bônus. |
| `motivoPerdaBonus?: string`| `motivo_perda_bonus`| `TEXT` | Justificativa de eventual cancelamento. |
| `liquidoReceber: number` | `liquido_receber` | `NUMERIC(10,2)` | Valor líquido final a pagar. |
| `statusEnvio: string` | `status_envio` | `TEXT` | `'Pendente'`, `'Aguardando Assinatura'`, `'Assinado'`. |
| `dataEmissao: string` | `data_emissao` | `DATE` | Data de emissão. |

---

## 7. ENTIDADE: ATESTADO MÉDICO

### Interface TypeScript: `AtestadoMedico`
- **Tabela Primária:** `public.atestados`
- **Funções de Persistência:** `aprovarAtestado`, `recusarAtestado`, `syncWithSupabase`.

| Campo TypeScript | Coluna Supabase (`atestados`) | Tipo SQL | Regra de Transformação / Conversão |
|---|---|---|---|
| `id: string` | `id` | `TEXT` | Identificador do atestado (`atest-...`). |
| `colaboradorId: string` | `colaborador_id` | `TEXT` | FK para `colaboradores.id`. |
| `colaboradorNome: string`| `colaborador_nome` | `TEXT` | Nome do colaborador. |
| `matricula: string` | `matricula` | `TEXT` | Matrícula do funcionário. |
| `postoNome: string` | `posto_nome` | `TEXT` | Posto de alocação original. |
| `medico: string` | `medico` | `TEXT` | Nome do médico emissor. |
| `crm: string` | `crm` | `TEXT` | CRM do médico. |
| `cid: string` | `cid` | `TEXT` | Código CID-10 do diagnóstico. |
| `dataInicio: string` | `data_inicio` | `DATE` | Data inicial do afastamento. |
| `diasAfastamento: number`| `dias_afastamento` | `INTEGER` | Quantidade de dias de afastamento médico. |
| `status: string` | `status` | `TEXT` | `'Pendente'`, `'Aprovado'`, `'Recusado'`. |
| `substitutoAlocadoId?: string`| `substituto_alocado_id`| `TEXT` | FK opcional para o substituto (FT) destacado. |
| `anexoUrl?: string` | `anexo_url` | `TEXT` | URL da foto/PDF do atestado no Supabase Storage. |

---

## 8. ENTIDADE: EMPRESA MATRIZ

### Interface TypeScript: `EmpresaInfo`
- **Tabela Primária:** `public.empresa_info`
- **Funções de Persistência:** `atualizarEmpresaInfo`, `syncWithSupabase`.

| Campo TypeScript | Coluna Supabase (`empresa_info`) | Tipo SQL | Regra de Transformação / Conversão |
|---|---|---|---|
| *(id fixo)* | `id` | `TEXT` | Sempre fixo em `'matriz-principal'` para garantir registro singleton. |
| `razaoSocial: string` | `razao_social` | `TEXT` | Razão Social completa. |
| `nomeFantasia: string` | `nome_fantasia` | `TEXT` | Nome Fantasia comercial. |
| `cnpj: string` | `cnpj` | `TEXT` | CNPJ da matriz formatado. |
| `inscricaoEstadual?: string`| `inscricao_estadual`| `TEXT` | Inscrição estadual. |
| `inscricaoMunicipal?: string`| `inscricao_municipal`| `TEXT` | Inscrição municipal. |
| `telefone: string` | `telefone` | `TEXT` | Telefone comercial. |
| `whatsapp: string` | `whatsapp` | `TEXT` | WhatsApp de atendimento. |
| `email: string` | `email` | `TEXT` | E-mail corporativo de contato. |
| `endereco: string` | `endereco` | `TEXT` | Endereço da sede. |
| `bairro: string` | `bairro` | `TEXT` | Bairro da sede. |
| `cidade: string` | `cidade` | `TEXT` | Cidade da sede. |
| `estado: string` | `estado` | `TEXT` | Estado (UF). |
| `cep: string` | `cep` | `TEXT` | CEP da matriz. |
| `responsavelOperacional: string`| `responsavel_operacional`| `TEXT` | Nome do gestor operacional. |
| `cargoResponsavel: string`| `cargo_responsavel` | `TEXT` | Cargo do gestor operacional. |
| `chavePix?: string` | `chave_pix` | `TEXT` | Chave PIX oficial da empresa. |
| `logoUrl?: string` | `logo_url` | `TEXT` | URL da logomarca da empresa. |
| `apresentacao?: string` | `apresentacao` | `TEXT` | Texto institucional. |

---

## 9. ENTIDADE: AUTENTICAÇÃO E SESSÃO

### Interface TypeScript: `UsuarioAuth`
- **Fontes de Dados:** `public.colaboradores`, `public.profiles` e fallback estático para Super Admin / Supervisora.
- **Funções de Persistência:** `login`, `logout`, `trocarSenha`.

| Campo TypeScript | Origem dos Dados no Supabase |
|---|---|
| `id: string` | `colaboradores.id` ou `profiles.id` |
| `nome: string` | `colaboradores.nome` ou `profiles.full_name` |
| `email: string` | `colaboradores.email` ou `profiles.email` |
| `role: 'admin' \| 'supervisor' \| 'funcionario'` | `colaboradores.role` ou `profiles.role` |
| `cargo?: string` | `colaboradores.funcao` ou `profiles.cargo` |
| `colaboradorId?: string` | `colaboradores.id` |
| `avatarUrl?: string` | `colaboradores.foto_url` |
| `postoNome?: string` | Nome do posto resolvido via `colaboradores.condominio_id` |
| `senha?: string` | `colaboradores.senha` |
