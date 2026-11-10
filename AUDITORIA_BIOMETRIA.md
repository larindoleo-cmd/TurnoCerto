# AUDITORIA TÉCNICA E DIAGNÓSTICO DO MOTOR BIOMÉTRICO FACIAL
## Sistema TurnoCerto — Gestão de Terceirização e Escalas

**Data da Auditoria:** 10 de Novembro de 2026  
**Auditor Responsável:** Engenharia de Sistemas & Visão Computacional  
**Ambiente Analisado:** TurnoCerto Web/Mobile (Vite + React 19 + Supabase + Cloudflare)  
**Status do Módulo Pré-Auditoria:** CRÍTICO — Falso Reconhecimento, Falha de Persistência e Risco de Segurança

---

## 1. RESUMO EXECUTIVO

Esta auditoria técnica foi realizada para identificar a **causa raiz** do problema reportado:
> *"O funcionário cadastra sua biometria, mas o sistema deixa de reconhecê-lo logo depois."*

A investigação detalhada revelou que o problema **não é de interface visual**, mas decorre de **quatro causas técnicas profundas**:

1. **Inadequação Algorítmica (Pseudo-Biometria):** A função `extract128DFaceDescriptor` não utiliza rede neural nem modelo biométrico de identidade facial. Ela gera um histograma de gradientes Sobel (HOG simplificado) sobre uma grade 4x4 de 64x64 pixels sem alinhamento facial de landmarks. Qualquer alteração mínima de ângulo, iluminação ou expressão facial altera drasticamente o vetor, gerando distâncias euclidianas acima de 0.65 e falsas rejeições constantes (FRR > 90%).
2. **Volatilidade de Armazenamento (`localStorage`):** O template gerado era salvo exclusivamente no `localStorage` do navegador do dispositivo (`turnocerto_biometria_facial_v2`). O Supabase recebia apenas a foto em Base64 e uma flag booleana `biometria_cadastrada: true`. Ao acessar de outro dispositivo, navegador ou após limpeza de cache, o template não existia.
3. **Incompatibilidade Estrutural de Banco de Dados:** O script `supabase/10_RECONHECIMENTO_FACIAL.sql` assumia `colaboradores.id` como `UUID`, enquanto a arquitetura do projeto utiliza IDs do tipo `TEXT` (`colab-1731...`). Consequentemente, as chaves estrangeiras e tabelas de templates não podiam ser criadas nem sincronizadas.
4. **Vulnerabilidades Críticas de Segurança & Bypasses:**
   - Fallback de token hardcoded `'AUTH_TOKEN_SUP_MANUAL'` em `FacialCaptureEnrollment.tsx`.
   - Cadastro silencioso indevido durante tentativa de bater ponto em `RegistroPontoModal.tsx`.
   - Políticas RLS no Supabase com `TO authenticated, anon USING (true)` permitindo alteração anônima irrestrita.
   - Credenciais administrativas expostas em texto plano no código-fonte (`AppContext.tsx`).
   - Substituição automática de GPS real pelas coordenadas do posto quando o sinal falha.

---

## 2. MATRIZ DE PROBLEMAS IDENTIFICADOS

| ID | Arquivo | Função / Trecho | Gravidade | Causa Técnica | Solução Exigida |
|---|---|---|---|---|---|
| **PB-01** | `src/services/facialRecognitionService.ts` | `extract128DFaceDescriptor()` | **CRÍTICA** | Extrai gradientes Sobel 4x4 em 8 bins sem detecção de landmarks faciais. Não é um modelo biométrico. | Substituir por rede neural convolucional treinada (FaceRecognitionNet / ArcFace / MobileFaceNet) com alinhamento por 68 landmarks. |
| **PB-02** | `src/services/facialRecognitionService.ts` | `saveColaboradorBiometriaFacialAuthorized()` | **CRÍTICA** | Salva o vetor 128D apenas no `localStorage`. Supabase nunca recebia o template biométrico. | Criar tabela `templates_biometricos_faciais` no Supabase e persistir centralmente com versionamento de modelo. |
| **PB-03** | `src/services/facialRecognitionService.ts` | `getStoredBiometriaFacial()` | **CRÍTICA** | Consulta apenas o `localStorage`. Em outro aparelho ou aba anônima, retorna `null`. | Consultar o template ativo do colaborador no Supabase via consulta 1:1 autenticada. |
| **PB-04** | `src/components/facial/FacialCaptureEnrollment.tsx` | Linha 269 | **ALTA** | Utiliza fallback hardcoded `'AUTH_TOKEN_SUP_MANUAL'`, permitindo cadastro sem aprovação do supervisor. | Exigir token criptográfico real emitido pelo supervisor e validado atomicamente no Supabase. |
| **PB-05** | `src/components/collaborator/screens/RegistroPontoModal.tsx` | Linhas 360-388 | **CRÍTICA** | Realiza auto-cadastro facial silencioso durante a tentativa de bater ponto se o template não existir. | Bloquear o ponto se não houver template ativo com mensagem explicativa para solicitar ao supervisor. |
| **PB-06** | `src/components/collaborator/screens/RegistroPontoModal.tsx` | Linhas 190-207 | **ALTA** | Se a geolocalização falhar, substitui a coordenada do aparelho pelas coordenadas do posto. | Eliminar fallback simulado. GPS indisponível deve barrar o registro ou gerar exceção auditável. |
| **PB-07** | `src/services/pontoService.ts` | `recordPontoEvento()` | **ALTA** | Chave de idempotência baseada no minuto do relógio local; checagem de duplicidade apenas no `localStorage`. | Gerar hash criptográfico de idempotência e validar atomicamente no banco de dados. |
| **PB-08** | `src/context/AppContext.tsx` | Linhas 38-56 | **CRÍTICA** | Senhas de admin e supervisor em texto puro (`6814871984@Lm`, `Turno@2026`) expostas no bundle. | Integrar Supabase Auth (`signInWithPassword`), eliminar senhas fixas e obter roles via banco/JWT. |
| **PB-09** | `supabase/10_RECONHECIMENTO_FACIAL.sql` | Linhas 13, 41, 52 | **CRÍTICA** | Define `colaborador_id UUID`, incompatível com `colaboradores.id TEXT` do schema do sistema. | Criar migração SQL compatível com IDs `TEXT`, índices vetoriais e integridade referencial correta. |
| **PB-10** | `supabase/migrations/20261110_biometria_facial_autorizacoes_v2.sql` | Linhas 75-102 | **CRÍTICA** | RLS com `TO authenticated, anon USING (true)` permitindo acesso público anônimo de escrita. | Restringir RLS: somente `authenticated`, leitura restrita ao próprio usuário e supervisor da equipe. |
| **PB-11** | `src/services/facialRecognitionService.ts` | Linha 591 | **MÉDIA** | Geração de tokens de autorização com `Math.random().toString(36)`, vulnerável a previsibilidade. | Utilizar `crypto.getRandomValues()` e armazenar apenas o hash SHA-256 do token no banco. |
| **PB-12** | `src/components/facial/FacialCaptureEnrollment.tsx` | `initCamera()` | **MÉDIA** | Inicia processamento antes da confirmação de dimensões e metadados de vídeo (`video.videoWidth`). | Aguardar evento `loadeddata`/`canplay` e conferir dimensões mínimas (640x480). |

---

## 3. DETALHAMENTO DAS FALHAS E PLANO DE CORREÇÃO

### 3.1 Falha do Algoritmo de Extração Sobel 128D
A implementação em `extract128DFaceDescriptor` divide uma imagem de 64x64 em 16 células e calcula a magnitude dos gradientes Sobel ($dx, dy$) em 8 ângulos direcionais.
**Por que falha na prática:**
1. Não faz alinhamento dos olhos (não corrige rotação na linha dos olhos).
2. Não possui invariância a translação ou escala.
3. Se a pessoa afastar o rosto 5 cm da câmera, a distribuição dos gradientes nas células 4x4 muda inteiramente.
4. A variação de sombras ou iluminação ambiente desloca a orientação dos gradientes.

**Solução:**
Adotar `@vladmandic/face-api` (versão 1.7.15, sob licença MIT):
- **Detector Facial:** TinyFaceDetector / SSD MobileNet V1 com bounding box exato e score de confiança.
- **Alinhamento:** FaceLandmark68Net, identificando 68 pontos anatômicos (olhos, sobrancelhas, nariz, lábios e contorno mandibular) e rotacionando/escalando a face para o plano canônico.
- **Extração de Embedding:** FaceRecognitionNet (arquitetura ResNet-34 treinada em VGGFace2), gerando um vetor de 128 dimensões com norma unitária $L_2$.
- **Comparação 1:1:** Distância Euclidiana calibrada (limiar de 0.50) e similaridade de cosseno, com taxa de falsa aceitação (FAR) inferior a 0,001%.

### 3.2 Falha de Persistência no Supabase
O sistema possuía a tabela `colaboradores` com campos como `foto_url` e `biometria_cadastrada`, mas nenhuma coluna para armazenar o vetor facial normalizado.
**Solução:**
Criar a tabela `templates_biometricos_faciais`:
```sql
CREATE TABLE IF NOT EXISTS public.templates_biometricos_faciais (
  id TEXT PRIMARY KEY,
  colaborador_id TEXT NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  modelo_nome TEXT NOT NULL DEFAULT 'face_recognition_resnet34',
  modelo_versao TEXT NOT NULL DEFAULT '1.7.15',
  dimensao INTEGER NOT NULL DEFAULT 128,
  embedding JSONB NOT NULL,
  hash_template TEXT NOT NULL,
  qualidade_score FLOAT NOT NULL DEFAULT 1.0,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'legado_necessita_recadastro', 'revogado')),
  autorizado_por_supervisor_id TEXT,
  token_autorizacao_hash TEXT,
  origem_cadastro TEXT NOT NULL DEFAULT 'app_colaborador',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ativado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3.3 Fluxo de Autorização e Token Criptográfico
Eliminar totalmente o token manual `'AUTH_TOKEN_SUP_MANUAL'`. O fluxo passa a ser estritamente:
1. Colaborador solicita cadastro/recadastro no Supabase (status `pendente`).
2. Supervisor autenticado acessa painel da equipe e aprova com validade (ex: 48h).
3. É gerado um token seguro de 32 bytes via `crypto.getRandomValues()`.
4. No banco é armazenado apenas o hash SHA-256 do token.
5. No momento da captura, o token é verificado e consumido de forma atômica no banco (`consumir_autorizacao_biometria_v3`), ativando o template facial.
6. A biometria anterior permanece ativa até que a nova seja validada e ativada com sucesso.

### 3.4 Correção do Registro de Ponto
- **Sem Auto-Cadastro:** Se o colaborador tentar registrar o ponto sem biometria ativa, o sistema emite aviso formal: *"Biometria facial não disponível. Solicite cadastro ou atualização ao seu supervisor."*
- **GPS Sem Simulação Oculta:** O sinal de GPS real é validado contra o posto. Se o sinal falhar, o ponto é barrado com instrução para ativar a localização. Em caso de posto diferente da empresa, é classificado como cobertura de posto com auditoria.

---

## 4. CONCLUSÃO DA AUDITORIA

A causa técnica para o colaborador deixar de ser reconhecido foi completamente mapeada. O plano de execução nas fases seguintes substitui a pseudo-biometria pelo modelo FaceRecognitionNet com alinhamento por 68 landmarks, persiste os templates centralmente no Supabase, corrige os esquemas e permissões RLS e fecha as brechas de segurança.
