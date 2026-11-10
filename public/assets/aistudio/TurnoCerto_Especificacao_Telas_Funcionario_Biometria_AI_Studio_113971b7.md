# TurnoCerto — Especificação completa da área do funcionário e ponto com biometria

**Documento de referência para Google AI Studio**  
**Projeto existente:** TurnoCerto (React + TypeScript + Tailwind + Vite + Supabase + PWA)  
**Objetivo:** modernizar e completar a experiência do funcionário sem reconstruir o aplicativo e sem alterar indevidamente o painel administrativo.

---

## 0. Diretriz principal

Trabalhar sobre o repositório TurnoCerto existente. Não criar outro aplicativo, não substituir a arquitetura por um projeto novo e não eliminar módulos administrativos que já funcionam.

O aplicativo deve ter dois ambientes rigorosamente separados:

1. **Gestão:** administrador e supervisor veem somente os módulos autorizados de Operação, Equipe, Postos, Matriz e Holerite RH.
2. **Funcionário:** o colaborador autenticado vê somente sua própria área: Meu Turno, Minha Escala, Meus Registros, Documentos, Meu Perfil e os fluxos pessoais de ponto, ocorrência e suporte.

Nunca mostrar ao funcionário a navegação administrativa. Nunca permitir que ele selecione, pesquise, altere ou consulte outro colaborador.

A área do funcionário deve ter o visual premium dos mockups de referência: azul-marinho profundo, grafite/azul-escuro, azul elétrico para ação principal, verde para confirmação, âmbar para atenção e vermelho para falha/alerta; cards compactos, ícones lineares, tipografia legível, cantos arredondados e excelente experiência mobile.

## 1. Auditoria do ZIP: fatos a respeitar

Ao analisar o ZIP recebido, foram encontrados os seguintes elementos:

- `src/App.tsx` renderiza as cinco abas administrativas depois do login, sem separar o conteúdo por `currentUser.role`.
- `src/components/collaborator/CollaboratorView.tsx` existe, mas não é importado nem renderizado pelo `App.tsx`.
- `CollaboratorView.tsx` usa `colaboradores.find(c => c.id === currentUser?.id) || colaboradores[0]`. Remover imediatamente o fallback `colaboradores[0]`; se o vínculo não for encontrado, bloquear a tela e mostrar erro controlado.
- O componente atual simula o ponto: define `pontoRegistrado` como `true`, usa horário inicial fixo e `handleBaterPonto` apenas atualiza estado local e mostra mensagem de sucesso. Não realiza autenticação biométrica real, não consulta GPS real e não grava o evento no banco.
- O botão atual chama “Registrar Ponto Eletrônico (GPS)”; deve ser substituído por um fluxo real de autenticação do dispositivo + localização + gravação no servidor.
- `AppContext.tsx` inicializa a sessão com `DEFAULT_USER` se não houver usuário salvo; não deixar o usuário entrar como supervisor por padrão. Sem sessão válida, mostrar login.
- A função `login` apresentada no contexto procura colaboradores nos arrays locais, aceita fallback de senha e grava dados do usuário em `localStorage`; isso não equivale a Supabase Auth. Não persistir senha no cliente nem usar credenciais demonstrativas em produção.
- `Colaborador` usa propriedades como `foto`, `funcao`, `condominioId`, `turnoInicio` e `turnoFim`; `CollaboratorView.tsx` também referencia `fotoUrl` e `cargo`. Corrigir a divergência com os tipos reais, sem inventar propriedades.
- `HoleriteRegistro` usa `liquidoReceber` e `statusEnvio`; o componente do colaborador consulta `valorLiquido` e `publicado`. Unificar a tipagem e usar os campos reais.
- `PontoRegistro` atualmente contém `entrada1`, `saida1`, `entrada2`, `saida2`, `totalHoras`, `statusPonto` e `localizacaoGPS`. Isso não é suficiente, isoladamente, para provar cada batida biométrica com horário de servidor, tipo de evento, desafio WebAuthn e evidência geográfica estruturada.
- `CondominioPosto` precisa ser compatibilizado com os campos de coordenadas e raio GPS usados em `initialData.ts` (`latitude`, `longitude`, `raioGpsMetros`).
- As migrations `20261108_tabela_colaboradores.sql` e `20261108_cadastro_funcionarios_rls.sql` têm políticas de acesso amplas/permissivas. Revisar o estado real do banco antes de aplicar qualquer migration nova. Não manter políticas `USING (true)` ou `WITH CHECK (true)` para tabelas de funcionário, perfil, ponto, holerite ou documentos.

**Regra de segurança:** não fazer deploy nem liberar acesso de funcionário até que autenticação real, isolamento por usuário e RLS tenham sido validados no banco.

---

## 2. Navegação do funcionário

Usar uma barra inferior fixa com cinco itens, sempre no mesmo lugar:

1. **Meu Turno** — início e registro de ponto.
2. **Minha Escala** — calendário e próximos turnos.
3. **Meus Registros** — espelho e histórico de ponto.
4. **Documentos** — abas Meus Holerites e Meus Documentos.
5. **Meu Perfil** — dados pessoais, informações profissionais e configurações pessoais.

Ações secundárias acessadas a partir dessas telas:
- Registrar ocorrência.
- Fale com RH / suporte.
- Ativar ou gerenciar biometria do dispositivo.
- Notificações.
- Privacidade e segurança.
- Sair do aplicativo.

Não exibir Operação, Equipe, Postos, Matriz ou Holerite RH ao funcionário.

## 3. Tela 1 — Meu Turno (início)

**Objetivo:** em poucos segundos, o funcionário entende onde trabalha hoje, qual é seu turno e qual ação precisa executar.

### Cabeçalho
- Marca TurnoCerto.
- Saudação pelo primeiro nome do usuário autenticado.
- Sino de notificações pessoais com contador somente se houver notificações próprias.
- Foto e nome do próprio colaborador.

### Cartão “Meu posto atual”
- Nome do condomínio designado para o turno vigente.
- Nome/local do posto (ex.: Portaria Principal).
- Função.
- Jornada/escala (12x36, 6x1, 5x2 ou outra modalidade configurada).
- Horário previsto de entrada e saída.
- Supervisor responsável, somente se a regra de negócio permitir exibir o contato.
- Situação atual: Em serviço, Aguardando entrada, Folga, Afastado ou Turno encerrado.

### Ação principal de ponto
Botão grande e evidente:

**BATER PONTO COM BIOMETRIA**

Texto auxiliar: “Confirme sua identidade no próprio aparelho para registrar o ponto”.

Antes do clique, exibir a próxima batida esperada, calculada no servidor a partir da escala e dos registros existentes: Entrada, Saída para intervalo, Retorno do intervalo ou Saída final — somente os eventos exigidos pela jornada configurada. Não assumir que todas as jornadas têm quatro batidas.

### Indicadores pessoais
- Presença no período selecionado.
- Faltas registradas.
- Horas trabalhadas.
- Horas extras aprovadas/registradas.

Mostrar somente valores apurados dos registros do próprio colaborador. Se ainda não houver dados, mostrar “Sem dados neste período”, nunca números fictícios.

### Cartão “Meu turno de hoje”
- Data e dia da semana.
- Entrada e saída previstas.
- Situação do turno.
- Barra de progresso apenas se calculada a partir do horário real e do estado do ponto.

### Cartão “Último registro”
- Tipo de evento.
- Horário confirmado pelo servidor.
- Situação da localização (validada, fora do raio, indisponível ou pendente).
- Link “Ver comprovante”.

### Atalhos
- Minha Escala.
- Meus Registros.
- Meus Holerites.
- Meus Documentos.
- Comunicar Ocorrência.

---

## 4. Tela 2 — Ativar biometria no dispositivo (primeiro uso)

**Objetivo:** vincular uma credencial criptográfica à conta autenticada do funcionário, com instruções simples.

### Conteúdo
- Título “Ativar autenticação neste aparelho”.
- Explicação: “O TurnoCerto usa a autenticação segura do seu celular. Sua impressão digital ou imagem facial permanece no aparelho e não é enviada ao TurnoCerto”.
- Botão “Ativar biometria do aparelho”.
- Estado de carregamento e resultado.
- Identificação resumida do dispositivo (sem coletar dados excessivos).
- Opção de cancelar e consultar o RH/suporte.

### Requisitos técnicos
- Usar WebAuthn/passkeys com autenticador de plataforma e `userVerification: "required"`, quando suportado.
- O cadastro da credencial só pode ocorrer depois de autenticação real da conta.
- Criar o desafio no servidor, com validade curta, uso único e vínculo à sessão/usuário.
- Enviar a resposta WebAuthn ao servidor e verificar desafio, origem, RP ID, assinatura, flags e contador quando aplicável.
- Guardar somente identificador da credencial, chave pública, metadados técnicos necessários, data de cadastro e revogação. Nunca armazenar imagem facial, template de face, impressão digital ou senha biométrica.
- Permitir revogar um aparelho perdido e cadastrar um novo aparelho após autenticação reforçada.
- Não dizer que a operação foi “biométrica” se o autenticador só confirmou verificação local genérica. A WebAuthn pode usar biometria ou mecanismo de desbloqueio do dispositivo; a aplicação não recebe o dado biométrico nem deve presumir qual método foi usado.
- Se WebAuthn não estiver disponível, informar claramente e encaminhar ao procedimento alternativo autorizado; não fabricar uma confirmação.

---

## 5. Tela 3 — Registrar ponto (fluxo biométrico)

**Objetivo:** realizar uma batida real, auditável e vinculada ao funcionário autenticado.

### Antes da autenticação
Mostrar:
- Tipo de batida esperado.
- Data e hora local atual apenas como referência visual.
- Condomínio e posto previstos para o turno.
- Status de localização: aguardando permissão, validando, dentro do raio, fora do raio, sinal impreciso ou localização indisponível.
- Raio GPS configurado para o condomínio, sem inventar distância.

### Ação
Botão “Confirmar com biometria”. Ao tocar:
1. Consultar no servidor qual é o próximo evento permitido.
2. Solicitar localização usando `navigator.geolocation` em contexto seguro HTTPS e com alta precisão.
3. Avaliar permissão, precisão, latitude/longitude e geofence do posto/condomínio.
4. Solicitar desafio WebAuthn de uso único ao servidor.
5. Abrir autenticador local do dispositivo via WebAuthn/passkey.
6. Enviar assertion, localização, precisão e idempotency key para a Edge Function/API protegida.
7. Validar tudo novamente no servidor.
8. Gravar o evento com timestamp do servidor, nunca confiar no relógio do celular.
9. Devolver recibo e atualizar o histórico.

### Estados obrigatórios
- Pronto para registrar.
- Solicitando localização.
- Localização validada.
- Fora do raio permitido.
- Solicitando autenticação do aparelho.
- Autenticação confirmada.
- Autenticação cancelada ou falhou.
- Registro enviado.
- Registro confirmado pelo servidor.
- Sem conexão / envio pendente.
- Erro recuperável.

Não mostrar “Ponto registrado com sucesso” antes da confirmação da gravação no servidor. Offline pode manter rascunho local marcado como **PENDENTE — NÃO CONFIRMADO**, mas nunca como ponto válido. Evitar batida duplicada com idempotency key e validação do estado no servidor.

### Tela de resultado / comprovante
Depois do sucesso, mostrar:
- “Ponto registrado”.
- Tipo da batida.
- Data e hora oficiais do servidor.
- Condomínio/posto vinculados.
- Resultado da geolocalização e precisão.
- Método de autenticação: “Autenticação do aparelho confirmada” (usar “biometria” apenas quando houver certeza técnica de que esse foi o método).
- Número/ID do comprovante.
- Botão “Voltar ao Meu Turno” e “Ver Meus Registros”.

### Falhas e exceções
- Fora do raio: não registrar como geolocalização válida; orientar o funcionário e disponibilizar solicitação de análise, se permitido.
- GPS negado: explicar como permitir localização; não inventar endereço ou distância.
- Biometria cancelada: permitir nova tentativa limitada, sem gravar batida.
- Aparelho não compatível: fluxo alternativo autorizado pelo RH/supervisor com motivo, identificação do aprovador e trilha de auditoria.
- Falha de rede: apresentar pendência explícita e sincronização segura, sem timestamp local tratado como horário oficial.

---

## 6. Tela 4 — Minha Escala

**Objetivo:** consultar a escala individual sem permitir alterações administrativas.

### Conteúdo
- Calendário mensal com legenda: Trabalho, Folga, Feriado, Afastamento e Turno especial.
- Navegação entre meses.
- Destaque do dia atual.
- Lista cronológica dos próximos turnos.
- Cada turno exibe data, horário, condomínio, posto, função e situação.
- Detalhe do turno selecionado: endereço, instruções operacionais autorizadas, hora prevista de início/fim e contato do supervisor se autorizado.
- Aviso de alterações recentes na escala.

### Restrições
- Não permitir editar escala, escolher condomínio, trocar posto ou alocar substituto.
- Para solicitar troca, disponibilizar ação “Solicitar ajuste de escala”, que gera pedido para a supervisão e fica pendente até aprovação.
- Exibir apenas a escala do próprio `colaboradorId`.

---

## 7. Tela 5 — Meus Registros (espelho de ponto)

**Objetivo:** permitir que o trabalhador acompanhe e confira suas batidas.

### Filtros
- Hoje, semana, mês e período personalizado.
- Tipo: entradas, saídas, intervalo, extras e ocorrências.
- Situação: regular, atraso, incompleto, pendente de validação ou divergente.

### Lista diária
Cada data mostra as batidas na ordem cronológica, tipo do evento, horário oficial, posto/condomínio, estado da validação GPS, método de autenticação e total apurado quando disponível.

### Resumo
- Horas previstas.
- Horas registradas.
- Horas extras aguardando aprovação.
- Faltas/atrasos reconhecidos.
- Dias sem registro.

### Ações
- Ver comprovante da batida.
- Solicitar correção de ponto, com motivo e evidência opcional.
- Baixar/compartilhar espelho individual em PDF, se a função existir e estiver autorizada.

O funcionário não pode editar ou apagar diretamente uma batida confirmada. Correções devem gerar solicitação auditável para RH/supervisão.

---

## 8. Tela 6 — Minha Jornada

**Objetivo:** apresentar resumo de frequência e carga horária do próprio funcionário.

- Alternância Semana / Mês / Ano.
- Gráfico simples de horas registradas por dia ou semana.
- Presença e faltas com período claramente identificado.
- Horas normais, extras aprovadas, extras pendentes e saldo de banco de horas, caso exista cálculo oficial.
- Avisos de ponto incompleto ou divergente.
- Link para abrir os detalhes em Meus Registros.

Não somar horas extras pendentes como aprovadas. Não exibir salário ou valores de outros funcionários.

---

## 9. Tela 7 — Documentos (abas Meus Holerites e Meus Documentos)

### Aba Meus Holerites
- Lista por competência, da mais recente para a mais antiga.
- Situação: disponível, aguardando assinatura, assinado ou pendente.
- Valor líquido e detalhamento visíveis somente ao titular autenticado e perfis RH autorizados.
- Abrir demonstrativo, baixar PDF e consultar histórico de publicação/assinatura.
- Exibir apenas documentos efetivamente publicados e vinculados ao ID do funcionário.
- Se não houver holerite, mostrar estado vazio e orientar a procurar RH.

### Aba Meus Documentos
- Documentos pessoais autorizados: contrato, comprovantes, recibos e documentos disponibilizados pelo RH.
- Status: válido, pendente, solicitado, recusado ou expirado, conforme o modelo real.
- Data de publicação e validade quando aplicável.
- Visualizar/baixar documento por URL assinada e temporária, com controle de acesso.
- Solicitar atualização ou envio de documento.

Nunca listar arquivos de outro funcionário. Não expor PIX, banco, conta, CPF ou documentos sensíveis em listas ou notificações.

---

## 10. Tela 8 — Meu Perfil

### Cabeçalho
- Foto, nome e matrícula.
- Função e status profissional.
- Botão para sair.

### Seções
- Dados pessoais básicos: telefone e e-mail, com edição apenas dos campos autorizados.
- Dados profissionais: cargo, data de admissão, jornada, condomínio e posto atuais; somente leitura.
- Contato do supervisor/RH, se permitido.
- Segurança: alterar senha, aparelhos autenticados, ativar/revogar passkey, encerrar sessões quando disponível.
- Privacidade: explicação sobre localização, autenticação do dispositivo e uso de dados.

Dados como salário, banco, PIX, CPF completo, documentos e informações de saúde não devem aparecer em destaque no perfil. Exibir somente quando houver necessidade funcional, autorização e proteção adequadas.

Alterações de cargo, salário, posto, condomínio, jornada, banco ou dados contratuais devem ser solicitadas ao RH, não editadas pelo funcionário.

---

## 11. Tela 9 — Comunicar Ocorrência

**Objetivo:** permitir que o funcionário informe uma situação relacionada ao seu turno/posto.

### Formulário
- Categoria: problema no posto, atraso/troca, equipamento, segurança, manutenção, divergência de ponto ou outro.
- Data/hora sugeridas a partir do turno atual, com confirmação.
- Condomínio/posto pré-preenchidos do vínculo vigente e não editáveis pelo funcionário.
- Descrição obrigatória e objetiva.
- Foto/anexo opcional, sujeito a limite e validação de tipo/tamanho.
- Botão “Enviar ocorrência”.

### Depois do envio
- Número do protocolo.
- Data/hora de envio.
- Status: recebida, em análise, aguardando informação ou concluída.
- Histórico das próprias ocorrências.

Não permitir ao funcionário alterar status, resolver ou apagar ocorrência depois do envio.

---

## 12. Tela 10 — Fale com RH / Suporte

- Canais de contato configurados pela empresa.
- Abrir solicitação com assunto, mensagem e categoria.
- Histórico das próprias solicitações.
- Número de protocolo e status.
- Horário/canais de atendimento, somente se configurados no cadastro da empresa.

Não inventar telefone, e-mail, WhatsApp ou horário de atendimento. Usar os dados reais cadastrados.

---

## 13. Tela 11 — Notificações

Mostrar somente notificações destinadas ao próprio funcionário:
- Alteração de escala.
- Novo holerite publicado.
- Documento solicitado ou atualizado.
- Resposta de ocorrência.
- Aviso de RH/supervisão.
- Lembrete de turno.

Cada notificação deve ter data, texto, link para a área correspondente e estado lida/não lida. Não colocar dados financeiros ou pessoais sensíveis no texto da notificação push.

---

## 14. Tela 12 — Configurações e privacidade

- Preferências de notificação.
- Gerenciar autenticação biométrica/passkeys.
- Dispositivos vinculados e opção de revogação.
- Alterar senha via fluxo seguro.
- Política de privacidade e explicação de dados usados para ponto.
- Ajuda e suporte.
- Sair do aplicativo.

Não armazenar senha em `localStorage`. Não permitir alterar o próprio `role` ou `colaboradorId`.

---

## 15. Arquitetura do ponto biométrico — requisitos não negociáveis

**Importante:** “biometria” no navegador deve ser implementada com WebAuthn/passkeys e autenticador local compatível. O sistema operacional valida a pessoa no aparelho; o TurnoCerto recebe uma resposta criptográfica, não a impressão digital ou a imagem facial.

### Registro da credencial
1. Conta autenticada e vinculada a um `colaboradorId` válido.
2. Backend gera challenge aleatório e de uso único.
3. Browser chama `navigator.credentials.create()` (ou biblioteca WebAuthn revisada) com verificação de usuário obrigatória e autenticador de plataforma preferencial.
4. Resposta é enviada à Edge Function/API.
5. Backend valida challenge, origem, RP ID e resposta e armazena chave pública/ID da credencial.

### Autenticação para cada ponto
1. Backend verifica a sessão e determina o próximo tipo de batida.
2. Backend gera challenge específico para `ponto_evento`, colaborador, posto e janela de tempo.
3. Browser chama `navigator.credentials.get()` com `userVerification: "required"`.
4. Backend valida assinatura, challenge, origem, RP ID, contador/flags pertinentes, validade da sessão e que o challenge não foi reutilizado.
5. Backend calcula e valida geofence usando coordenadas/raio oficiais e precisão recebida.
6. Backend verifica sequência do ponto, intervalo mínimo entre batidas, duplicidade e vínculo do funcionário ao turno/posto.
7. Backend grava timestamp oficial e retorna comprovante.

### Infraestrutura
- Exigir HTTPS e origem/RP ID de produção configurados.
- Guardar segredos somente no servidor/Edge Functions.
- Não colocar service-role key no frontend.
- Avaliar biblioteca compatível como `@simplewebauthn/browser` no frontend e `@simplewebauthn/server` no backend/Edge Function, verificando compatibilidade com o runtime antes de adicionar dependências.
- Não simular sucesso se a API, GPS ou rede falhar.
- `userVerification: "required"` solicita verificação local do autenticador, mas a aplicação não deve afirmar que necessariamente foi usada impressão digital/face: o dispositivo pode usar outro mecanismo local (por exemplo, PIN) e a WebAuthn não entrega a biometria ao site.
- Para exigência de biometria física específica certificada (ex.: leitor de ponto homologado ou prova do tipo exato de fator), avaliar hardware/fornecedor especializado; uma PWA comum não tem acesso direto aos templates biométricos do sensor.

### Geolocalização
- Solicitar localização somente no momento do ponto e explicar a finalidade.
- Usar `navigator.geolocation.getCurrentPosition` com `enableHighAccuracy: true`, timeout e `maximumAge` controlados.
- Registrar latitude, longitude, precisão em metros e horário de coleta; restringir acesso e retenção.
- Validar raio em metros a partir de coordenadas oficiais do posto/condomínio, no backend; não usar distância inventada na interface.
- Se precisão for pior que o limite configurado, solicitar nova leitura ou encaminhar exceção.
- GPS é sinal de localização e pode ser manipulado; manter análise antifraude, trilha de auditoria e revisão humana para divergências. Não tratar GPS isoladamente como prova absoluta.

### Modelo de dados sugerido
Antes de criar tabelas, inspecionar o schema existente e reutilizar nomes compatíveis. Se não houver equivalente, propor migração versionada para estruturas separadas:

**`employee_passkeys`**
- `id`
- `auth_user_id` (FK para `auth.users.id`)
- `colaborador_id` (FK/identificador estável do cadastro)
- `credential_id` (único)
- `public_key` (material público; nunca chave privada)
- `sign_count`
- `transports` / metadados de autenticador necessários
- `created_at`, `last_used_at`, `revoked_at`, `device_label`

**`webauthn_challenges`** (ou store efêmero server-side)
- desafio aleatório, user_id, purpose (`register`/`punch`), expiration, used_at.
- Nunca reutilizar challenge e nunca confiar em challenge enviado pelo próprio cliente sem conferência server-side.

**`ponto_eventos`**
- `id`
- `colaborador_id`
- `auth_user_id`
- `turno_id`/`posto_id` se existentes
- `tipo_evento` (`entrada`, `saida_intervalo`, `retorno_intervalo`, `saida` ou enum configurado)
- `server_timestamp`
- `latitude`, `longitude`, `accuracy_m`
- `geofence_status`, `distance_m` calculada no backend quando possível
- `credential_id` (referência técnica, sem segredo biométrico)
- `verification_status`
- `idempotency_key` única
- metadados mínimos de auditoria

Ajustar nomes e relacionamentos ao schema real. Não criar duplicata de tabelas se já houver estrutura equivalente.

---

## 16. Autenticação, sessão e autorização por perfil

- Usar Supabase Auth real (`auth.users`) para a sessão. A função `login` atualmente baseada em listas locais não é autenticação de produção.
- Resolver o usuário atual a partir da sessão validada (`auth.uid()`), consultar seu profile e resolver um único vínculo para `colaboradorId`.
- `role` deve vir de fonte controlada pelo backend/app metadata, nunca de campo livre que o funcionário possa alterar.
- Sem sessão: somente Login.
- `role = admin` ou `supervisor`: painel de gestão existente, com autorização adicional por módulo/escopo.
- `role = funcionario`: componente do funcionário, sem montar componentes administrativos.
- Sem `colaboradorId`, vínculo duplicado ou cadastro inativo: bloquear área individual e orientar contato com RH.
- Não usar `currentUser.id` como substituto automático do `colaboradorId`; mapear explicitamente `auth_user_id` -> `colaborador_id`.
- Não guardar senha, token sensível ou informação biométrica no `localStorage`.
- Usar sessão segura do Supabase e política de expiração/revogação apropriada.

---

## 17. Supabase RLS — isolamento obrigatório

Revisar e corrigir as migrations existentes antes de criar novas regras. Remover políticas amplas `USING (true)` / `WITH CHECK (true)` que exponham dados pessoais ou permitam escritas irrestritas.

Aplicar RLS a todas as tabelas com dados do funcionário, ponto, holerite, documentos, ocorrências, passkeys e notificações.

Princípios de política:
- Funcionário: SELECT somente da linha que pertence ao `auth.uid()` ou ao `colaborador_id` inequivocamente vinculado à sessão.
- Funcionário: INSERT apenas para eventos próprios permitidos, com `auth_user_id = auth.uid()` e `colaborador_id` obtido/validado no servidor; para ponto biométrico, preferir Edge Function transacional.
- Funcionário: não pode alterar/apagar ponto confirmado; solicita correção por tabela de solicitações.
- Funcionário: SELECT de holerites/documentos somente próprios e publicados/autorizados.
- Funcionário: UPDATE apenas campos pessoais básicos permitidos, com restrição de colunas; não pode alterar `role`, salário, posto, jornada, condomínio ou matrícula.
- Supervisor/admin: permissões limitadas ao escopo autorizado e definidas por claims/relacionamentos confiáveis.
- `anon`: sem acesso a tabelas privadas.
- Service role: somente no backend, nunca no cliente.

Criar testes `supabase/tests/*_rls_test.sql` para provar cenários permitidos e negados: usuário A não enxerga dados de B; não altera cargo/salário/role/posto; não vê holerite de B; não insere batida para B; anônimo não lê nem grava dados; supervisor vê somente o escopo permitido.

---

## 18. Componentes e arquivos do projeto a revisar

- `src/App.tsx`: separar o roteamento/renderização por role e montar `CollaboratorView` no papel correto.
- `src/components/collaborator/CollaboratorView.tsx`: dividir em telas/componentes menores; remover fallback para o primeiro colaborador; substituir simulação de ponto por serviço real.
- `src/context/AppContext.tsx`: remover usuário padrão automático; corrigir login/sessão e vínculo de `colaboradorId`; não persistir senha.
- `src/types/index.ts`: unificar tipos de colaborador, ponto, holerite, turno, documentos e sessão com o schema real.
- `src/components/LoginScreen.tsx`: manter login comum, mas retirar atalhos de contas demonstrativas em produção.
- `src/components/BottomBar.tsx`: criar barra própria da área do funcionário, sem reaproveitar as cinco abas administrativas.
- `src/lib/supabase.ts`: manter configuração pública apropriada no cliente; nenhuma service-role key no frontend.
- `supabase/migrations/`: migrations novas, incrementais, revisadas e sem policies permissivas.
- Criar `src/components/collaborator/*` para as páginas: MeuTurno, RegistroPonto, MinhaEscala, MeusRegistros, MinhaJornada, Documentos, MeuPerfil, ComunicarOcorrencia, Suporte, Notificacoes e Configuracoes.
- Criar camada `src/services/` para ponto biométrico, escala, documentos e ocorrências; não concentrar regras de negócio na UI.

---

## 19. Regras de design e comportamento

- Mobile-first, responsivo, alvo de toque mínimo confortável, barra inferior fixa com safe-area para iOS.
- Manter cabeçalho compacto e conteúdo com rolagem vertical.
- Cards com espaçamento consistente; não comprimir textos nem deixar botões pequenos.
- Cores têm significado fixo: verde = confirmado/regular; âmbar = atenção/pendente; vermelho = erro/bloqueio; azul = ação/navegação.
- Exibir skeleton/loading, estado vazio, erro e sucesso em todas as telas.
- Mensagens em português brasileiro, linguagem simples.
- Acessibilidade: contraste, foco, labels, leitores de tela, não depender somente de cor.
- Nunca exibir números de exemplo como se fossem valores reais; dados fake só em desenvolvimento e identificados como demonstração.
- Não usar foto genérica como identidade real: carregar a foto do colaborador vinculado; sem foto, avatar com iniciais.

---

## 20. Critérios de aceite / testes manuais

### Perfis
1. Login como funcionário abre diretamente Meu Turno.
2. Funcionário não vê navegação de gestão nem consegue abrir URLs/rotas administrativas manualmente.
3. Admin e supervisor continuam no painel de gestão e mantêm permissões autorizadas.
4. Logout encerra sessão real; atualizar navegador não restaura usuário de demonstração.
5. Funcionário sem vínculo válido vê estado de acesso bloqueado, sem cair no primeiro colaborador.

### Ponto
6. Primeiro uso exige cadastro da passkey/autenticador.
7. Botão inicia desafio real de autenticação e validação de localização.
8. Sem biometria/autenticador compatível: nunca informar sucesso; usar fluxo de exceção aprovado.
9. GPS negado, impreciso, fora do raio ou sem permissão gera mensagem correta.
10. Cancelar biometria não grava ponto.
11. Resposta WebAuthn inválida, challenge expirado ou repetido é rejeitado.
12. Ponto só aparece como confirmado depois da gravação transacional do servidor.
13. Duplo clique/reenvio não cria duplicidade.
14. Data/hora oficial vem do servidor e é exibida no fuso local configurado.
15. Funcionário A não consegue registrar ponto como funcionário B.

### Dados e privacidade
16. Acesso de A não retorna dados, holerites, documentos, ocorrências ou registros de B.
17. Funcionário não altera sua role, salário, jornada, posto ou condomínio.
18. Documento privado usa autorização/URL assinada e expirada.
19. RLS passa testes de acesso permitido e negado.
20. Build TypeScript e testes passam sem erros; PWA continua instalável.

---

## 21. Ordem de implementação

**Fase 1 — Segurança e sessão**: Supabase Auth real, vínculo user/colaborador, separação por role, retirar fallback, corrigir RLS.  
**Fase 2 — Área individual**: Meu Turno e barra inferior exclusiva, com dados reais e estados vazios.  
**Fase 3 — Ponto**: modelo de eventos, passkey/WebAuthn, geofence, Edge Functions, recibo e auditoria.  
**Fase 4 — Consultas**: Minha Escala, Meus Registros e Minha Jornada.  
**Fase 5 — RH individual**: Holerites, Documentos e Meu Perfil.  
**Fase 6 — Comunicação**: Ocorrência, Suporte, Notificações e Configurações.  
**Fase 7 — Testes**: segurança, dispositivo real Android/iOS, conexão fraca, GPS negado, build PWA e regressão administrativa.

Não marcar fase como concluída apenas porque a tela está desenhada; testar integração real e autorização.

---

## 22. Prompt final para o Google AI Studio

Analise primeiro todo o código-fonte e o schema real do Supabase. Compare o código com esta especificação e com os mockups anexados. Antes de editar, apresente um diagnóstico curto dos arquivos e tabelas a alterar. Depois implemente as fases em mudanças pequenas e verificáveis, sem apagar o painel administrativo.

Comece obrigatoriamente por autenticação real, separação por role, vínculo seguro do colaborador e correção das policies RLS. Em seguida, desenvolva a área individual com todas as telas descritas. Implemente o ponto com WebAuthn/passkeys e GPS apenas com validação server-side; não use estados simulados, horários fixos, distâncias inventadas, `alert()` de sucesso falso ou arrays locais como fonte de dados de produção.

Se a configuração do Supabase, schema ou Edge Functions não estiver disponível, não invente uma integração funcionando: implemente a UI com estado “configuração pendente”, explique o que falta e entregue a migration/Edge Function proposta para revisão. Não execute políticas permissivas. Não coloque segredo no frontend. Preserve e teste o acesso administrativo.

Ao concluir, mostre a lista de arquivos modificados, migrations criadas, funções de backend adicionadas, dependências novas, testes executados e limitações que ainda impedem o uso em produção.

**Critério principal:** um funcionário autenticado só pode ver e registrar informações próprias; o ponto só é confirmado quando WebAuthn, regra de jornada, localização e gravação do servidor forem efetivamente validados.
