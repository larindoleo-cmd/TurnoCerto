/**
 * TurnoCerto - Ponto Service com Biometria & GPS Real Multi-Posto
 * Implementa validação geodésica em 3 estados (Haversine), limite configurável
 * de accuracy da empresa, identificação de qualquer posto ativo da mesma empresa,
 * detecção de postos sem calibração, classificação regular vs cobertura vs divergência,
 * turno noturno/múltiplos turnos, idempotência determinística e RPC transacional.
 */

import {
  CondominioPosto,
  Colaborador,
  PontoEvento,
  TipoBatidaPonto,
  StatusGeofence,
  ClassificacaoPosto,
  CoberturaProgramada,
} from '../types';
import { getSupabase } from '../lib/supabase';

export interface LocationValidationResult {
  hasGps: boolean;
  latitude?: number;
  longitude?: number;
  accuracyM?: number;
  accuracyRealM?: number;
  distanceM?: number;
  geofenceStatus: StatusGeofence;
  decisaoGeofence?: StatusGeofence;
  message: string;
  detectedPosto?: CondominioPosto;
  designatedPosto?: CondominioPosto;
  isDesignatedPosto?: boolean;
  isCoveragePunch?: boolean;
  classificacaoPosto?: ClassificacaoPosto;
  coverageAssignmentId?: string;
  ambiguidadeDetectada?: boolean;
  ambiguousPostosIds?: string[];
  uncalibratedPostos?: CondominioPosto[];
  closestPosto?: CondominioPosto;
  closestDistanceM?: number;
}

export interface NextPunchInfo {
  tipo: TipoBatidaPonto;
  label: string;
  descricao: string;
  horarioPrevisto: string;
  isComplete: boolean;
  shiftIndex?: number;
  isOvernightOpen?: boolean;
}

const PONTO_EVENTOS_LOCAL_KEY = 'turnocerto_ponto_eventos_v1';
const PONTO_SYNC_QUEUE_KEY = 'turnocerto_ponto_sync_queue_v1';
export const DEFAULT_MAX_ACCURACY_THRESHOLD_M = 80;

/**
 * Fórmula de Haversine para cálculo da distância geodésica em metros
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Obtém leitura real de GPS do dispositivo sem qualquer coordenada fallback.
 */
export async function getDeviceCoordinates(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocalização não é suportada neste dispositivo'));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0,
    });
  });
}

export function isPostoActive(p: CondominioPosto): boolean {
  return p.ativo !== false;
}

export function hasValidGeofenceCoords(p: CondominioPosto): boolean {
  return (
    typeof p.latitude === 'number' &&
    Number.isFinite(p.latitude) &&
    typeof p.longitude === 'number' &&
    Number.isFinite(p.longitude) &&
    Math.abs(p.latitude) <= 90 &&
    Math.abs(p.longitude) <= 180 &&
    (p.latitude !== 0 || p.longitude !== 0)
  );
}

/**
 * Validação de Geofence em 3 Estados Conforme Regra Imutável:
 * - Considera TODOS os postos ativos e georreferenciados da empresa.
 * - Postos ativos sem coordenadas são reportados para alerta de configuração,
 *   mas nunca contam como prova de que o colaborador está fora.
 * - Dentro com confiança: distance + accuracy <= raio
 * - Inconclusivo: intervalo [distance - accuracy, distance + accuracy] cruza raio
 * - Fora com confiança: distance - accuracy > raio para TODOS os postos elegíveis
 */
export function validateGeofence(
  userLat: number,
  userLng: number,
  accuracyM: number,
  posto: CondominioPosto,
  allCompanyPostos?: CondominioPosto[],
  maxAccuracyThresholdM: number = DEFAULT_MAX_ACCURACY_THRESHOLD_M
): LocationValidationResult {
  const safeThreshold = Math.max(10, Math.min(500, Math.round(maxAccuracyThresholdM || DEFAULT_MAX_ACCURACY_THRESHOLD_M)));

  if (!Number.isFinite(userLat) || !Number.isFinite(userLng) || !Number.isFinite(accuracyM) || accuracyM <= 0) {
    return {
      hasGps: false,
      geofenceStatus: 'gps_indisponivel',
      decisaoGeofence: 'gps_indisponivel',
      designatedPosto: posto,
      isDesignatedPosto: false,
      isCoveragePunch: false,
      message: 'Leitura GPS inválida ou ausente no dispositivo. Solicite nova leitura.',
    };
  }

  const safeAccuracy = Math.max(1, Math.round(accuracyM));

  const postosPool = (allCompanyPostos && allCompanyPostos.length > 0 ? allCompanyPostos : [posto]).filter(isPostoActive);
  const uncalibratedPostos = postosPool.filter((p) => !hasValidGeofenceCoords(p));
  const calibratedPostos = postosPool.filter(hasValidGeofenceCoords);

  if (safeAccuracy > safeThreshold) {
    return {
      hasGps: true,
      latitude: userLat,
      longitude: userLng,
      accuracyM: safeAccuracy,
      accuracyRealM: safeAccuracy,
      geofenceStatus: 'inconclusivo',
      decisaoGeofence: 'inconclusivo',
      designatedPosto: posto,
      isDesignatedPosto: false,
      isCoveragePunch: false,
      uncalibratedPostos,
      message: `Precisão do sinal GPS insuficiente (±${safeAccuracy}m; máximo configurado da empresa: ±${safeThreshold}m). Aproxime-se de área aberta e tente nova leitura.`,
    };
  }

  if (calibratedPostos.length === 0) {
    return {
      hasGps: true,
      latitude: userLat,
      longitude: userLng,
      accuracyM: safeAccuracy,
      accuracyRealM: safeAccuracy,
      geofenceStatus: 'inconclusivo',
      decisaoGeofence: 'inconclusivo',
      designatedPosto: posto,
      isDesignatedPosto: false,
      isCoveragePunch: false,
      uncalibratedPostos,
      message: `Nenhum posto ativo possui coordenadas/geofence configuradas. A gestão foi alertada para calibração GPS; utilize fluxo de exceção autorizada se necessário.`,
    };
  }

  interface PostoEvaluation {
    posto: CondominioPosto;
    distance: number;
    maxRadius: number;
    state: 'dentro' | 'inconclusivo' | 'fora';
  }

  const evaluations: PostoEvaluation[] = calibratedPostos.map((p) => {
    const pLat = Number(p.latitude);
    const pLng = Number(p.longitude);
    const maxRadius = Math.max(20, Math.round(Number(p.raioGpsMetros) || 150));
    const distance = calculateDistanceMeters(userLat, userLng, pLat, pLng);

    let state: 'dentro' | 'inconclusivo' | 'fora';
    if (distance + safeAccuracy <= maxRadius) {
      state = 'dentro';
    } else if (distance - safeAccuracy <= maxRadius) {
      state = 'inconclusivo';
    } else {
      state = 'fora';
    }

    return { posto: p, distance, maxRadius, state };
  });

  // 1. Candidatos DENTRO com confiança
  const dentroCandidatos = evaluations.filter((e) => e.state === 'dentro');
  if (dentroCandidatos.length > 0) {
    // Desempate determinístico: menor distância, depois prioridade ao posto principal, depois ID lexicográfico
    dentroCandidatos.sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      if (a.posto.id === posto.id) return -1;
      if (b.posto.id === posto.id) return 1;
      return a.posto.id.localeCompare(b.posto.id);
    });

    const chosen = dentroCandidatos[0];
    const ambiguidade = dentroCandidatos.length > 1;
    const isDesignated = chosen.posto.id === posto.id;

    return {
      hasGps: true,
      latitude: userLat,
      longitude: userLng,
      accuracyM: safeAccuracy,
      accuracyRealM: safeAccuracy,
      distanceM: chosen.distance,
      geofenceStatus: 'dentro_do_raio',
      decisaoGeofence: 'dentro_do_raio',
      detectedPosto: chosen.posto,
      designatedPosto: posto,
      isDesignatedPosto: isDesignated,
      isCoveragePunch: !isDesignated,
      ambiguidadeDetectada: ambiguidade,
      ambiguousPostosIds: ambiguidade ? dentroCandidatos.map((c) => c.posto.id) : undefined,
      uncalibratedPostos,
      classificacaoPosto: isDesignated ? 'posto_regular' : 'divergencia_posto',
      message: isDesignated
        ? `Localização confirmada no posto "${chosen.posto.nome}" (${chosen.distance}m, margem ±${safeAccuracy}m, raio ${chosen.maxRadius}m).`
        : `Localização confirmada em "${chosen.posto.nome}" (${chosen.distance}m, margem ±${safeAccuracy}m). Posto diferente da lotação habitual ("${posto.nome}").`,
    };
  }

  // 2. Candidatos INCONCLUSIVOS (borda da cerca cruzada pelo intervalo de erro)
  const inconclusivoCandidatos = evaluations.filter((e) => e.state === 'inconclusivo');
  if (inconclusivoCandidatos.length > 0) {
    inconclusivoCandidatos.sort((a, b) => a.distance - b.distance || a.posto.id.localeCompare(b.posto.id));
    const candidate = inconclusivoCandidatos[0];

    return {
      hasGps: true,
      latitude: userLat,
      longitude: userLng,
      accuracyM: safeAccuracy,
      accuracyRealM: safeAccuracy,
      distanceM: candidate.distance,
      geofenceStatus: 'inconclusivo',
      decisaoGeofence: 'inconclusivo',
      detectedPosto: candidate.posto,
      designatedPosto: posto,
      isDesignatedPosto: candidate.posto.id === posto.id,
      isCoveragePunch: candidate.posto.id !== posto.id,
      uncalibratedPostos,
      message: `Leitura GPS inconclusiva próxima ao limite de "${candidate.posto.nome}" (distância ${candidate.distance}m ±${safeAccuracy}m vs raio ${candidate.maxRadius}m). Aproxime-se da guarita e solicite nova leitura.`,
    };
  }

  // 3. Se existe posto sem coordenadas na empresa e o posto principal está sem coordenadas, não provar "fora"
  if (uncalibratedPostos.some((u) => u.id === posto.id)) {
    return {
      hasGps: true,
      latitude: userLat,
      longitude: userLng,
      accuracyM: safeAccuracy,
      accuracyRealM: safeAccuracy,
      geofenceStatus: 'inconclusivo',
      decisaoGeofence: 'inconclusivo',
      designatedPosto: posto,
      isDesignatedPosto: false,
      isCoveragePunch: false,
      uncalibratedPostos,
      message: `Seu posto-base "${posto.nome}" ainda está sem coordenadas GPS configuradas. A gestão foi notificada para calibração.`,
    };
  }

  // 4. Fora com confiança de TODOS os postos calibrados da empresa
  evaluations.sort((a, b) => a.distance - b.distance || a.posto.id.localeCompare(b.posto.id));
  const closest = evaluations[0];

  return {
    hasGps: true,
    latitude: userLat,
    longitude: userLng,
    accuracyM: safeAccuracy,
    accuracyRealM: safeAccuracy,
    distanceM: closest.distance,
    geofenceStatus: 'fora_do_raio',
    decisaoGeofence: 'fora_do_raio',
    designatedPosto: posto,
    isDesignatedPosto: false,
    isCoveragePunch: false,
    uncalibratedPostos,
    closestPosto: closest.posto,
    closestDistanceM: closest.distance,
    message: `Fora do perímetro de todos os postos válidos da empresa. Mais próximo: "${closest.posto.nome}" a ${closest.distance}m (raio ${closest.maxRadius}m, margem ±${safeAccuracy}m).`,
  };
}

/**
 * Determina a próxima batida suportando:
 * - Turno padrão (4 batidas) e turnos noturnos (19:00 - 07:00 que viram a meia-noite)
 * - Múltiplos turnos / dobra / cobertura no mesmo dia após encerramento de saída anterior
 */
export function determineNextPunch(
  recentEvents: PontoEvento[],
  colaborador: Colaborador,
  referenceNow: Date = new Date()
): NextPunchInfo {
  const cutoffMs = referenceNow.getTime() - 20 * 60 * 60 * 1000;
  const sorted = [...recentEvents]
    .filter((ev) => {
      const ts = new Date(ev.serverTimestamp).getTime();
      return Number.isFinite(ts) && ts >= cutoffMs && ts <= referenceNow.getTime() + 5 * 60 * 1000;
    })
    .sort((a, b) => new Date(a.serverTimestamp).getTime() - new Date(b.serverTimestamp).getTime());

  // Encontra o início do turno aberto mais recente (última 'entrada' após a última 'saida')
  let lastSaidaIdx = -1;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].tipoEvento === 'saida') {
      lastSaidaIdx = i;
      break;
    }
  }

  const currentShiftEvents = sorted.slice(lastSaidaIdx + 1);
  const completedShiftsCount = sorted.filter((ev) => ev.tipoEvento === 'saida').length;

  if (currentShiftEvents.length === 0) {
    return {
      tipo: 'entrada',
      label: completedShiftsCount > 0 ? 'Entrada (Novo Turno / Extra)' : 'Entrada',
      descricao:
        completedShiftsCount > 0
          ? 'Início de novo turno, cobertura ou hora extra no posto'
          : 'Início da jornada de trabalho no posto',
      horarioPrevisto: colaborador.turnoInicio || '07:00',
      isComplete: false,
      shiftIndex: completedShiftsCount + 1,
      isOvernightOpen: false,
    };
  }

  const lastEvent = currentShiftEvents[currentShiftEvents.length - 1];
  const entryDate = new Date(currentShiftEvents[0].serverTimestamp);
  const isOvernightOpen =
    entryDate.toISOString().slice(0, 10) !== referenceNow.toISOString().slice(0, 10);

  if (lastEvent.tipoEvento === 'entrada') {
    return {
      tipo: 'saida_intervalo',
      label: 'Pausa Almoço / Janta',
      descricao: 'Registro de saída para intervalo intrajornada',
      horarioPrevisto: '12:00',
      isComplete: false,
      shiftIndex: completedShiftsCount + 1,
      isOvernightOpen,
    };
  }

  if (lastEvent.tipoEvento === 'saida_intervalo') {
    return {
      tipo: 'retorno_intervalo',
      label: 'Retorno Almoço / Janta',
      descricao: 'Retorno do intervalo e retomada do posto',
      horarioPrevisto: '13:00',
      isComplete: false,
      shiftIndex: completedShiftsCount + 1,
      isOvernightOpen,
    };
  }

  return {
    tipo: 'saida',
    label: isOvernightOpen ? 'Saída (Fim de Turno Noturno)' : 'Saída',
    descricao: 'Encerramento do turno e rendição no posto',
    horarioPrevisto: colaborador.turnoFim || '19:00',
    isComplete: false,
    shiftIndex: completedShiftsCount + 1,
    isOvernightOpen,
  };
}

/**
 * Classifica o posto da batida comparando posto detectado, posto-base e coberturas vigentes.
 */
export function resolvePunchClassification(
  postoBaseId: string | null | undefined,
  postoDetectadoId: string,
  coberturasAtivas: CoberturaProgramada[],
  referenceDate: Date = new Date()
): { classificacao: ClassificacaoPosto; coverageAssignment?: CoberturaProgramada } {
  const dateBR = new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(referenceDate);

  const matchingCoverage = coberturasAtivas.find(
    (c) =>
      c.postoCoberturaId === postoDetectadoId &&
      (c.status === 'aprovada' || c.status === 'em_andamento') &&
      c.dataInicio <= dateBR &&
      c.dataFim >= dateBR
  );

  if (postoBaseId && postoDetectadoId !== postoBaseId) {
    if (matchingCoverage) {
      return {
        classificacao: matchingCoverage.tipo === 'extra' ? 'extra_programada' : 'cobertura_programada',
        coverageAssignment: matchingCoverage,
      };
    }
    return { classificacao: 'divergencia_posto' };
  }

  if (matchingCoverage && matchingCoverage.tipo === 'extra') {
    return { classificacao: 'extra_programada', coverageAssignment: matchingCoverage };
  }

  return { classificacao: 'posto_regular' };
}

/**
 * Gera chave idempotente determinística por tentativa (preservada entre retentativas)
 */
export function buildIdempotencyKey(
  colaboradorId: string,
  tipoEvento: TipoBatidaPonto,
  attemptId: string
): string {
  return `tc-pe-${colaboradorId}-${tipoEvento}-${attemptId}`;
}

export function getPontoEventos(colaboradorId: string): PontoEvento[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(PONTO_EVENTOS_LOCAL_KEY);
    if (!raw) return [];
    const all: PontoEvento[] = JSON.parse(raw);
    return all
      .filter((pe) => pe.colaboradorId === colaboradorId)
      .sort((a, b) => new Date(b.serverTimestamp).getTime() - new Date(a.serverTimestamp).getTime());
  } catch {
    return [];
  }
}

export function getPendingPontoQueue(): PontoEvento[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(PONTO_SYNC_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalEvento(evento: PontoEvento) {
  if (typeof localStorage === 'undefined') return;
  const raw = localStorage.getItem(PONTO_EVENTOS_LOCAL_KEY);
  const all: PontoEvento[] = raw ? JSON.parse(raw) : [];
  const filtered = all.filter((e) => e.idempotencyKey !== evento.idempotencyKey);
  filtered.push(evento);
  localStorage.setItem(PONTO_EVENTOS_LOCAL_KEY, JSON.stringify(filtered));
}

function enqueuePendingSync(evento: PontoEvento) {
  if (typeof localStorage === 'undefined') return;
  const queue = getPendingPontoQueue().filter((e) => e.idempotencyKey !== evento.idempotencyKey);
  queue.push(evento);
  localStorage.setItem(PONTO_SYNC_QUEUE_KEY, JSON.stringify(queue));
}

export interface RecordPontoResult {
  evento: PontoEvento;
  isSavedInDatabase: boolean;
  offlinePending: boolean;
  isDuplicated: boolean;
  message: string;
}

/**
 * Grava evento de ponto via RPC transacional registrar_ponto_transacional.
 * - Nunca muta colaboradores.condominio_id nem escala permanente.
 * - Nunca finge confirmação no servidor se o RPC falhar: marca pendente_sincronizacao.
 */
export async function recordPontoEvento(
  colaborador: Colaborador,
  posto: CondominioPosto,
  tipoEvento: TipoBatidaPonto,
  geoResult: LocationValidationResult,
  credentialId?: string,
  metodo: 'biometria_facial' | 'biometria_passkey' | 'autenticador_dispositivo' | 'excecao_autorizada' = 'biometria_facial',
  motivoExcecao?: string,
  fotoBiometriaUrl?: string,
  attemptId?: string
): Promise<RecordPontoResult> {
  if (
    (geoResult.geofenceStatus === 'fora_do_raio' ||
      geoResult.geofenceStatus === 'inconclusivo' ||
      geoResult.geofenceStatus === 'gps_indisponivel') &&
    metodo !== 'excecao_autorizada'
  ) {
    throw new Error(
      `Localização não validada (${geoResult.geofenceStatus}). Não é permitido confirmar batida sem perímetro validado ou exceção autorizada.`
    );
  }

  const now = new Date();
  const serverTimestamp = now.toISOString();
  const resolvedAttemptId =
    attemptId ||
    (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  const idempotencyKey = buildIdempotencyKey(colaborador.id, tipoEvento, resolvedAttemptId);
  const detectedPosto = geoResult.detectedPosto || posto;
  const supabase = getSupabase();

  const labelMap: Record<TipoBatidaPonto, string> = {
    entrada: 'Entrada registrada',
    saida_intervalo: 'Pausa Almoço / Janta',
    retorno_intervalo: 'Retorno Almoço / Janta',
    saida: 'Saída registrada',
  };

  let classificacao: ClassificacaoPosto =
    geoResult.classificacaoPosto ||
    (detectedPosto.id === colaborador.condominioId ? 'posto_regular' : 'divergencia_posto');
  let coverageAssignmentId = geoResult.coverageAssignmentId;

  // Pré-consulta coberturas locais/remotas para fallback offline informativo
  let coberturas: CoberturaProgramada[] = [];
  if (supabase) {
    try {
      const { data } = await supabase
        .from('coberturas_programadas')
        .select('*')
        .eq('colaborador_id', colaborador.id)
        .in('status', ['aprovada', 'em_andamento']);
      if (Array.isArray(data)) {
        coberturas = data.map((row: Record<string, unknown>) => ({
          id: String(row.id),
          empresaId: String(row.empresa_id || ''),
          colaboradorId: String(row.colaborador_id),
          postoCoberturaId: String(row.posto_cobertura_id),
          tipo: (row.tipo as CoberturaProgramada['tipo']) || 'cobertura',
          dataInicio: String(row.data_inicio),
          dataFim: String(row.data_fim),
          horaInicio: String(row.hora_inicio || '07:00'),
          horaFim: String(row.hora_fim || '19:00'),
          status: (row.status as CoberturaProgramada['status']) || 'aprovada',
          criadoEm: String(row.created_at || serverTimestamp),
        }));
      }
    } catch {
      // RPC no servidor autoritativamente classifica cobertura mesmo se query falhar
    }
  }

  const resolvedClass = resolvePunchClassification(colaborador.condominioId, detectedPosto.id, coberturas, now);
  classificacao = resolvedClass.classificacao;
  coverageAssignmentId = resolvedClass.coverageAssignment?.id;

  const isDivergencia = classificacao === 'divergencia_posto';
  const isCobertura = classificacao === 'cobertura_programada' || classificacao === 'extra_programada';

  const comprovanteFallback = `TC-${new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(now)
    .replace(/-/g, '')}-${resolvedAttemptId.slice(0, 6).toUpperCase()}`;

  const evento: PontoEvento = {
    id: `pe-${resolvedAttemptId}`,
    colaboradorId: colaborador.id,
    colaboradorNome: colaborador.nome,
    condominioId: detectedPosto.id,
    condominioNome: detectedPosto.nome,
    postoNome: detectedPosto.nome,
    tipoEvento,
    labelEvento: isDivergencia
      ? `${labelMap[tipoEvento]} (Divergência de Posto)`
      : isCobertura
      ? `${labelMap[tipoEvento]} (${classificacao === 'extra_programada' ? 'Extra Programada' : 'Cobertura Programada'})`
      : labelMap[tipoEvento],
    serverTimestamp,
    latitude: geoResult.latitude,
    longitude: geoResult.longitude,
    accuracyM: geoResult.accuracyM,
    accuracyRealM: geoResult.accuracyRealM || geoResult.accuracyM,
    geofenceStatus: geoResult.geofenceStatus,
    decisaoGeofence: geoResult.decisaoGeofence || geoResult.geofenceStatus,
    distanceM: geoResult.distanceM,
    credentialId,
    fotoBiometriaUrl,
    metodoAutenticacao: metodo,
    verificationStatus: 'pendente',
    classificacaoPosto: classificacao,
    postoBaseId: colaborador.condominioId || undefined,
    postoDetectadoId: detectedPosto.id,
    coverageAssignmentId,
    ambiguidadeDetectada: Boolean(geoResult.ambiguidadeDetectada),
    idempotencyKey,
    comprovanteNumero: comprovanteFallback,
    motivoExcecao:
      motivoExcecao ||
      (isDivergencia
        ? `Divergência de posto: ponto registrado em ${detectedPosto.nome} (lotação base: ${colaborador.postoNome || 'Matriz'})`
        : undefined),
    isCobertura: isCobertura || isDivergencia,
    postoOriginalId: colaborador.condominioId || undefined,
    postoOriginalNome: colaborador.postoNome,
    postoDetectadoNome: detectedPosto.nome,
    condominioIcone: detectedPosto.icone || 'Building2',
    condominioCor: detectedPosto.cor || '#3B82F6',
    criadoEm: serverTimestamp,
  };

  if (!supabase) {
    enqueuePendingSync(evento);
    saveLocalEvento(evento);
    return {
      evento,
      isSavedInDatabase: false,
      offlinePending: true,
      isDuplicated: false,
      message: 'Sem conexão com o servidor. Batida salva na fila local como Pendente de Sincronização.',
    };
  }

  try {
    const deviceInfo =
      typeof navigator !== 'undefined'
        ? { userAgent: navigator.userAgent, platform: navigator.platform }
        : {};

    const { data: rpcData, error: rpcErr } = await supabase.rpc('registrar_ponto_transacional', {
      p_colaborador_id: colaborador.id,
      p_tipo_evento: tipoEvento,
      p_metodo_autenticacao: metodo,
      p_idempotency_key: idempotencyKey,
      p_latitude: geoResult.latitude ?? null,
      p_longitude: geoResult.longitude ?? null,
      p_accuracy_m: geoResult.accuracyRealM ?? geoResult.accuracyM ?? null,
      p_posto_detectado_id: detectedPosto.id,
      p_decisao_geofence: geoResult.decisaoGeofence || geoResult.geofenceStatus,
      p_distance_m: geoResult.distanceM ?? null,
      p_ambiguidade_detectada: Boolean(geoResult.ambiguidadeDetectada),
      p_credential_id: credentialId ?? null,
      p_foto_biometria_url: fotoBiometriaUrl ?? null,
      p_motivo_excecao: evento.motivoExcecao ?? null,
      p_device_info: deviceInfo,
    });

    if (rpcErr || !rpcData) {
      throw rpcErr || new Error('Resposta vazia da RPC registrar_ponto_transacional');
    }

    const resObj = rpcData as Record<string, unknown>;
    evento.id = String(resObj.evento_id || evento.id);
    evento.comprovanteNumero = String(resObj.comprovante_numero || evento.comprovanteNumero);
    evento.serverTimestamp = String(resObj.server_timestamp || evento.serverTimestamp);
    evento.classificacaoPosto = (resObj.classificacao_posto as ClassificacaoPosto) || classificacao;
    evento.coverageAssignmentId = resObj.coverage_assignment_id
      ? String(resObj.coverage_assignment_id)
      : coverageAssignmentId;
    evento.verificationStatus = 'confirmado';

    const finalDivergencia = evento.classificacaoPosto === 'divergencia_posto';
    const finalCobertura =
      evento.classificacaoPosto === 'cobertura_programada' ||
      evento.classificacaoPosto === 'extra_programada';
    evento.isCobertura = finalDivergencia || finalCobertura;
    evento.labelEvento = finalDivergencia
      ? `${labelMap[tipoEvento]} (Divergência de Posto)`
      : finalCobertura
      ? `${labelMap[tipoEvento]} (${evento.classificacaoPosto === 'extra_programada' ? 'Extra Programada' : 'Cobertura Programada'})`
      : labelMap[tipoEvento];

    saveLocalEvento(evento);

    return {
      evento,
      isSavedInDatabase: true,
      offlinePending: false,
      isDuplicated: Boolean(resObj.duplicado),
      message: resObj.duplicado
        ? 'Batida idempotente já registrada anteriormente no servidor.'
        : finalDivergencia
        ? `Ponto confirmado em "${detectedPosto.nome}". Divergência de posto registrada e supervisão notificada (seu posto-base permanece inalterado).`
        : finalCobertura
        ? `Ponto confirmado como ${evento.classificacaoPosto === 'extra_programada' ? 'Extra Programada' : 'Cobertura Programada'} em "${detectedPosto.nome}".`
        : 'Ponto registrado e confirmado transacionalmente no servidor.',
    };
  } catch (err) {
    console.warn('Falha ao gravar ponto no Supabase; mantendo pendente para reenvio:', err);
    evento.verificationStatus = 'pendente';
    enqueuePendingSync(evento);
    saveLocalEvento(evento);
    return {
      evento,
      isSavedInDatabase: false,
      offlinePending: true,
      isDuplicated: false,
      message: 'Falha de rede ao gravar no servidor. Registro salvo em fila pendente de sincronização.',
    };
  }
}

/**
 * Reenvia eventos pendentes preservando idempotencyKey original.
 */
export async function syncPendingPontoEventos(): Promise<{ synced: number; remaining: number }> {
  const supabase = getSupabase();
  const queue = getPendingPontoQueue();
  if (!supabase || queue.length === 0) {
    return { synced: 0, remaining: queue.length };
  }

  let synced = 0;
  const remaining: PontoEvento[] = [];

  for (const item of queue) {
    try {
      const { data, error } = await supabase.rpc('registrar_ponto_transacional', {
        p_colaborador_id: item.colaboradorId,
        p_tipo_evento: item.tipoEvento,
        p_metodo_autenticacao: item.metodoAutenticacao,
        p_idempotency_key: item.idempotencyKey,
        p_latitude: item.latitude ?? null,
        p_longitude: item.longitude ?? null,
        p_accuracy_m: item.accuracyRealM ?? item.accuracyM ?? null,
        p_posto_detectado_id: item.postoDetectadoId ?? item.condominioId ?? null,
        p_decisao_geofence: item.decisaoGeofence || item.geofenceStatus,
        p_distance_m: item.distanceM ?? null,
        p_ambiguidade_detectada: Boolean(item.ambiguidadeDetectada),
        p_credential_id: item.credentialId ?? null,
        p_foto_biometria_url: item.fotoBiometriaUrl ?? null,
        p_motivo_excecao: item.motivoExcecao ?? null,
        p_device_info: { syncedFromQueue: true },
      });
      if (error || !data) throw error || new Error('Erro RPC');
      item.verificationStatus = 'confirmado';
      saveLocalEvento(item);
      synced++;
    } catch {
      remaining.push(item);
    }
  }

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(PONTO_SYNC_QUEUE_KEY, JSON.stringify(remaining));
  }

  return { synced, remaining: remaining.length };
}
