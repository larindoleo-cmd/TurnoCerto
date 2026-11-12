# DICIONÁRIO DE DADOS E ESPECIFICAÇÃO DE SCHEMA CANÔNICO (DATABASE_SCHEMA.md)
## SISTEMA OPERACIONAL TURNOCERTO — SUPABASE / POSTGRESQL 15+

**Versão do Schema:** 3.0.0 (Canônico e Padronizado)  
**Data:** 12/11/2026  
**Ambiente:** Supabase PostgreSQL 15+ (Cloud / Self-Hosted)  
**Extensões Requeridas:** `uuid-ossp`, `pgcrypto`  
**Padrão de Nomenclatura:** `snake_case` para objetos SQL; IDs alfanuméricos com prefixo semântico e compatibilidade com UUID (`TEXT`).

---

## 1. PRINCÍPIOS ARQUITETURAIS E PADRONIZAÇÃO

1. **Tabela Autoritativa de Postos:** `public.condominios` é a tabela mestra autoritativa e única fonte da verdade para postos, clientes e guaritas. A tabela `public.postos` é mantida exclusivamente como espelho de retrocompatibilidade sincronizado em tempo real via trigger PostgreSQL (`trg_sync_condominios_to_postos`).
2. **Geolocalização Canônica:** As colunas oficiais são `latitude` (`DOUBLE PRECISION`), `longitude` (`DOUBLE PRECISION`) e `raio_gps_metros` (`INTEGER DEFAULT 150`). Não possuem default rígido de São Paulo (postos não calibrados possuem coordenadas `NULL`). As colunas legadas `lat`, `lng` e `raio_tolerancia_metros` são sincronizadas bidirecionalmente pelo trigger `trg_sync_condominios_geo_columns`.
3. **Padrão de Tipos de IDs e FKs:**
   - Entidades de Negócio (`empresas`, `condominios`, `colaboradores`, `alertas`, `ocorrencias`, `pontos`, `ponto_eventos`, `holerites`, `atestados`): Utilizam **`TEXT`**, permitindo identificadores legíveis com prefixo (ex: `cond-alvorada-01`, `colab-carlos-1042`, `pe-xxxx`) ou strings UUID.
   - IDs de Autenticação (`auth.users.id`, `profiles.id`, `ponto_eventos.auth_user_id`): Utilizam **`UUID`**.
4. **Isolamento Multiempresa:** Tabela canônica `public.empresas` com chave estrangeira `empresa_id TEXT` em todas as tabelas operacionais e backfill automático para `'emp-matriz-principal'`.
5. **Portaria 671 MTE e Ponto Eletrônico:** Validação estrita de `metodo_autenticacao` aceitando unicamente:
   - `'biometria_facial'`
   - `'biometria_passkey'`
   - `'autenticador_dispositivo'`
   - `'excecao_autorizada'`

---

## 2. DICIONÁRIO DE TABELAS E COLUNAS

### 2.1. Tabela: `public.empresas` (Multiempresa / Matriz)
Entidade primária para isolamento organizacional de dados operacionais.

| Coluna | Tipo PostgreSQL | Nulo | Default | Descrição / Regra de Negócio |
|---|---|---|---|---|
| `id` | `TEXT` | NÃO | Auto-gerado (`emp-...`) | Chave primária alfanumérica. |
| `razao_social` | `TEXT` | NÃO | - | Razão Social registrada. |
| `nome_fantasia` | `TEXT` | NÃO | - | Nome fantasia comercial. |
| `cnpj` | `TEXT` | SIM | `NULL` | CNPJ único da empresa/filial. |
| `inscricao_estadual` | `TEXT` | SIM | `NULL` | Inscrição estadual. |
| `inscricao_municipal` | `TEXT` | SIM | `NULL` | Inscrição municipal. |
| `telefone` | `TEXT` | SIM | `NULL` | Telefone principal. |
| `whatsapp` | `TEXT` | SIM | `NULL` | WhatsApp de contato. |
| `email` | `TEXT` | SIM | `NULL` | E-mail institucional. |
| `endereco` | `TEXT` | SIM | `NULL` | Logradouro e número. |
| `bairro` | `TEXT` | SIM | `NULL` | Bairro da sede. |
| `cidade` | `TEXT` | SIM | `NULL` | Cidade da sede. |
| `estado` | `TEXT` | SIM | `NULL` | UF. |
| `cep` | `TEXT` | SIM | `NULL` | CEP. |
| `responsavel_operacional` | `TEXT` | SIM | `NULL` | Nome do gestor operacional. |
| `cargo_responsavel` | `TEXT` | SIM | `NULL` | Cargo do responsável. |
| `chave_pix` | `TEXT` | SIM | `NULL` | Chave PIX oficial. |
| `logo_url` | `TEXT` | SIM | `NULL` | URL da logomarca no Storage. |
| `apresentacao` | `TEXT` | SIM | `NULL` | Texto institucional. |
| `ativo` | `BOOLEAN` | NÃO | `TRUE` | Empresa ativa no sistema. |
| `created_at` | `TIMESTAMPTZ` | NÃO | `NOW()` | Data de criação. |
| `updated_at` | `TIMESTAMPTZ` | NÃO | `NOW()` | Data de atualização. |

---

### 2.2. Tabela: `public.condominios` (Mestra Autoritativa de Postos / Clientes)
Tabela autoritativa para guarita, contratos terceirizados e cercas virtuais.

| Coluna | Tipo PostgreSQL | Nulo | Default | Descrição / Regra de Negócio |
|---|---|---|---|---|
| `id` | `TEXT` | NÃO | Auto-gerado (`cond-...`) | Chave primária alfanumérica ou UUID. |
| `empresa_id` | `TEXT` | NÃO | `'emp-matriz-principal'` | FK para `empresas.id`. |
| `nome` | `TEXT` | NÃO | - | Nome fantasia do condomínio ou empresa cliente. |
| `tipo` | `TEXT` | NÃO | `'Residencial'` | `'Residencial'`, `'Comercial'`, `'Industrial'`, `'Condomínio de Casas'`. |
| `cnpj` | `TEXT` | SIM | `NULL` | CNPJ do condomínio contratante. |
| `contrato_numero` | `TEXT` | SIM | `NULL` | Número do contrato de serviços. |
| `endereco` | `TEXT` | SIM | `NULL` | Logradouro e número do posto. |
| `bairro` | `TEXT` | SIM | `NULL` | Bairro do posto. |
| `cidade` | `TEXT` | SIM | `'São Paulo - SP'` | Cidade e UF do posto. |
| `cep` | `TEXT` | SIM | `NULL` | CEP do posto. |
| `supervisor` | `TEXT` | SIM | `'Supervisora Silva'` | Supervisor operacional da rota. |
| `telefone_supervisor` | `TEXT` | SIM | `NULL` | Contato do supervisor. |
| `vagas_contratadas` | `INTEGER` | NÃO | `2` | Efetivo previsto em contrato. |
| `vagas_ocupadas` | `INTEGER` | NÃO | `0` | Efetivo alocado atualmente. |
| `status` | `TEXT` | NÃO | `'operacional'` | `'operacional'`, `'atencao'`, `'critico'`. |
| `motivo_atencao` | `TEXT` | SIM | `NULL` | Justificativa se status != `'operacional'`. |
| `tipo_escala_padrao` | `TEXT` | SIM | `'12x36 (07:00 - 19:00)'` | Escala contratada. |
| `cobertura_percentual` | `NUMERIC(5,2)` | NÃO | `100.00` | Percentual de cobertura do efetivo. |
| `contato_sindico` | `TEXT` | SIM | `NULL` | Nome do síndico / zelador. |
| `telefone_sindico` | `TEXT` | SIM | `NULL` | Contato do síndico. |
| `instrucoes_guarita` | `TEXT` | SIM | `NULL` | Procedimentos operacionais padrão (POP). |
| `foto_url` | `TEXT` | SIM | `NULL` | Foto da portaria/fachada. |
| `latitude` | `DOUBLE PRECISION`| SIM | `NULL` | **Canônica:** Latitude calibrada (anulável se não calibrado). |
| `longitude` | `DOUBLE PRECISION`| SIM | `NULL` | **Canônica:** Longitude calibrada (anulável se não calibrado). |
| `raio_gps_metros` | `INTEGER` | NÃO | `150` | **Canônica:** Raio de tolerância em metros para o ponto. |
| `lat` | `DOUBLE PRECISION`| SIM | `NULL` | **Espelho Legado:** Sincronizado automaticamente via trigger. |
| `lng` | `DOUBLE PRECISION`| SIM | `NULL` | **Espelho Legado:** Sincronizado automaticamente via trigger. |
| `raio_tolerancia_metros` | `INTEGER` | NÃO | `150` | **Espelho Legado:** Sincronizado automaticamente via trigger. |
| `icone` | `TEXT` | SIM | `'Building2'` | Nome do ícone Lucide. |
| `cor` | `TEXT` | SIM | `'#3B82F6'` | Cor visual temática. |
| `metodo_calibracao_gps`| `TEXT` | SIM | `'manual'` | `'cep_endereco'`, `'no_local'`, `'manual'`. |
| `calibrado_em` | `TIMESTAMPTZ` | SIM | `NULL` | Data da calibração do GPS. |
| `calibrado_precisao_m` | `DOUBLE PRECISION`| SIM | `NULL` | Precisão em metros do GPS no momento da calibração. |
| `ativo` | `BOOLEAN` | NÃO | `TRUE` | Posto ativo. |
| `created_at` | `TIMESTAMPTZ` | NÃO | `NOW()` | Data de criação. |
| `updated_at` | `TIMESTAMPTZ` | NÃO | `NOW()` | Data de atualização. |

---

### 2.3. Tabela: `public.colaboradores` (Efetivo Operacional / Funcionários)
Tabela mestra de funcionários operacionais e administrativos.

| Coluna | Tipo PostgreSQL | Nulo | Default | Descrição / Regra de Negócio |
|---|---|---|---|---|
| `id` | `TEXT` | NÃO | Auto-gerado (`colab-...`) | Chave primária do colaborador. |
| `empresa_id` | `TEXT` | NÃO | `'emp-matriz-principal'` | FK para `empresas.id`. |
| `nome` | `TEXT` | NÃO | - | Nome completo do colaborador. |
| `full_name` | `TEXT` | SIM | `NULL` | Sinônimo de `nome` para compatibilidade com Auth. |
| `matricula` | `TEXT` | SIM | `NULL` | Matrícula funcional (ex: `'TC-1042'`). |
| `cpf` | `TEXT` | SIM | `NULL` | CPF (chave única natural higienizada). |
| `rg` | `TEXT` | SIM | `NULL` | Registro Geral com órgão expedidor. |
| `data_nascimento` | `DATE` | SIM | `NULL` | Data de nascimento. |
| `telefone` | `TEXT` | SIM | `NULL` | WhatsApp / Telefone. |
| `foto_url` | `TEXT` | SIM | `NULL` | Fotografia de identificação / biometria. |
| `pis` | `TEXT` | SIM | `NULL` | PIS/PASEP eSocial. |
| `ctps` | `TEXT` | SIM | `NULL` | CTPS física ou digital. |
| `nome_mae` | `TEXT` | SIM | `NULL` | Nome materno completo. |
| `endereco` | `TEXT` | SIM | `NULL` | Endereço residencial. |
| `funcao` | `TEXT` | NÃO | `'Porteiro'` | Cargo operacional. |
| `cargo` | `TEXT` | SIM | `'Porteiro'` | Sinônimo de `funcao`. |
| `condominio_id` | `TEXT` | SIM | `NULL` | FK para `condominios.id`. Se `NULL`, Matriz/Reserva Central. |
| `status` | `TEXT` | NÃO | `'no_posto'` | `'no_posto'`, `'folga'`, `'falta'`, `'afastado'`, `'disponivel'`. |
| `jornada` | `TEXT` | SIM | `'12x36 (07:00 - 19:00)'` | Jornada descritiva. |
| `tipo_jornada` | `TEXT` | SIM | `'12x36'` | `'12x36'`, `'6x1'`, `'5x2'`. |
| `turno_inicio` | `TIME` | SIM | `'07:00:00'` | Início do turno. |
| `turno_fim` | `TIME` | SIM | `'19:00:00'` | Término do turno. |
| `data_admissao` | `DATE` | SIM | `CURRENT_DATE` | Data de admissão. |
| `salario_base` | `NUMERIC(10,2)` | NÃO | `2150.00` | Salário base em R$. |
| `banco_horas` | `NUMERIC(6,2)` | NÃO | `0.00` | Saldo de horas. |
| `pix` | `TEXT` | SIM | `NULL` | Chave PIX. |
| `banco` | `TEXT` | SIM | `NULL` | Banco. |
| `agencia` | `TEXT` | SIM | `NULL` | Agência. |
| `conta` | `TEXT` | SIM | `NULL` | Conta corrente / poupança. |
| `recebe_vt` | `BOOLEAN` | NÃO | `TRUE` | Vale Transporte. |
| `recebe_vr` | `BOOLEAN` | NÃO | `TRUE` | Vale Refeição. |
| `valor_vr` | `NUMERIC(10,2)` | NÃO | `28.50` | Valor diário VR. |
| `recebe_va` | `BOOLEAN` | NÃO | `TRUE` | Vale Alimentação. |
| `valor_va` | `NUMERIC(10,2)` | NÃO | `220.00` | Valor mensal VA. |
| `valor_extra_ft` | `NUMERIC(10,2)` | NÃO | `160.00` | Valor diária FT (Folguista / Cobertura). |
| `valor_bonus` | `NUMERIC(10,2)` | NÃO | `0.00` | Bônus assiduidade mensal. |
| `email` | `TEXT` | SIM | `NULL` | E-mail de login corporativo. |
| `senha` | `TEXT` | SIM | `'Turno@2026'` | Senha de login inicial/sincronizada. |
| `role` | `TEXT` | NÃO | `'funcionario'` | `'admin'`, `'supervisor'`, `'funcionario'`. |
| `primeiro_acesso_concluido` | `BOOLEAN` | NÃO | `FALSE` | Senha inicial já foi redefinida. |
| `template_ativo_id` | `TEXT` | SIM | `NULL` | FK para o template facial ativo. |
| `created_at` | `TIMESTAMPTZ` | NÃO | `NOW()` | Data de criação. |
| `updated_at` | `TIMESTAMPTZ` | NÃO | `NOW()` | Data de atualização. |

---

### 2.4. Tabela: `public.ponto_eventos` (Registro Eletrônico Biométrico / Portaria 671 MTE)
Eventos imutáveis de registro de jornada com validação de cerca virtual e biometria.

| Coluna | Tipo PostgreSQL | Nulo | Default | Descrição / Regra de Negócio |
|---|---|---|---|---|
| `id` | `TEXT` | NÃO | Auto-gerado (`pe-...`) | Identificador do evento biométrico. |
| `empresa_id` | `TEXT` | NÃO | `'emp-matriz-principal'` | FK para `empresas.id`. |
| `colaborador_id` | `TEXT` | NÃO | - | FK para `colaboradores.id`. |
| `auth_user_id` | `UUID` | SIM | `NULL` | ID do usuário autenticado no Supabase Auth. |
| `condominio_id` | `TEXT` | SIM | `NULL` | FK para `condominios.id`. |
| `posto_id` | `TEXT` | SIM | `NULL` | Sinônimo de `condominio_id`. |
| `posto_nome` | `TEXT` | SIM | `NULL` | Nome do posto no momento da batida. |
| `condominio_nome` | `TEXT` | SIM | `NULL` | Nome do condomínio no momento da batida. |
| `tipo_evento` | `TEXT` | NÃO | `'entrada'` | `'entrada'`, `'saida_intervalo'`, `'retorno_intervalo'`, `'saida'`. |
| `server_timestamp` | `TIMESTAMPTZ` | NÃO | `NOW()` | Carimbo oficial de data/hora do servidor. |
| `latitude` | `DOUBLE PRECISION`| SIM | `NULL` | Latitude capturada no dispositivo móvel. |
| `longitude` | `DOUBLE PRECISION`| SIM | `NULL` | Longitude capturada no dispositivo móvel. |
| `accuracy_m` | `DOUBLE PRECISION`| SIM | `NULL` | Precisão do GPS em metros informada pelo browser. |
| `geofence_status` | `TEXT` | NÃO | `'dentro_do_raio'`| `'dentro_do_raio'`, `'fora_do_raio'`, `'gps_indisponivel'`, `'pendente'`. |
| `distance_m` | `DOUBLE PRECISION`| SIM | `NULL` | Distância calculada em metros até a guarita. |
| `credential_id` | `TEXT` | SIM | `NULL` | ID da credencial biométrica ou WebAuthn. |
| `foto_biometria_url` | `TEXT` | SIM | `NULL` | URL da foto facial comprovatória do ponto. |
| `plantoes_ft` | `INTEGER` | NÃO | `0` | Indicador se o ponto computa Folga Trabalhada. |
| `metodo_autenticacao` | `TEXT` | NÃO | `'biometria_facial'` | **Constraint:** `'biometria_facial'`, `'biometria_passkey'`, `'autenticador_dispositivo'`, `'excecao_autorizada'`. |
| `verification_status` | `TEXT` | NÃO | `'confirmado'` | `'confirmado'`, `'pendente'`, `'rejeitado'`. |
| `idempotency_key` | `TEXT` | NÃO | - | Chave de idempotência única anti-duplicação. |
| `comprovante_numero` | `TEXT` | NÃO | - | Número sequencial do comprovante (NSR). |
| `motivo_excecao` | `TEXT` | SIM | `NULL` | Justificativa em caso de exceção manual. |
| `created_at` | `TIMESTAMPTZ` | NÃO | `NOW()` | Timestamp de gravação. |

---

### 2.5. Tabela: `public.holerites` (Demonstrativo Digital de Pagamento Unificado)
Tabela unificada que consolida tanto campos analíticos quanto campos de fechamento.

| Coluna | Tipo PostgreSQL | Nulo | Default | Descrição / Regra de Negócio |
|---|---|---|---|---|
| `id` | `TEXT` | NÃO | Auto-gerado (`hol-...`) | Chave primária. |
| `empresa_id` | `TEXT` | NÃO | `'emp-matriz-principal'` | FK para `empresas.id`. |
| `colaborador_id` | `TEXT` | NÃO | - | FK para `colaboradores.id`. |
| `colaborador_nome` | `TEXT` | SIM | `NULL` | Nome do colaborador no holerite. |
| `matricula` | `TEXT` | SIM | `NULL` | Matrícula funcional. |
| `funcao` | `TEXT` | SIM | `'Porteiro'` | Cargo ocupado. |
| `posto_nome` | `TEXT` | SIM | `NULL` | Nome do posto de alocação. |
| `mes_referencia` | `TEXT` | NÃO | `'Outubro/2026'` | Competência mês/ano. |
| `ano_referencia` | `INTEGER` | NÃO | `2026` | Ano numérico da competência. |
| `salario_base` | `NUMERIC(10,2)` | NÃO | `2150.00` | Salário base da categoria em R$. |
| `adicional_periculosidade`| `NUMERIC(10,2)`| NÃO| `0.00` | Adicional de periculosidade (30%). |
| `adicional_noturno` | `NUMERIC(10,2)`| NÃO | `0.00` | Adicional noturno. |
| `horas_extras_50` | `NUMERIC(10,2)`| NÃO | `0.00` | Horas extras 50% apuradas. |
| `valor_horas_extras` | `NUMERIC(10,2)`| NÃO | `0.00` | Valor em R$ das horas extras. |
| `plantoes_ft` | `INTEGER` | NÃO | `0` | Quantidade de plantões em Folga Trabalhada. |
| `valor_ft` | `NUMERIC(10,2)`| NÃO | `0.00` | Valor total pago pelos plantões FT. |
| `desconto_inss` | `NUMERIC(10,2)`| NÃO | `0.00` | Desconto de INSS (oficial). |
| `inss` | `NUMERIC(10,2)`| NÃO | `0.00` | Sinônimo de `desconto_inss`. |
| `desconto_fgts` | `NUMERIC(10,2)`| NÃO | `0.00` | FGTS informativo. |
| `desconto_vt` | `NUMERIC(10,2)`| NÃO | `0.00` | Desconto Vale Transporte. |
| `vale_transporte` | `NUMERIC(10,2)`| NÃO | `0.00` | Sinônimo de `desconto_vt`. |
| `desconto_vr` | `NUMERIC(10,2)`| NÃO | `0.00` | Desconto Vale Refeição. |
| `vale_refeicao` | `NUMERIC(10,2)`| NÃO | `0.00` | Sinônimo de `desconto_vr`. |
| `irrf` | `NUMERIC(10,2)`| NÃO | `0.00` | Retenção de Imposto de Renda. |
| `bonus_assiduidade` | `NUMERIC(10,2)`| NÃO | `0.00` | Bônus de assiduidade. |
| `bonus_ativo` | `BOOLEAN` | NÃO | `TRUE` | Elegível ao bônus de assiduidade. |
| `motivo_perda_bonus` | `TEXT` | SIM | `NULL` | Justificativa em caso de perda do bônus. |
| `total_vencimentos` | `NUMERIC(10,2)`| NÃO | `0.00` | Soma total dos proventos brutos. |
| `total_descontos` | `NUMERIC(10,2)`| NÃO | `0.00` | Soma total dos descontos legais. |
| `salario_liquido` | `NUMERIC(10,2)`| NÃO | `0.00` | Salário líquido (total_vencimentos - total_descontos). |
| `liquido_receber` | `NUMERIC(10,2)`| NÃO | `2150.00` | Sinônimo canônico de `salario_liquido`. |
| `status_envio` | `TEXT` | NÃO | `'Pendente'` | `'Pendente'`, `'Aguardando Assinatura'`, `'Assinado'`. |
| `status` | `TEXT` | NÃO | `'disponivel'` | Status do documento. |
| `data_emissao` | `DATE` | NÃO | `CURRENT_DATE` | Data de emissão do holerite. |
| `data_assinatura` | `TIMESTAMPTZ` | SIM | `NULL` | Carimbo de data/hora da assinatura digital. |
| `assinatura_digital_hash`| `TEXT` | SIM | `NULL` | Hash SHA-256 do comprovante assinado. |
| `ip_assinatura` | `TEXT` | SIM | `NULL` | Endereço IP do colaborador no momento da assinatura. |
| `documento_url` | `TEXT` | SIM | `NULL` | URL do PDF gerado no Supabase Storage. |
| `created_at` | `TIMESTAMPTZ` | NÃO | `NOW()` | Data de criação. |
| `updated_at` | `TIMESTAMPTZ` | NÃO | `NOW()` | Data de atualização. |

---

### 2.6. Tabela: `public.alertas` e `public.ocorrencias`
Alertas automáticos de sistema e livros de ocorrência de portaria.

- `alertas`: `id` (PK, TEXT), `empresa_id` (FK, TEXT), `posto_id` (FK, `condominios.id`), `posto_nome`, `colaborador_id` (FK opcional), `colaborador_nome`, `tipo`, `gravidade`, `titulo`, `descricao`, `horario`, `resolvido`, `resolvido_por`, `resolvido_em`.
- `ocorrencias`: `id` (PK, TEXT), `empresa_id` (FK, TEXT), `posto_id` (FK, `condominios.id`), `posto_nome`, `tipo`, `descricao`, `registrado_por`, `data_hora`, `urgencia`, `resolvida`.
