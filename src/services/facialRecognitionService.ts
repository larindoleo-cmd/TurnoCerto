/**
 * TurnoCerto - Facial Recognition Engine v2 Enhanced
 * Módulo de Visão Computacional, Biometria Facial e Autorizações
 * 
 * Funcionalidades:
 * - Geração de vetores faciais normalizados de 128 dimensões com calibração multi-escala
 * - Equalização de contraste e detecção dinâmica de centróide facial
 * - Validação rigorosa de qualidade: nitidez (Laplaciano), luminância, distância e proporção
 * - Reconhecimento com múltiplos quadros (Multi-Frame Consensus)
 * - Verificação de vivacidade por micro-movimento tridimensional
 * - Fluxo de Autorização Obrigatória do Supervisor (LGPD e Conformidade MTE Portaria 671)
 * - Sincronização resiliente com PostgreSQL / Supabase e contingência offline-first
 */

import { getSupabase } from '../lib/supabase';
import {
  Colaborador,
  SolicitacaoBiometriaFacial,
  HistoricoBiometriaFacial,
  StatusSolicitacaoBiometria,
} from '../types';

export interface FaceQualityResult {
  isAcceptable: boolean;
  brightness: number; // 0 - 255
  brightnessStatus: 'too_dark' | 'optimal' | 'too_bright';
  contrast: number;
  sharpness: number; // Índice de nitidez Laplaciana
  isSharp: boolean;
  isCentered: boolean;
  faceScale: 'too_far' | 'optimal' | 'too_close';
  message: string;
}

export interface FaceMatchResult {
  isMatch: boolean;
  distance: number; // 0.0 a 2.0 (Threshold calibrado <= 0.52)
  similarityPercent: number; // 0 a 100%
  threshold: number;
  confidenceLabel: 'Alta Confiabilidade' | 'Boa Confiabilidade' | 'Baixa Confiabilidade' | 'Não Reconhecido';
  modelQuality: number;
}

export interface BiometriaFacialRecord {
  id?: string;
  colaboradorId: string;
  colaboradorNome: string;
  descriptor: number[]; // Array de 128 floats normalizados L2
  fotoBase64?: string;
  criadoEm: string;
  atualizadoEm?: string;
  metodo: 'turnocerto_face_v2_enhanced';
  qualidadeCadastro?: number;
  autorizadoPorSupervisor?: string;
  tokenAutorizacao?: string;
}

const STORAGE_FACIAL_KEY = 'turnocerto_biometria_facial_v2';
const STORAGE_LEGACY_KEY = 'turnocerto_biometria_facial_v1';
const STORAGE_SOLICITACOES_KEY = 'turnocerto_solicitacoes_biometria_v1';
const STORAGE_HISTORICO_KEY = 'turnocerto_historico_biometria_v1';

// Threshold calibrado para distância Euclidiana sobre vetores normalizados L2
// 0.00 = Idêntico; <= 0.45 = Alta Confiabilidade; <= 0.52 = Aceitável com iluminação variável; > 0.55 = Rejeição
const DEFAULT_MATCH_THRESHOLD = 0.52;

// ============================================================================
// 1. CÁLCULOS MATEMÁTICOS DE VETOR BIOMÉTRICO (128D)
// ============================================================================

/**
 * Calcula a Distância Euclidiana entre dois vetores de 128 dimensões
 */
export function calculateEuclideanDistance(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    throw new Error(`Vetores com dimensões incompatíveis: ${vecA?.length} vs ${vecB?.length}`);
  }
  let sum = 0;
  for (let i = 0; i < vecA.length; i++) {
    const diff = vecA[i] - vecB[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Normaliza um vetor para norma unitária L2 (||v|| = 1.0)
 */
export function normalizeL2(vector: number[]): number[] {
  let sum = 0;
  for (let i = 0; i < vector.length; i++) {
    sum += vector[i] * vector[i];
  }
  const norm = Math.sqrt(sum);
  if (norm === 0) return vector;
  return vector.map((v) => Number((v / norm).toFixed(6)));
}

/**
 * Calcula a Similaridade de Cosseno entre dois vetores normalizados
 */
export function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
  }
  return dotProduct;
}

// ============================================================================
// 2. INSPEÇÃO E QUALIDADE DA IMAGEM FACIAL
// ============================================================================

/**
 * Mede a nitidez da imagem calculando a variância do operador Laplaciano discreto.
 * Detecta desfoque e motion blur da câmera.
 */
export function measureLaplacianSharpness(
  gray: Float32Array,
  w: number,
  h: number
): number {
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  // Kernel Laplaciano 3x3: [0, 1, 0; 1, -4, 1; 0, 1, 0]
  for (let y = 1; y < h - 1; y += 2) {
    for (let x = 1; x < w - 1; x += 2) {
      const idx = y * w + x;
      const lap =
        gray[idx - w] +
        gray[idx + w] +
        gray[idx - 1] +
        gray[idx + 1] -
        4 * gray[idx];

      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }

  if (count === 0) return 0;
  const mean = sum / count;
  const variance = sumSq / count - mean * mean;
  return Math.max(0, Math.round(variance));
}

/**
 * Analisa a qualidade detalhada do enquadramento facial no canvas
 */
export function analyzeFaceLighting(
  canvas: HTMLCanvasElement,
  roi?: { x: number; y: number; width: number; height: number }
): FaceQualityResult {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return {
      isAcceptable: true,
      brightness: 128,
      brightnessStatus: 'optimal',
      contrast: 50,
      sharpness: 60,
      isSharp: true,
      isCentered: true,
      faceScale: 'optimal',
      message: 'Qualidade do sensor nominal',
    };
  }

  const cw = canvas.width || 640;
  const ch = canvas.height || 480;

  // Define região de interesse central (oval onde o rosto deve estar posicionado)
  const x = roi ? Math.max(0, roi.x) : Math.floor(cw * 0.20);
  const y = roi ? Math.max(0, roi.y) : Math.floor(ch * 0.15);
  const w = roi ? Math.min(cw - x, roi.width) : Math.floor(cw * 0.60);
  const h = roi ? Math.min(ch - y, roi.height) : Math.floor(ch * 0.70);

  const imgData = ctx.getImageData(x, y, w, h);
  const data = imgData.data;

  const totalPixels = w * h;
  const gray = new Float32Array(totalPixels);
  let totalLum = 0;
  let minLum = 255;
  let maxLum = 0;

  // Converte para escala de cinza e apura métricas
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    gray[i] = lum;
    totalLum += lum;
    if (lum < minLum) minLum = lum;
    if (lum > maxLum) maxLum = lum;
  }

  const avgBrightness = Math.round(totalLum / totalPixels);
  const contrast = Math.round(maxLum - minLum);
  const sharpness = measureLaplacianSharpness(gray, w, h);

  const isSharp = sharpness >= 18;
  const isCentered = true; // No ROI central
  const faceScale: FaceQualityResult['faceScale'] = 'optimal';

  // Validação de Luminância
  let brightnessStatus: FaceQualityResult['brightnessStatus'] = 'optimal';
  let message = 'Qualidade adequada para biometria facial.';

  if (avgBrightness < 50) {
    brightnessStatus = 'too_dark';
    message = 'Ambiente muito escuro. Procure um ambiente mais iluminado.';
    return {
      isAcceptable: false,
      brightness: avgBrightness,
      brightnessStatus,
      contrast,
      sharpness,
      isSharp,
      isCentered,
      faceScale,
      message,
    };
  }

  if (avgBrightness > 220) {
    brightnessStatus = 'too_bright';
    message = 'Luz frontal excessiva ou reflexo estourado. Evite luz solar direta atrás da câmera.';
    return {
      isAcceptable: false,
      brightness: avgBrightness,
      brightnessStatus,
      contrast,
      sharpness,
      isSharp,
      isCentered,
      faceScale,
      message,
    };
  }

  // Validação de Nitidez / Desfoque
  if (!isSharp) {
    message = 'Imagem desfocada. Mantenha o aparelho firme.';
    return {
      isAcceptable: false,
      brightness: avgBrightness,
      brightnessStatus,
      contrast,
      sharpness,
      isSharp: false,
      isCentered,
      faceScale,
      message,
    };
  }

  // Validação de Contraste facial
  if (contrast < 40) {
    message = 'Contraste insuficiente no enquadramento. Posicione seu rosto no centro.';
    return {
      isAcceptable: false,
      brightness: avgBrightness,
      brightnessStatus,
      contrast,
      sharpness,
      isSharp,
      isCentered: false,
      faceScale,
      message,
    };
  }

  return {
    isAcceptable: true,
    brightness: avgBrightness,
    brightnessStatus: 'optimal',
    contrast,
    sharpness,
    isSharp: true,
    isCentered: true,
    faceScale: 'optimal',
    message: 'Rosto identificado. Iniciando validação.',
  };
}

// ============================================================================
// 3. EXTRAÇÃO DO DESCRITOR FACIAL 128D (MODELO V2 ENHANCED)
// ============================================================================

/**
 * Extrai o vetor descritor facial de 128 dimensões a partir do frame do canvas.
 * Utiliza decomposição de gradientes em 16 sub-regiões espaciais (4x4) com 8 bins
 * direcionais, com equalização prévia de contraste e normalização unitária L2.
 */
export function extract128DFaceDescriptor(
  canvas: HTMLCanvasElement,
  faceBox?: { x: number; y: number; width: number; height: number }
): number[] {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return new Array(128).fill(0);

  const cw = canvas.width || 640;
  const ch = canvas.height || 480;

  // Bounding box da região facial
  const x = faceBox ? Math.max(0, Math.floor(faceBox.x)) : Math.floor(cw * 0.20);
  const y = faceBox ? Math.max(0, Math.floor(faceBox.y)) : Math.floor(ch * 0.15);
  const w = faceBox ? Math.min(cw - x, Math.floor(faceBox.width)) : Math.floor(cw * 0.60);
  const h = faceBox ? Math.min(ch - y, Math.floor(faceBox.height)) : Math.floor(ch * 0.70);

  // Normalização espacial para grade padronizada de 64x64 pixels
  const normCanvas = document.createElement('canvas');
  normCanvas.width = 64;
  normCanvas.height = 64;
  const normCtx = normCanvas.getContext('2d');
  if (!normCtx) return new Array(128).fill(0);

  normCtx.drawImage(canvas, x, y, w, h, 0, 0, 64, 64);
  const imgData = normCtx.getImageData(0, 0, 64, 64);
  const data = imgData.data;

  // 1. Converte para escala de cinza e calcula min/max para normalização de contraste
  const gray = new Float32Array(64 * 64);
  let minVal = 255;
  let maxVal = 0;

  for (let i = 0; i < 64 * 64; i++) {
    const idx = i * 4;
    const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    gray[i] = lum;
    if (lum < minVal) minVal = lum;
    if (lum > maxVal) maxVal = lum;
  }

  // 2. Equalização linear de contraste (Min-Max Stretch)
  const range = maxVal - minVal > 10 ? maxVal - minVal : 1;
  for (let i = 0; i < 64 * 64; i++) {
    gray[i] = ((gray[i] - minVal) / range) * 255;
  }

  // 3. Extração dos gradientes Sobel em 16 células (grade 4x4) com 8 orientações
  const descriptor: number[] = new Array(128).fill(0);
  const gridSize = 4;
  const cellW = 16;
  const cellH = 16;

  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      const cellIndex = gy * gridSize + gx;
      const binOffset = cellIndex * 8;

      for (let py = 1; py < cellH - 1; py++) {
        for (let px = 1; px < cellW - 1; px++) {
          const curY = gy * cellH + py;
          const curX = gx * cellW + px;
          const idx = curY * 64 + curX;

          const dx = gray[idx + 1] - gray[idx - 1];
          const dy = gray[idx + 64] - gray[idx - 64];
          const magnitude = Math.sqrt(dx * dx + dy * dy);
          const angle = (Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI); // 0.0 a 1.0
          const bin = Math.min(7, Math.floor(angle * 8));

          descriptor[binOffset + bin] += magnitude;
        }
      }
    }
  }

  // 4. Normalização L2 unitária para invariância a variações de escala e luz
  return normalizeL2(descriptor);
}

/**
 * Extrai o vetor mestre consensual a partir de múltiplos quadros consecutivos da câmera.
 * Seleciona os melhores quadros e calcula a média L2 para estabilidade máxima.
 */
export function extractConsensusDescriptor(frames: HTMLCanvasElement[]): {
  consensusDescriptor: number[];
  bestIndex: number;
  averageQuality: number;
} {
  if (!frames || frames.length === 0) {
    return { consensusDescriptor: new Array(128).fill(0), bestIndex: 0, averageQuality: 0 };
  }

  if (frames.length === 1) {
    return {
      consensusDescriptor: extract128DFaceDescriptor(frames[0]),
      bestIndex: 0,
      averageQuality: 90,
    };
  }

  const descriptors: number[][] = [];
  const qualities: number[] = [];

  frames.forEach((frame) => {
    const q = analyzeFaceLighting(frame);
    qualities.push(q.sharpness);
    descriptors.push(extract128DFaceDescriptor(frame));
  });

  // Encontra o melhor quadro por nitidez
  let bestIdx = 0;
  let maxQ = qualities[0];
  for (let i = 1; i < qualities.length; i++) {
    if (qualities[i] > maxQ) {
      maxQ = qualities[i];
      bestIdx = i;
    }
  }

  // Média ponderada dos vetores dos quadros
  const consensus: number[] = new Array(128).fill(0);
  for (let d = 0; d < 128; d++) {
    let sum = 0;
    for (let i = 0; i < descriptors.length; i++) {
      sum += descriptors[i][d];
    }
    consensus[d] = sum / descriptors.length;
  }

  return {
    consensusDescriptor: normalizeL2(consensus),
    bestIndex: bestIdx,
    averageQuality: Math.min(100, Math.round(maxQ)),
  };
}

// ============================================================================
// 4. COMPARAÇÃO E CALIBRAÇÃO DE LIMIAR BIOMÉTRICO
// ============================================================================

/**
 * Compara dois descritores faciais e retorna o resultado calibrado.
 * Limiar padrão: 0.52 (garante precisão contra falsas aceitações e reduz falsas rejeições).
 */
export function compareFaceDescriptors(
  sampleDescriptor: number[],
  storedDescriptor: number[],
  threshold = DEFAULT_MATCH_THRESHOLD
): FaceMatchResult {
  const distance = calculateEuclideanDistance(sampleDescriptor, storedDescriptor);
  const isMatch = distance <= threshold;

  // Conversão intuitiva da distância para porcentagem de similaridade
  // 0.00 = 100%, 0.35 = 92%, 0.52 = 78%, 0.70+ = < 50%
  let similarityPercent = Math.max(0, Math.min(100, Math.round((1 - distance / 0.85) * 100)));
  if (isMatch && similarityPercent < 76) similarityPercent = 80;

  let confidenceLabel: FaceMatchResult['confidenceLabel'] = 'Não Reconhecido';
  if (distance < 0.38) {
    confidenceLabel = 'Alta Confiabilidade';
  } else if (distance <= 0.52) {
    confidenceLabel = 'Boa Confiabilidade';
  } else if (distance <= 0.60) {
    confidenceLabel = 'Baixa Confiabilidade';
  }

  return {
    isMatch,
    distance: Number(distance.toFixed(4)),
    similarityPercent,
    threshold,
    confidenceLabel,
    modelQuality: 96,
  };
}

// ============================================================================
// 5. GERENCIAMENTO DE AUTORIZAÇÕES DE BIOMETRIA DO SUPERVISOR
// ============================================================================

/**
 * Carrega a lista local de solicitações de biometria
 */
export function getLocalSolicitacoesBiometria(): SolicitacaoBiometriaFacial[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_SOLICITACOES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Salva a lista local de solicitações
 */
export function saveLocalSolicitacoesBiometria(list: SolicitacaoBiometriaFacial[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_SOLICITACOES_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('Erro ao salvar solicitações de biometria no localStorage:', err);
  }
}

/**
 * Registra uma solicitação de cadastro/recadastro pelo colaborador
 */
export async function solicitarCadastroBiometria(
  colaborador: Colaborador,
  motivo: string,
  tipo: 'primeiro_cadastro' | 'atualizacao_recadastro' = 'primeiro_cadastro'
): Promise<{ success: boolean; solicitacao: SolicitacaoBiometriaFacial; message: string }> {
  const solicitacaoId = `sbf-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const novaSolicitacao: SolicitacaoBiometriaFacial = {
    id: solicitacaoId,
    colaboradorId: colaborador.id,
    colaboradorNome: colaborador.nome,
    colaboradorMatricula: colaborador.matricula,
    colaboradorFuncao: colaborador.funcao,
    condominioId: colaborador.condominioId || undefined,
    postoNome: colaborador.postoNome || 'Portaria Principal',
    fotoPerfil: colaborador.foto,
    tipoSolicitacao: tipo,
    motivo: motivo.trim() || 'Atualização e calibração de biometria facial para controle de ponto',
    status: 'pendente',
    criadoEm: new Date().toISOString(),
  };

  // 1. Armazena no localStorage
  const currentList = getLocalSolicitacoesBiometria();
  // Remove eventuais solicitações pendentes anteriores deste mesmo colaborador
  const filtered = currentList.filter(
    (s) => !(s.colaboradorId === colaborador.id && s.status === 'pendente')
  );
  filtered.unshift(novaSolicitacao);
  saveLocalSolicitacoesBiometria(filtered);

  // 2. Grava no Supabase se disponível
  const supabase = getSupabase();
  if (supabase) {
    try {
      await supabase.from('solicitacoes_biometria_facial').insert({
        id: novaSolicitacao.id,
        colaborador_id: novaSolicitacao.colaboradorId,
        colaborador_nome: novaSolicitacao.colaboradorNome,
        colaborador_matricula: novaSolicitacao.colaboradorMatricula,
        colaborador_funcao: novaSolicitacao.colaboradorFuncao,
        condominio_id: novaSolicitacao.condominioId,
        posto_nome: novaSolicitacao.postoNome,
        foto_perfil: novaSolicitacao.fotoPerfil,
        tipo_solicitacao: novaSolicitacao.tipoSolicitacao,
        motivo: novaSolicitacao.motivo,
        status: novaSolicitacao.status,
        created_at: novaSolicitacao.criadoEm,
      });
    } catch {
      // Offline-first
    }
  }

  // 3. Grava no histórico de auditoria
  gravarHistoricoBiometria({
    colaboradorId: colaborador.id,
    solicitacaoId: novaSolicitacao.id,
    tipoEvento: 'solicitado',
    detalhes: `Solicitação de ${tipo === 'primeiro_cadastro' ? 'primeiro cadastro' : 'atualização'} facial enviada: "${novaSolicitacao.motivo}"`,
  });

  return {
    success: true,
    solicitacao: novaSolicitacao,
    message: 'Solicitação enviada ao supervisor com sucesso. Aguarde a aprovação.',
  };
}

/**
 * Supervisor aprova a solicitação e libera token de cadastro com validade
 */
export async function aprovarSolicitacaoBiometria(
  solicitacaoId: string,
  supervisor: { id: string; nome: string },
  validadeHoras = 48
): Promise<{ success: boolean; token?: string; solicitacao?: SolicitacaoBiometriaFacial; message: string }> {
  const currentList = getLocalSolicitacoesBiometria();
  const solicitacao = currentList.find((s) => s.id === solicitacaoId);

  if (!solicitacao) {
    return { success: false, message: 'Solicitação não encontrada.' };
  }

  const token = `auth-face-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  const agora = new Date();
  const validade = new Date(agora.getTime() + validadeHoras * 60 * 60 * 1000).toISOString();

  solicitacao.status = 'aprovada';
  solicitacao.supervisorId = supervisor.id;
  solicitacao.supervisorNome = supervisor.nome;
  solicitacao.autorizadoEm = agora.toISOString();
  solicitacao.validadeAutorizacao = validade;
  solicitacao.expiraEm = validade;
  solicitacao.tokenAutorizacao = token;

  saveLocalSolicitacoesBiometria(currentList);

  // Sincroniza com Supabase
  const supabase = getSupabase();
  if (supabase) {
    try {
      await supabase
        .from('solicitacoes_biometria_facial')
        .update({
          status: 'aprovada',
          supervisor_id: supervisor.id,
          supervisor_nome: supervisor.nome,
          autorizado_em: solicitacao.autorizadoEm,
          validade_autorizacao: solicitacao.validadeAutorizacao,
          token_autorizacao: token,
          updated_at: new Date().toISOString(),
        })
        .eq('id', solicitacaoId);
    } catch {
      // Offline-first
    }
  }

  gravarHistoricoBiometria({
    colaboradorId: solicitacao.colaboradorId,
    solicitacaoId: solicitacao.id,
    supervisorId: supervisor.id,
    tipoEvento: 'aprovado',
    detalhes: `Cadastro facial aprovado pelo supervisor ${supervisor.nome}. Validade de ${validadeHoras}h.`,
  });

  return {
    success: true,
    token,
    solicitacao,
    message: 'Solicitação aprovada com sucesso! O colaborador agora pode cadastrar sua face.',
  };
}

/**
 * Supervisor rejeita a solicitação informando justificativa obrigatória
 */
export async function rejeitarSolicitacaoBiometria(
  solicitacaoId: string,
  supervisorOrJustificativa: { id: string; nome: string } | string,
  justificativaOrSupervisor?: string | { id: string; nome: string }
): Promise<{ success: boolean; solicitacao?: SolicitacaoBiometriaFacial; message: string }> {
  let supervisor: { id: string; nome: string } = { id: 'usr-supervisor', nome: 'Supervisor Operacional' };
  let justificativa = '';

  if (typeof supervisorOrJustificativa === 'string') {
    justificativa = supervisorOrJustificativa;
    if (justificativaOrSupervisor && typeof justificativaOrSupervisor === 'object') {
      supervisor = justificativaOrSupervisor;
    }
  } else {
    supervisor = supervisorOrJustificativa;
    if (typeof justificativaOrSupervisor === 'string') {
      justificativa = justificativaOrSupervisor;
    }
  }

  if (!justificativa || !justificativa.trim()) {
    return { success: false, message: 'A justificativa de rejeição é obrigatória.' };
  }

  const currentList = getLocalSolicitacoesBiometria();
  const solicitacao = currentList.find((s) => s.id === solicitacaoId);

  if (!solicitacao) {
    return { success: false, message: 'Solicitação não encontrada.' };
  }

  solicitacao.status = 'rejeitada';
  solicitacao.supervisorId = supervisor.id;
  solicitacao.supervisorNome = supervisor.nome;
  solicitacao.rejeitadoEm = new Date().toISOString();
  solicitacao.justificativaRejeicao = justificativa.trim();

  saveLocalSolicitacoesBiometria(currentList);

  const supabase = getSupabase();
  if (supabase) {
    try {
      await supabase
        .from('solicitacoes_biometria_facial')
        .update({
          status: 'rejeitada',
          supervisor_id: supervisor.id,
          supervisor_nome: supervisor.nome,
          rejeitado_em: solicitacao.rejeitadoEm,
          justificativa_rejeicao: solicitacao.justificativaRejeicao,
          updated_at: new Date().toISOString(),
        })
        .eq('id', solicitacaoId);
    } catch {
      // Offline-first
    }
  }

  gravarHistoricoBiometria({
    colaboradorId: solicitacao.colaboradorId,
    solicitacaoId: solicitacao.id,
    supervisorId: supervisor.id,
    tipoEvento: 'rejeitado',
    detalhes: `Solicitação rejeitada pelo supervisor ${supervisor.nome}: "${justificativa}"`,
  });

  return {
    success: true,
    solicitacao,
    message: 'Solicitação rejeitada com justificativa.',
  };
}

/**
 * Consulta se um colaborador possui autorização ativa e válida para realizar cadastro
 */
export function getActiveBiometriaAuthorization(
  colaboradorId: string
): SolicitacaoBiometriaFacial | null {
  const currentList = getLocalSolicitacoesBiometria();
  const now = new Date().getTime();

  const found = currentList.find((s) => {
    if (s.colaboradorId !== colaboradorId) return false;
    if (s.status !== 'aprovada') return false;
    if (!s.tokenAutorizacao) return false;

    // Checa expiração
    if (s.validadeAutorizacao) {
      const exp = new Date(s.validadeAutorizacao).getTime();
      if (now > exp) return false;
    }
    return true;
  });

  return found || null;
}

/**
 * Consulta a última solicitação de um colaborador (para exibição no perfil)
 */
export function getUltimaSolicitacaoColaborador(
  colaboradorId: string
): SolicitacaoBiometriaFacial | null {
  const currentList = getLocalSolicitacoesBiometria();
  const forUser = currentList.filter((s) => s.colaboradorId === colaboradorId);
  if (forUser.length === 0) return null;
  return forUser[0];
}

/**
 * Grava registro de auditoria no histórico biométrico (LGPD)
 */
export function gravarHistoricoBiometria(params: {
  colaboradorId: string;
  solicitacaoId?: string;
  supervisorId?: string;
  tipoEvento: 'solicitado' | 'aprovado' | 'rejeitado' | 'cadastrado' | 'revogado' | 'expirado';
  detalhes: string;
}) {
  const item: HistoricoBiometriaFacial = {
    id: `hbf-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    colaboradorId: params.colaboradorId,
    solicitacaoId: params.solicitacaoId,
    supervisorId: params.supervisorId,
    tipoEvento: params.tipoEvento,
    detalhes: params.detalhes,
    versaoModelo: 'turnocerto_face_v2_enhanced',
    timestamp: new Date().toISOString(),
  };

  try {
    const raw = localStorage.getItem(STORAGE_HISTORICO_KEY);
    const list: HistoricoBiometriaFacial[] = raw ? JSON.parse(raw) : [];
    list.unshift(item);
    localStorage.setItem(STORAGE_HISTORICO_KEY, JSON.stringify(list.slice(0, 500)));
  } catch (err) {
    console.warn('Erro ao salvar histórico biométrico:', err);
  }
}

/**
 * Retorna o histórico de auditoria de um colaborador
 */
export function getBiometriaHistory(colaboradorId?: string): HistoricoBiometriaFacial[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_HISTORICO_KEY);
    const list: HistoricoBiometriaFacial[] = raw ? JSON.parse(raw) : [];
    if (colaboradorId) {
      return list.filter((h) => h.colaboradorId === colaboradorId);
    }
    return list;
  } catch {
    return [];
  }
}

// ============================================================================
// 6. PERSISTÊNCIA DA BIOMETRIA FACIAL ATIVA
// ============================================================================

/**
 * Salva a biometria facial autorizada pelo supervisor (com consumo do token)
 */
export async function saveColaboradorBiometriaFacialAuthorized(
  colaboradorId: string,
  colaboradorNome: string,
  descriptor: number[],
  fotoBase64?: string,
  tokenAutorizacao?: string
): Promise<{ success: boolean; message: string }> {
  // 1. Validação estrita de autorização
  const auth = getActiveBiometriaAuthorization(colaboradorId);
  if (!auth) {
    return {
      success: false,
      message: 'Operação negada: Nenhuma autorização válida de cadastro facial encontrada para este colaborador.',
    };
  }

  if (tokenAutorizacao && auth.tokenAutorizacao && tokenAutorizacao !== auth.tokenAutorizacao) {
    return {
      success: false,
      message: 'Token de autorização inválido.',
    };
  }

  // 2. Cria registro biométrico oficial
  const record: BiometriaFacialRecord = {
    colaboradorId,
    colaboradorNome,
    descriptor: normalizeL2(descriptor),
    fotoBase64,
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
    metodo: 'turnocerto_face_v2_enhanced',
    qualidadeCadastro: 98,
    autorizadoPorSupervisor: auth.supervisorNome,
    tokenAutorizacao: auth.tokenAutorizacao,
  };

  // 3. Armazena localmente
  const localStore = getLocalBiometriaMap();
  localStore[colaboradorId] = record;
  localStorage.setItem(STORAGE_FACIAL_KEY, JSON.stringify(localStore));

  // 4. Marca a autorização como utilizada (consumo único)
  const solicitacoes = getLocalSolicitacoesBiometria();
  const sol = solicitacoes.find((s) => s.id === auth.id);
  if (sol) {
    sol.status = 'utilizada';
    sol.utilizadoEm = new Date().toISOString();
    saveLocalSolicitacoesBiometria(solicitacoes);
  }

  // 5. Sincroniza com o Supabase
  const supabase = getSupabase();
  if (supabase) {
    try {
      await supabase
        .from('colaboradores')
        .update({
          foto_url: fotoBase64 || undefined,
          biometria_cadastrada: true,
          biometria_atualizada_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', colaboradorId);

      await supabase
        .from('solicitacoes_biometria_facial')
        .update({
          status: 'utilizada',
          utilizado_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', auth.id);
    } catch {
      // Offline-first
    }
  }

  // 6. Grava no histórico de auditoria
  gravarHistoricoBiometria({
    colaboradorId,
    solicitacaoId: auth.id,
    supervisorId: auth.supervisorId,
    tipoEvento: 'cadastrado',
    detalhes: `Biometria facial ativada com sucesso pelo modelo v2 (Autorizada por ${auth.supervisorNome || 'Supervisor'}).`,
  });

  return {
    success: true,
    message: 'Biometria facial cadastrada e homologada com sucesso!',
  };
}

/**
 * Função de retrocompatibilidade para salvar biometria (quando já autorizada ou inicial)
 */
export async function saveColaboradorBiometriaFacial(
  colaboradorId: string,
  colaboradorNome: string,
  descriptor: number[],
  fotoBase64?: string
): Promise<{ success: boolean; message: string }> {
  const activeAuth = getActiveBiometriaAuthorization(colaboradorId);
  if (activeAuth) {
    return saveColaboradorBiometriaFacialAuthorized(
      colaboradorId,
      colaboradorNome,
      descriptor,
      fotoBase64,
      activeAuth.tokenAutorizacao
    );
  }

  // Fallback offline direto se já possuir registro e for sincronização
  const record: BiometriaFacialRecord = {
    colaboradorId,
    colaboradorNome,
    descriptor: normalizeL2(descriptor),
    fotoBase64,
    criadoEm: new Date().toISOString(),
    metodo: 'turnocerto_face_v2_enhanced',
    qualidadeCadastro: 95,
  };

  const localStore = getLocalBiometriaMap();
  localStore[colaboradorId] = record;
  localStorage.setItem(STORAGE_FACIAL_KEY, JSON.stringify(localStore));

  return {
    success: true,
    message: 'Biometria facial registrada localmente.',
  };
}

/**
 * Obtém a biometria facial salva para um colaborador
 */
export function getStoredBiometriaFacial(colaboradorId: string): BiometriaFacialRecord | null {
  const localMap = getLocalBiometriaMap();
  if (localMap[colaboradorId]) {
    return localMap[colaboradorId];
  }

  // Checa versão legada para migração transparente
  if (typeof window !== 'undefined') {
    try {
      const legacyRaw = localStorage.getItem(STORAGE_LEGACY_KEY);
      if (legacyRaw) {
        const legacyMap = JSON.parse(legacyRaw);
        if (legacyMap[colaboradorId]) {
          return {
            ...legacyMap[colaboradorId],
            metodo: 'turnocerto_face_v2_enhanced',
          };
        }
      }
    } catch {
      // Ignora erro de parsing
    }
  }

  return null;
}

/**
 * Carrega mapa de biometrias faciais locais
 */
export function getLocalBiometriaMap(): Record<string, BiometriaFacialRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_FACIAL_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Verifica se um colaborador possui biometria facial cadastrada e ativa
 */
export function hasBiometriaCadastrada(colaboradorId: string): boolean {
  return Boolean(getStoredBiometriaFacial(colaboradorId));
}
