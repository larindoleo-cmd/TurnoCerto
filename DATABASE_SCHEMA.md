# DICIONÁRIO DE DADOS E ESPECIFICAÇÃO DE SCHEMA (DATABASE_SCHEMA.md)
## SISTEMA OPERACIONAL TURNOCERTO — SUPABASE / POSTGRESQL

**Versão do Schema:** 2.4.0 (Canônico)  
**Data:** 08/11/2026  
**Ambiente:** Supabase PostgreSQL 15+ (Cloud / Self-Hosted)  
**Extensões Requeridas:** `uuid-ossp`, `pgcrypto`  
**Padrão de Nomenclatura:** `snake_case` para objetos SQL; IDs com suporte dual `TEXT` e `UUID`.

---

## 1. VISÃO GERAL DA ARQUITETURA DE DADOS

O banco de dados do **TurnoCerto** foi projetado para atender aos requisitos operacionais críticos de empresas terceirizadas de serviços (segurança patrimonial, controle de acesso, portaria, recepção e limpeza):
1. **Núcleo Estrutural:** Cadastro de postos/condomínios contratantes e funcionários alocados com suporte a escalas CLT/CCT (`12x36`, `6x1`, `5x2`).
2. **Núcleo de Operação em Tempo Real:** Alocação de postos, despachos de coberturas volantes (Folguistas FT), registro de faltas/atrasos, ocorrências em guarita e rondas de supervisão.
3. **Núcleo de Ponto Eletrônico:** Registro biométrico/fotográfico e coordenadas geográficas (latitude, longitude, raio geofence) com validação de conformidade com a Portaria 671 MTE.
4. **Núcleo de Recursos Humanos & Folha:** Gestão de benefícios (VT, VR, VA, Bônus de Assiduidade, Extra FT), protocolo de atestados médicos com CID e assinatura digital de holerites com carimbo SHA-256.
5. **Núcleo Institucional:** Parâmetros cadastrais e fiscais da empresa matriz.
6. **Armazenamento de Mídia (Supabase Storage):** Armazenamento de fotos de perfil, fotos de ocorrências, comprovantes de ponto, atestados médicos digitalizados e PDFs de holerites.

---

## 2. DICIONÁRIO DE TABELAS E COLUNAS

### 2.1. Tabela: `public.condominios` (Mestra de Postos de Serviço / Clientes)
Entidade primária responsável pelo cadastro de postos operacionais contratados.

| Coluna | Tipo PostgreSQL | Nulo | Default | Descrição / Regra de Negócio |
|---|---|---|---|---|
| `id` | `TEXT` | NÃO | Auto-gerado (`cond-...` ou `UUID`) | Chave primária. Suporta identificador alfanumérico ou UUID. |
| `nome` | `TEXT` | NÃO | - | Nome fantasia do condomínio ou empresa cliente. |
| `tipo` | `TEXT` | NÃO | `'Residencial'` | Segmento: `'Residencial'`, `'Comercial'`, `'Industrial'`, `'Condomínio de Casas'`. |
| `cnpj` | `TEXT` | SIM | `'00.000.000/0001-00'` | CNPJ do condomínio contratante (formatado ou numérico). |
| `contrato_numero` | `TEXT` | SIM | - | Número de registro do contrato de prestação de serviços. |
| `endereco` | `TEXT` | SIM | - | Logradouro e número do posto de trabalho. |
| `bairro` | `TEXT` | SIM | - | Bairro onde o posto está localizado. |
| `cidade` | `TEXT` | SIM | `'São Paulo - SP'` | Cidade e UF do posto. |
| `supervisor` | `TEXT` | SIM | `'Supervisora Silva'` | Supervisor operacional responsável pela rota deste posto. |
| `telefone_supervisor` | `TEXT` | SIM | - | Telefone de contato direto do supervisor. |
| `vagas_contratadas` | `INTEGER` | NÃO | `2` | Quantidade total de colaboradores previstos no contrato. |
| `vagas_ocupadas` | `INTEGER` | NÃO | `0` | Quantidade real de colaboradores atualmente alocados. |
| `status` | `TEXT` | NÃO | `'operacional'` | Status: `'operacional'`, `'atencao'`, `'critico'`. |
| `motivo_atencao` | `TEXT` | SIM | `NULL` | Justificativa operacional quando status != `'operacional'`. |
| `tipo_escala_padrao` | `TEXT` | SIM | `'12x36 (07:00 - 19:00)'` | Escala horária contratada para a guarita. |
| `cobertura_percentual` | `NUMERIC(5,2)` | NÃO | `100.00` | Percentual de cobertura do efetivo (0% a 100%). |
| `contato_sindico` | `TEXT` | SIM | - | Nome do síndico, zelador ou gestor predial contratante. |
| `telefone_sindico` | `TEXT` | SIM | - | Telefone de emergência do síndico ou zeladoria. |
| `instrucoes_guarita` | `TEXT` | SIM | - | Procedimentos operacionais padrão (POP) e regras de acesso. |
| `foto_url` | `TEXT` | SIM | - | URL da foto da fachada do condomínio / guarita. |
| `latitude` | `DOUBLE PRECISION`| NÃO | `-23.5505` | Latitude para geofence do ponto eletrônico. |
| `longitude` | `DOUBLE PRECISION`| NÃO | `-46.6333` | Longitude para geofence do ponto eletrônico. |
| `raio_tolerancia_metros` | `INTEGER` | NÃO | `150` | Raio máximo permitido em metros para registro de ponto. |
| `ativo` | `BOOLEAN` | NÃO | `TRUE` | Indicador de contrato ativo. |
| `created_at` | `TIMESTAMPTZ` | NÃO | `NOW()` | Timestamp de criação do registro. |
| `updated_at` | `TIMESTAMPTZ` | NÃO | `NOW()` | Timestamp da última atualização. |

---

### 2.2. Tabela: `public.colaboradores` (Efetivo Operacional / Funcionários)
Tabela mestra de funcionários operacionais e administrativos com dados contratuais e eSocial.

| Coluna | Tipo PostgreSQL | Nulo | Default | Descrição / Regra de Negócio |
|---|---|---|---|---|
| `id` | `TEXT` | NÃO | Auto-gerado (`colab-...` ou `UUID`) | Chave primária do colaborador. |
| `nome` | `TEXT` | NÃO | - | Nome completo do colaborador. |
| `full_name` | `TEXT` | SIM | - | Sinônimo de `nome` para compatibilidade com Auth. |
| `matricula` | `TEXT` | SIM | - | Matrícula funcional (ex: `'TC-1180'`). |
| `cpf` | `TEXT` | SIM | `NULL` | CPF do colaborador (chave única natural). |
| `rg` | `TEXT` | SIM | - | Registro Geral (RG) com órgão emissor. |
| `data_nascimento` | `DATE` | SIM | - | Data de nascimento. |
| `telefone` | `TEXT` | SIM | - | Telefone de contato / WhatsApp. |
| `foto_url` | `TEXT` | SIM | - | URL da fotografia para crachá e reconhecimento. |
| `pis` | `TEXT` | SIM | - | Número PIS/PASEP para eSocial. |
| `ctps` | `TEXT` | SIM | - | Carteira de Trabalho e Previdência Social. |
| `nome_mae` | `TEXT` | SIM | - | Nome da mãe (exigência eSocial/CLT). |
| `endereco` | `TEXT` | SIM | - | Endereço residencial completo. |
| `funcao` | `TEXT` | NÃO | `'Porteiro'` | Cargo operacional: Porteiro Líder, Porteiro, Controlador de Acesso, Vigilante, Auxiliar de Limpeza, Zelador, Supervisor, Volante. |
| `cargo` | `TEXT` | SIM | `'Porteiro'` | Sinônimo de `funcao` para conformidade com schema de perfis. |
| `condominio_id` | `TEXT` | SIM | `NULL` | FK para `condominios.id`. Se `NULL`, colaborador está na Matriz/Reserva Central. |
| `status` | `TEXT` | NÃO | `'no_posto'` | Status operacional: `'no_posto'`, `'folga'`, `'falta'`, `'afastado'`, `'disponivel'`. |
| `jornada` | `TEXT` | SIM | `'12x36 (07:00 - 19:00)'` | Descrição amigável da jornada de trabalho. |
| `tipo_jornada` | `TEXT` | SIM | `'12x36'` | Tipo de regime: `'12x36'`, `'6x1'`, `'5x2'`. |
| `turno_inicio` | `TIME` | SIM | `'07:00:00'` | Horário de início do turno. |
| `turno_fim` | `TIME` | SIM | `'19:00:00'` | Horário de término do turno. |
| `data_admissao` | `DATE` | SIM | `CURRENT_DATE` | Data de admissão na empresa. |
| `salario_base` | `NUMERIC(10,2)` | NÃO | `2150.00` | Salário base da categoria em R$. |
| `banco_horas` | `NUMERIC(6,2)` | NÃO | `0.00` | Saldo de banco de horas (positivo ou negativo). |
| `pix` | `TEXT` | SIM | - | Chave PIX do colaborador para adiantamentos e pagamentos. |
| `banco` | `TEXT` | SIM | `'341 - Itaú Unibanco S.A.'` | Nome / código do banco. |
| `agencia` | `TEXT` | SIM | - | Agência bancária. |
| `conta` | `TEXT` | SIM | - | Conta corrente / poupança com dígito. |
| `recebe_vt` | `BOOLEAN` | NÃO | `TRUE` | Optante por Vale Transporte (desconto legal de até 6%). |
| `recebe_vr` | `BOOLEAN` | NÃO | `TRUE` | Recebe Vale Refeição. |
| `valor_vr` | `NUMERIC(10,2)` | NÃO | `28.50` | Valor diário do Vale Refeição. |
| `recebe_va` | `BOOLEAN` | NÃO | `TRUE` | Recebe Vale Alimentação (cesta básica). |
| `valor_va` | `NUMERIC(10,2)` | NÃO | `220.00` | Valor mensal da cesta de alimentação. |
| `valor_extra_ft` | `NUMERIC(10,2)` | NÃO | `160.00` | Valor da diária de cobertura / dobra volante (FT). |
| `valor_bonus` | `NUMERIC(10,2)` | NÃO | `0.00` | Valor do bônus de assiduidade contratual. |
| `email` | `TEXT` | SIM | - | E-mail para acesso ao aplicativo do colaborador. |
| `senha` | `TEXT` | SIM | `'Turno@2026'` | Senha de acesso ao portal (armazenada/sincronizada). |
| `role` | `TEXT` | NÃO | `'funcionario'` | Papel de acesso: `'admin'`, `'supervisor'`, `'funcionario'`. |
| `primeiro_acesso_concluido` | `BOOLEAN` | NÃO | `FALSE` | Flag de troca de senha no primeiro login. |
| `created_at` | `TIMESTAMPTZ` | NÃO | `NOW()` | Data de cadastro. |
| `updated_at` | `TIMESTAMPTZ` | NÃO | `NOW()` | Data da última alteração. |

---

### 2.3. Tabela: `public.profiles` (Espelho de Usuários do Supabase Auth)
Vincula os usuários registrados no `auth.users` ao controle interno de permissões e colaboradores.

| Coluna | Tipo PostgreSQL | Nulo | Default | Descrição |
|---|---|---|---|---|
| `id` | `TEXT` | NÃO | - | ID correspondente ao usuário autenticado (`auth.uid()`) ou colaborador. |
| `email` | `TEXT` | SIM | - | E-mail de login. |
| `full_name` | `TEXT` | SIM | - | Nome completo do usuário. |
| `nome` | `TEXT` | SIM | - | Nome operacional. |
| `cpf` | `TEXT` | SIM | - | CPF do usuário. |
| `rg` | `TEXT` | SIM | - | RG. |
| `telefone` | `TEXT` | SIM | - | Telefone de contato. |
| `data_nascimento`| `DATE` | SIM | - | Data de nascimento. |
| `cargo` | `TEXT` | SIM | `'Porteiro'` | Cargo / Função. |
| `role` | `TEXT` | NÃO | `'funcionario'` | Permissão: `'admin'`, `'supervisor'`, `'funcionario'`. |
| `condominio_id` | `TEXT` | SIM | `NULL` | Posto fixo (se aplicável). |
| `foto_url` | `TEXT` | SIM | - | Foto de perfil. |
| `created_at` | `TIMESTAMPTZ` | NÃO | `NOW()` | Data de criação. |
| `updated_at` | `TIMESTAMPTZ` | NÃO | `NOW()` | Data de atualização. |

---

### 2.4. Tabela: `public.postos` (Retrocompatibilidade)
Mantida por exigência de retrocompatibilidade com versões legadas e sincronizada de forma bidirecional via triggers com `public.condominios`.

| Coluna | Tipo PostgreSQL | Nulo | Default | Descrição |
|---|---|---|---|---|
| `id` | `TEXT` | NÃO | - | Chave primária idêntica ao ID do condomínio correspondente. |
| `nome` | `TEXT` | NÃO | - | Nome do condomínio/posto. |
| `tipo` | `TEXT` | SIM | `'Residencial'` | Tipo de empreendimento. |
| `cnpj` | `TEXT` | SIM | - | CNPJ do posto. |
| `endereco` | `TEXT` | SIM | - | Endereço do posto. |
| `bairro` | `TEXT` | SIM | - | Bairro. |
| `cidade` | `TEXT` | SIM | - | Cidade. |
| `supervisor` | `TEXT` | SIM | - | Supervisor responsável. |
| `status` | `TEXT` | SIM | `'operacional'` | Status operacional. |
| `updated_at` | `TIMESTAMPTZ` | NÃO | `NOW()` | Timestamp de atualização. |

---

### 2.5. Tabela: `public.ocorrencias` (Livro de Ocorrências e Rondas Operacionais)
Registra incidentes, vistorias, manutenções e registros de plantão em postos.

| Coluna | Tipo PostgreSQL | Nulo | Default | Descrição / Regra de Negócio |
|---|---|---|---|---|
| `id` | `TEXT` | NÃO | Auto-gerado (`ocorr-...`) | Identificador único da ocorrência. |
| `posto_id` | `TEXT` | NÃO | - | FK para `condominios.id`. |
| `posto_nome` | `TEXT` | SIM | - | Nome denormalizado do posto para consultas rápidas. |
| `tipo` | `TEXT` | NÃO | `'Posto Descoberto'` | Tipo: `'Posto Descoberto'`, `'Atraso'`, `'Falta de Material'`, `'Manutenção em Portão'`, `'Ronda'`, `'Ponto Divergente'`. |
| `descricao` | `TEXT` | NÃO | - | Relatório detalhado dos fatos observados no posto. |
| `registrado_por`| `TEXT` | NÃO | `'Supervisora Silva'` | Nome ou matrícula de quem lavrou a ocorrência. |
| `data_hora` | `TEXT` | NÃO | - | Data e hora amigável da ocorrência. |
| `urgencia` | `TEXT` | NÃO | `'media'` | Nível de severidade: `'baixa'`, `'media'`, `'alta'`. |
| `resolvida` | `BOOLEAN` | NÃO | `FALSE` | Status de resolução da pendência. |
| `fotos` | `TEXT[]` | SIM | `ARRAY[]::TEXT[]` | Array de URLs de fotografias comprobatórias (Supabase Storage). |
| `created_at` | `TIMESTAMPTZ` | NÃO | `NOW()` | Timestamp de inserção. |
| `updated_at` | `TIMESTAMPTZ` | NÃO | `NOW()` | Timestamp de atualização. |

---

### 2.6. Tabela: `public.alertas` (Painel Operacional em Tempo Real)
Gera alertas de controle operacional para a supervisão e despachantes FT.

| Coluna | Tipo PostgreSQL | Nulo | Default | Descrição / Regra de Negócio |
|---|---|---|---|---|
| `id` | `TEXT` | NÃO | Auto-gerado (`alerta-...`)| Chave primária do alerta. |
| `tipo` | `TEXT` | NÃO | `'posto_descoberto'` | Categoria: `'posto_descoberto'`, `'falta'`, `'atraso'`, `'atestado_pendente'`. |
| `gravidade` | `TEXT` | NÃO | `'critica'` | Gravidade: `'critica'`, `'moderada'`, `'informativa'`. |
| `titulo` | `TEXT` | NÃO | - | Título curto do alerta operacional. |
| `descricao` | `TEXT` | NÃO | - | Detalhamento do impacto operacional e ação sugerida. |
| `posto_id` | `TEXT` | NÃO | - | FK para `condominios.id`. |
| `posto_nome` | `TEXT` | SIM | - | Nome denormalizado do posto. |
| `colaborador_id` | `TEXT`| SIM | `NULL` | FK opcional para `colaboradores.id`. |
| `colaborador_nome` | `TEXT`| SIM | `NULL` | Nome do colaborador associado ao alerta. |
| `horario` | `TEXT` | NÃO | `'07:00'` | Horário de detecção da inconformidade. |
| `resolvido` | `BOOLEAN` | NÃO | `FALSE` | Indicador se o alerta foi atendido. |
| `resolvido_por` | `TEXT` | SIM | - | Identificação do supervisor que tratou o alerta. |
| `resolvido_em` | `TEXT` | SIM | - | Timestamp/horário em que a tratativa foi encerrada. |
| `created_at` | `TIMESTAMPTZ` | NÃO | `NOW()` | Timestamp de disparo do alerta. |
| `updated_at` | `TIMESTAMPTZ` | NÃO | `NOW()` | Timestamp de atualização do alerta. |

---

### 2.7. Tabela: `public.pontos` (Controle Eletrônico de Frequência Mobile)
Registros de entrada, intervalos e saídas com geolocalização e fotografia facial.

| Coluna | Tipo PostgreSQL | Nulo | Default | Descrição / Regra de Negócio |
|---|---|---|---|---|
| `id` | `TEXT` | NÃO | Auto-gerado (`ponto-...`) | Chave primária da batida de ponto. |
| `colaborador_id`| `TEXT` | NÃO | - | FK para `colaboradores.id`. |
| `colaborador_nome`| `TEXT` | SIM | - | Nome do colaborador no momento do ponto. |
| `condominio_id` | `TEXT` | SIM | `NULL` | FK para `condominios.id` onde o ponto foi batido. |
| `data` | `DATE` | NÃO | `CURRENT_DATE` | Data do registro da jornada (YYYY-MM-DD). |
| `entrada_1` | `TEXT` | SIM | `'07:00'` | Horário da primeira entrada. |
| `saida_1` | `TEXT` | SIM | `'12:00'` | Horário de início do intervalo intrajornada. |
| `entrada_2` | `TEXT` | SIM | `'13:00'` | Horário de retorno do intervalo. |
| `saida_2` | `TEXT` | SIM | `'19:00'` | Horário de encerramento da jornada. |
| `total_horas` | `TEXT` | SIM | `'11h 00m'` | Total líquido de horas trabalhadas no turno. |
| `status_ponto` | `TEXT` | NÃO | `'Regular'` | Situação: `'Regular'`, `'Atraso'`, `'Hora Extra'`, `'Incompleto'`, `'Falta'`. |
| `status` | `TEXT` | SIM | `'Regular'` | Sinônimo de `status_ponto`. |
| `localizacao_gps`| `TEXT` | SIM | - | Status do geofence (ex: `'Dentro do Raio Geofence (12m)'`). |
| `latitude` | `DOUBLE PRECISION`| SIM | `NULL` | Latitude capturada via GPS do dispositivo móvel. |
| `longitude` | `DOUBLE PRECISION`| SIM | `NULL` | Longitude capturada via GPS do dispositivo móvel. |
| `foto_url` | `TEXT` | SIM | `NULL` | Fotografia facial de comprovação de presença. |
| `created_at` | `TIMESTAMPTZ` | NÃO | `NOW()` | Timestamp do registro. |

---

### 2.8. Tabela: `public.holerites` (Demonstrativo de Pagamento e Assinatura Digital)
Gestão de contracheques mensais com cálculo de adicionais e assinatura eletrônica.

| Coluna | Tipo PostgreSQL | Nulo | Default | Descrição / Regra de Negócio |
|---|---|---|---|---|
| `id` | `TEXT` | NÃO | Auto-gerado (`hol-...`) | Chave primária do holerite. |
| `colaborador_id` | `TEXT` | NÃO | - | FK para `colaboradores.id`. |
| `colaborador_nome` | `TEXT` | SIM | - | Nome do colaborador. |
| `matricula` | `TEXT` | SIM | - | Matrícula funcional. |
| `funcao` | `TEXT` | SIM | `'Porteiro'` | Função exercida no mês de competência. |
| `posto_nome` | `TEXT` | SIM | - | Posto principal de atuação no mês. |
| `mes_referencia` | `TEXT` | NÃO | `'Outubro/2026'` | Competência da folha de pagamento. |
| `salario_base` | `NUMERIC(10,2)` | NÃO | `2150.00` | Salário base da categoria. |
| `adicional_periculosidade`| `NUMERIC(10,2)`| NÃO | `0.00` | Adicional de periculosidade (30% s/ salário base). |
| `adicional_noturno` | `NUMERIC(10,2)`| NÃO | `0.00` | Adicional noturno proporcional às horas trabalhadas. |
| `horas_extras_50` | `NUMERIC(6,2)` | NÃO | `0.00` | Quantidade de horas extras a 50%. |
| `valor_horas_extras` | `NUMERIC(10,2)`| NÃO | `0.00` | Valor em R$ das horas extras calculadas. |
| `desconto_inss` | `NUMERIC(10,2)`| NÃO | `0.00` | Desconto previdenciário INSS. |
| `desconto_fgts` | `NUMERIC(10,2)`| NÃO | `0.00` | Valor do FGTS recolhido pela empresa (informativo). |
| `desconto_vt` | `NUMERIC(10,2)`| NÃO | `0.00` | Desconto legal de Vale Transporte (até 6%). |
| `desconto_vr` | `NUMERIC(10,2)`| NÃO | `0.00` | Desconto em folha de Vale Refeição. |
| `bonus_assiduidade`| `NUMERIC(10,2)`| NÃO | `0.00` | Bônus financeiro concedido por pontualidade e zero faltas. |
| `bonus_ativo` | `BOOLEAN` | NÃO | `TRUE` | Indicador se o colaborador manteve o direito ao bônus. |
| `motivo_perda_bonus`| `TEXT` | SIM | `NULL` | Motivo de cancelamento do bônus (ex: falta injustificada). |
| `liquido_receber` | `NUMERIC(10,2)`| NÃO | `2150.00` | Valor líquido creditado na conta bancária do funcionário. |
| `status_envio` | `TEXT` | NÃO | `'Pendente'` | Status: `'Pendente'`, `'Aguardando Assinatura'`, `'Assinado'`. |
| `data_emissao` | `DATE` | NÃO | `CURRENT_DATE` | Data de publicação do documento. |
| `data_assinatura` | `TIMESTAMPTZ` | SIM | `NULL` | Timestamp da assinatura eletrônica pelo colaborador. |
| `assinatura_digital_hash`| `TEXT` | SIM | `NULL` | Hash SHA-256 de autenticidade jurídica da assinatura. |
| `ip_assinatura` | `TEXT` | SIM | `NULL` | Endereço IP do dispositivo no momento da assinatura. |
| `documento_url` | `TEXT` | SIM | `NULL` | Link para download do espelho em PDF (Storage). |
| `created_at` | `TIMESTAMPTZ` | NÃO | `NOW()` | Timestamp de criação do registro. |
| `updated_at` | `TIMESTAMPTZ` | NÃO | `NOW()` | Timestamp de atualização. |

---

### 2.9. Tabela: `public.atestados` (Protocolo e Validação de Atestados Médicos)
Controle de afastamentos médicos, licenças, CID e substituições operacionais no posto.

| Coluna | Tipo PostgreSQL | Nulo | Default | Descrição / Regra de Negócio |
|---|---|---|---|---|
| `id` | `TEXT` | NÃO | Auto-gerado (`atest-...`) | Chave primária do protocolo do atestado. |
| `colaborador_id` | `TEXT` | NÃO | - | FK para `colaboradores.id`. |
| `colaborador_nome` | `TEXT` | SIM | - | Nome do colaborador afastado. |
| `matricula` | `TEXT` | SIM | - | Matrícula funcional. |
| `posto_nome` | `TEXT` | SIM | - | Nome do posto que necessitará de cobertura. |
| `medico` | `TEXT` | SIM | `'Dr. Médico'` | Nome do profissional de saúde emissor. |
| `crm` | `TEXT` | SIM | `'CRM 00000'` | Número do CRM e UF do médico emissor. |
| `cid` | `TEXT` | SIM | `'Z00.0'` | Código CID-10 do diagnóstico. |
| `data_inicio` | `DATE` | NÃO | `CURRENT_DATE` | Primeiro dia de afastamento médico. |
| `dias_afastamento` | `INTEGER` | NÃO | `1` | Quantidade de dias consecutivos de afastamento. |
| `status` | `TEXT` | NÃO | `'Pendente'` | Status de aprovação pelo RH: `'Pendente'`, `'Aprovado'`, `'Recusado'`. |
| `substituto_alocado_id`| `TEXT`| SIM | `NULL` | FK opcional para o Volante FT alocado para a cobertura. |
| `anexo_url` | `TEXT` | SIM | `NULL` | URL da foto ou digitalização do atestado (Storage). |
| `motivo_recusa` | `TEXT` | SIM | `NULL` | Justificativa técnica em caso de recusa pelo médico do trabalho. |
| `avaliado_por` | `TEXT` | SIM | `NULL` | Usuário de RH responsável pela validação. |
| `created_at` | `TIMESTAMPTZ` | NÃO | `NOW()` | Data de envio do atestado. |
| `updated_at` | `TIMESTAMPTZ` | NÃO | `NOW()` | Data de atualização do status. |

---

### 2.10. Tabela: `public.empresa_info` (Dados Cadastrais da Empresa Matriz)
Tabela singleton responsável pelos dados corporativos exibidos em relatórios, holerites e cabeçalhos.

| Coluna | Tipo PostgreSQL | Nulo | Default | Descrição |
|---|---|---|---|---|
| `id` | `TEXT` | NÃO | `'matriz-principal'` | Chave primária fixa para garantir registro único. |
| `razao_social` | `TEXT` | NÃO | `'TurnoCerto Terceirização e Serviços Ltda.'` | Razão Social jurídica. |
| `nome_fantasia` | `TEXT` | NÃO | `'TurnoCerto Serviços'` | Nome fantasia operacional. |
| `cnpj` | `TEXT` | NÃO | `'12.345.678/0001-90'` | CNPJ da matriz. |
| `inscricao_estadual` | `TEXT` | SIM | - | Inscrição estadual (IE). |
| `inscricao_municipal`| `TEXT` | SIM | - | Inscrição municipal (IM / CCM). |
| `telefone` | `TEXT` | SIM | `'(11) 3221-4000'` | Telefone fixo da central de operações. |
| `whatsapp` | `TEXT` | SIM | `'(11) 98842-1190'` | WhatsApp de emergência operacional. |
| `email` | `TEXT` | SIM | `'operacional@turnocerto.com.br'` | E-mail oficial da matriz. |
| `endereco` | `TEXT` | SIM | `'Av. Paulista, 1000 - Bela Vista'` | Logradouro e número da sede. |
| `bairro` | `TEXT` | SIM | `'Bela Vista'` | Bairro da sede. |
| `cidade` | `TEXT` | SIM | `'São Paulo'` | Cidade da sede. |
| `estado` | `TEXT` | SIM | `'SP'` | Unidade Federativa. |
| `cep` | `TEXT` | SIM | `'01310-100'` | Código Postal. |
| `responsavel_operacional` | `TEXT`| SIM | `'Supervisora Silva'` | Nome do gestor operacional da matriz. |
| `cargo_responsavel` | `TEXT`| SIM | `'Gerente Operacional Sênior'` | Cargo do responsável. |
| `chave_pix` | `TEXT` | SIM | `'12.345.678/0001-90'` | Chave PIX oficial para depósitos. |
| `logo_url` | `TEXT` | SIM | - | URL da logomarca da empresa. |
| `apresentacao` | `TEXT` | SIM | - | Texto institucional de apresentação corporativa. |
| `created_at` | `TIMESTAMPTZ` | NÃO | `NOW()` | Timestamp de criação. |
| `updated_at` | `TIMESTAMPTZ` | NÃO | `NOW()` | Timestamp de atualização. |

---

## 3. BUCKETS DE STORAGE (SUPABASE STORAGE)

O sistema opera com 4 buckets de armazenamento com políticas de leitura e gravação seguras:

1. **`fotos-colaboradores`** (Público):
   - Fotos de perfil e biometria facial de colaboradores (`/avatars/{colaborador_id}.jpg`).
2. **`documentos-atestados`** (Privado):
   - Imagens digitalizadas e PDFs de atestados médicos (`/atestados/{ano}/{mes}/{atestado_id}.pdf`).
3. **`documentos-holerites`** (Privado):
   - Espelhos assinados de holerites e contracheques (`/holerites/{ano}/{mes}/{colaborador_id}.pdf`).
4. **`ocorrencias-anexos`** (Público / Autenticado):
   - Fotos tiradas por supervisores e porteiros de incidentes e vistorias (`/ocorrencias/{ocorrencia_id}_{timestamp}.jpg`).
