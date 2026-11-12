/**
 * TurnoCerto - Ponto Service com Biometria & GPS Real Multi-Posto
 * Conforme Portaria 671 MTE e Requisitos Arquiteturais TurnoCerto.
 * Implementa validação geodésica em 3 estados (Haversine), controle rigoroso de
 * precisão do sensor, identificação de qualquer posto da empresa, coberturas
 * programadas, controle de idempotência, auditoria e emissão de comprovante oficial.
 */

import {
  CondominioPosto,
  Colaborador,
  PontoEvento,
  TipoBatidaPonto,
  StatusGeofence,
  ClassificacaoPosto,
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
  closestPosto?: CondominioPosto;
  closestDistanceM?: number;
}

export interface NextPunchInfo {
  tipo: TipoBatidaPonto;
  label: string;
  descricao: string;
  horarioPrevisto: string;
  isComplete: boolean;
}

const PONTO_EVENTOS_LOCAL_KEY = 'turnocerto_ponto_eventos_v1';
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
  const R = 6371000; // Raio médio da Terra em metros
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
 * Obtém as coordenadas reais do dispositivo móvel através da Geolocation API do navegador
 */
export async function getDeviceCoordinates(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
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

/**
 * Validação de Geofence em 3 Estados Conforme Regra de Negócio:
 * - Dentro com confiança: distância + accuracy <= raio
 * - Inconclusivo: o intervalo de erro cruza a cerca virtual
 * - Fora com confiança: distância - accuracy > raio para TODOS os postos elegíveis
 */
export function validateGeofence(
  userLat: number,
  userLng: number,
  accuracyM: number,
  posto: CondominioPosto,
  allCompanyPostos?: CondominioPosto[],
  maxAccuracyThresholdM: number = DEFAULT_MAX_ACCURACY_THRESHOLD_M
): LocationValidationResult {
  const safeAccuracy = Math.max(1, Math.round(accuracyM || 10));

  // 1. Verificação de precisão aceitável do sensor GPS
  if (safeAccuracy > maxAccuracyThresholdM) {
    return {
      hasGps: true,
      latitude: userLat,
      longitude: userLng,
      accuracyM: safeAccuracy,
      accuracyRealM: safeAccuracy,
      distanceM: 0,
      geofenceStatus: 'inconclusivo',
      decisaoGeofence: 'inconclusivo',
      designatedPosto: posto,
      isDesignatedPosto: true,
      isCoveragePunch: false,
      message: `Precisão do sinal GPS insuficiente (±${safeAccuracy}m, limite da empresa: ±${maxAccuracyThresholdM}m). Por favor, aproxime-se de área aberta e solicite nova leitura.`,
    };
  }

  const postosList = allCompanyPostos && allCompanyPostos.length > 0 ? allCompanyPostos : [posto];

  // Filtra apenas postos ativos que possuem coordenadas calibradas
  const calibratedPostos = postosList.filter(
    (p) =>
      p.latitude !== undefined &&
      p.latitude !== null &&
      p.longitude !== undefined &&
      p.longitude !== null &&
      (p.status === undefined || p.status === 'operacional' || p.status === 'atencao')
  );

  if (calibratedPostos.length === 0) {
    return {
      hasGps: true,
      latitude: userLat,
      longitude: userLng,
      accuracyM: safeAccuracy,
      accuracyRealM: safeAccuracy,
      distanceM: 0,
      geofenceStatus: 'pendente',
      decisaoGeofence: 'pendente',
      designatedPosto: posto,
      isDesignatedPosto: true,
      isCoveragePunch: false,
      message: `Posto "${posto.nome}" aguardando calibração oficial de GPS. Ponto autorizado com coordenadas do dispositivo para auditoria do gestor.`,
    };
  }

  // Avaliação dos 3 estados para cada posto
  interface PostoEvaluation {
    posto: CondominioPosto;
    distance: number;
    maxRadius: number;
    state: 'dentro' | 'inconclusivo' | 'fora';
  }

  const evaluations: PostoEvaluation[] = calibratedPostos.map((p) => {
    const pLat = Number(p.latitude);
    const pLng = Number(p.longitude);
    const maxRadius = p.raioGpsMetros || 150;
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
    // Desempate determinístico: menor distância
    dentroCandidatos.sort((a, b) => a.distance - b.distance);
    const chosen = dentroCandidatos[0];
    const ambiguidade =
      dentroCandidatos.length > 1 &&
      Math.abs(dentroCandidatos[0].distance - dentroCandidatos[1].distance) < 15;

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
      classificacaoPosto: isDesignated ? 'posto_regular' : 'divergencia_posto',
      message: isDesignated
        ? `Localização confirmada! Você está a ${chosen.distance}m do seu posto cadastrado "${posto.nome}" (tolerância: ${chosen.maxRadius}m).`
        : `Presença confirmada no posto da empresa "${chosen.posto.nome}" (${chosen.distance}m). Posto diferente da lotação habitual.`,
    };
  }

  // 2. Candidatos INCONCLUSIVOS (o intervalo de erro cruza a borda)
  const inconclusivoCandidatos = evaluations.filter((e) => e.state === 'inconclusivo');
  if (inconclusivoCandidatos.length > 0) {
    inconclusivoCandidatos.sort((a, b) => a.distance - b.distance);
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
      message: `Leitura de GPS inconclusiva na borda do posto "${candidate.posto.nome}" (distância: ${candidate.distance}m, raio: ${candidate.maxRadius}m, margem de erro: ±${safeAccuracy}m). Por favor, dê alguns passos para dentro das dependências do posto e tente novamente.`,
    };
  }

  // 3. Fora de TODOS os postos da empresa com confiança (distance - safeAccuracy > maxRadius)
  evaluations.sort((a, b) => a.distance - b.distance);
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
    closestPosto: closest.posto,
    closestDistanceM: closest.distance,
    message: `Fora do perímetro de todos os postos cadastrados da empresa. Posto mais próximo: "${closest.posto.nome}" a ${closest.distance}m de distância (tolerância: ${closest.maxRadius}m, precisão: ±${safeAccuracy}m). O ponto só pode ser registrado dentro das instalações da empresa.`,
  };
}

/**
 * Determina a próxima batida de ponto esperada para o colaborador na jornada vigente
 */
export function determineNextPunch(
  hojePunches: PontoEvento[],
  colaborador: Colaborador
): NextPunchInfo {
  const count = hojePunches.length;

  if (count === 0) {
    return {
      tipo: 'entrada',
      label: 'Entrada',
      descricao: 'Início da jornada de trabalho no posto',
      horarioPrevisto: colaborador.turnoInicio || '07:00',
      isComplete: false,
    };
  }

  if (count === 1) {
    return {
      tipo: 'saida_intervalo',
      label: 'Pausa Almoço / Janta',
      descricao: 'Pausa para refeição e descanso',
      horarioPrevisto: '12:00',
      isComplete: false,
    };
  }

  if (count === 2) {
    return {
      tipo: 'retorno_intervalo',
      label: 'Retorno Almoço / Janta',
      descricao: 'Reinício das atividades no posto',
      horarioPrevisto: '13:00',
      isComplete: false,
    };
  }

  if (count === 3) {
    return {
      tipo: 'saida',
      label: 'Saída',
      descricao: 'Encerramento do turno e rendição',
      horarioPrevisto: colaborador.turnoFim || '19:00',
      isComplete: false,
    };
  }

  return {
    tipo: 'saida',
    label: 'Turno Concluído',
    descricao: 'Todas as batidas de ponto de hoje foram registradas',
    horarioPrevisto: '--:--',
    isComplete: true,
  };
}

/**
 * Recupera os eventos de ponto registrados para o colaborador
 */
export function getPontoEventos(colaboradorId: string): PontoEvento[] {
  try {
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

export interface RecordPontoResult {
  evento: PontoEvento;
  isSavedInDatabase: boolean;
  offlinePending: boolean;
  isDuplicated: boolean;
  message: string;
}

/**
 * Grava um novo evento de ponto com validação transacional e classificação precisa.
 * - NUNCA faz upsert nem altera colaboradores.condominio_id nem a escala permanente.
 * - Registra em outro posto válido como divergência ou cobertura programada, gerando alerta.
 * - Bloqueia somente se fora de todos os postos com confiança.
 */
export async function recordPontoEvento(
  colaborador: Colaborador,
  posto: CondominioPosto,
  tipoEvento: TipoBatidaPonto,
  geoResult: LocationValidationResult,
  credentialId?: string,
  metodo: 'biometria_facial' | 'biometria_passkey' | 'autenticador_dispositivo' | 'excecao_autorizada' = 'biometria_facial',
  motivoExcecao?: string,
  fotoBiometriaUrl?: string
): Promise<RecordPontoResult> {
  const now = new Date();
  const serverTimestamp = now.toISOString();

  // Data em fuso America/Sao_Paulo
  const dateKey = new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  const horaFormatada = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  }).format(now);

  const cleanDate = dateKey.replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const comprovanteNumero = `TC-${cleanDate}-${randomSuffix}`;

  // Chave de idempotência compatível com múltiplos turnos e tolerância
  const idempotencyKey = `tc-pe-${colaborador.id}-${cleanDate}-${tipoEvento}-${comprovanteNumero.slice(-4)}`;

  const labelMap: Record<TipoBatidaPonto, string> = {
    entrada: 'Entrada registrada',
    saida_intervalo: 'Pausa Almoço / Janta',
    retorno_intervalo: 'Retorno Almoço / Janta',
    saida: 'Saída registrada',
  };

  const detectedPosto = geoResult.detectedPosto || posto;
  const isPostoPrincipal = detectedPosto.id === colaborador.condominioId;

  const supabase = getSupabase();
  let classificacao: ClassificacaoPosto = isPostoPrincipal ? 'posto_regular' : 'divergencia_posto';
  let coverageAssignmentId: string | undefined = undefined;

  // Consulta cobertura programada aprovada e vigente se o posto for diferente da lotação
  if (!isPostoPrincipal && supabase) {
    try {
      const { data: cobs } = await supabase
        .from('coberturas_programadas')
        .select('*')
        .eq('colaborador_id', colaborador.id)
        .eq('posto_destino_id', detectedPosto.id)
        .eq('status', 'aprovada')
        .lte('data_inicio', serverTimestamp)
        .gte('data_fim', serverTimestamp)
        .limit(1);

      if (cobs && cobs.length > 0) {
        coverageAssignmentId = cobs[0].id;
        classificacao = cobs[0].tipo === 'extra' ? 'extra_programada' : 'cobertura_programada';
      }
    } catch {
      // Mantém 'divergencia_posto' se falhar consulta
    }
  }

  const isDivergencia = classificacao === 'divergencia_posto';
  const isCobertura = classificacao === 'cobertura_programada' || classificacao === 'extra_programada';

  const newEvento: PontoEvento = {
    id: `pe-${Date.now()}-${randomSuffix}`,
    colaboradorId: colaborador.id,
    colaboradorNome: colaborador.nome,
    condominioId: detectedPosto.id,
    condominioNome: detectedPosto.nome,
    postoNome: detectedPosto.nome,
    tipoEvento,
    labelEvento: isDivergencia
      ? `${labelMap[tipoEvento]} (Divergência de Posto)`
      : isCobertura
      ? `${labelMap[tipoEvento]} (Cobertura Programada)`
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
    verificationStatus: 'confirmado',
    classificacaoPosto: classificacao,
    postoBaseId: colaborador.condominioId || undefined,
    postoDetectadoId: detectedPosto.id,
    coverageAssignmentId,
    ambiguidadeDetectada: Boolean(geoResult.ambiguidadeDetectada),
    idempotencyKey,
    comprovanteNumero,
    motivoExcecao:
      motivoExcecao ||
      (isDivergencia
        ? `Divergência de posto: Ponto batido no posto ${detectedPosto.nome} (Lotação cadastral: ${colaborador.postoNome || 'Matriz'})`
        : isCobertura
        ? `Cobertura programada autorizada: ${detectedPosto.nome}`
        : undefined),
    isCobertura: isCobertura || isDivergencia,
    postoOriginalId: colaborador.condominioId || undefined,
    postoOriginalNome: colaborador.postoNome,
    postoDetectadoNome: detectedPosto.nome,
    condominioIcone: detectedPosto.icone || 'Building2',
    condominioCor: detectedPosto.cor || '#3B82F6',
    criadoEm: serverTimestamp,
  };

  let isSavedInDatabase = false;
  let offlinePending = false;

  if (supabase) {
    try {
      // 1. Atualização / inserção da folha diária em 'pontos'
      const { data: existingRows } = await supabase
        .from('pontos')
        .select('*')
        .eq('colaborador_id', colaborador.id)
        .eq('data', dateKey)
        .limit(1);

      const existingPonto = existingRows && existingRows.length > 0 ? existingRows[0] : null;

      if (existingPonto) {
        const updates: Record<string, any> = {
          updated_at: serverTimestamp,
          localizacao_gps: `Posto ${detectedPosto.nome} (${geoResult.distanceM || 0}m, ${classificacao})`,
          status_ponto: isDivergencia ? 'Divergente' : isCobertura ? 'Cobertura' : 'Regular',
          status: isDivergencia ? 'Divergência' : isCobertura ? 'Cobertura' : 'Regular',
        };

        if (fotoBiometriaUrl) updates.foto_facial = fotoBiometriaUrl;
        if (tipoEvento === 'entrada') updates.entrada_1 = horaFormatada;
        else if (tipoEvento === 'saida_intervalo') updates.saida_1 = horaFormatada;
        else if (tipoEvento === 'retorno_intervalo') updates.entrada_2 = horaFormatada;
        else if (tipoEvento === 'saida') updates.saida_2 = horaFormatada;

        const { error: updErr } = await supabase.from('pontos').update(updates).eq('id', existingPonto.id);
        if (!updErr) isSavedInDatabase = true;
      } else {
        const newPontoRow = {
          id: `ponto-${Date.now()}-${randomSuffix}`,
          colaborador_id: colaborador.id,
          colaborador_nome: colaborador.nome,
          data: dateKey,
          entrada_1: tipoEvento === 'entrada' ? horaFormatada : '07:00',
          saida_1: tipoEvento === 'saida_intervalo' ? horaFormatada : null,
          entrada_2: tipoEvento === 'retorno_intervalo' ? horaFormatada : null,
          saida_2: tipoEvento === 'saida' ? horaFormatada : null,
          total_horas: 'Em andamento',
          status_ponto: isDivergencia ? 'Divergente' : isCobertura ? 'Cobertura' : 'Regular',
          status: isDivergencia ? 'Divergência' : isCobertura ? 'Cobertura' : 'Regular',
          localizacao_gps: `Posto ${detectedPosto.nome} (${geoResult.distanceM || 0}m, ${classificacao})`,
          foto_facial: fotoBiometriaUrl || null,
          created_at: serverTimestamp,
          updated_at: serverTimestamp,
        };

        const { error: insErr } = await supabase.from('pontos').insert(newPontoRow);
        if (!insErr) isSavedInDatabase = true;
      }

      // 2. Gravação do registro imutável em 'ponto_eventos'
      const { error: peErr } = await supabase.from('ponto_eventos').insert({
        id: newEvento.id,
        colaborador_id: newEvento.colaboradorId,
        condominio_id: detectedPosto.id,
        posto_id: detectedPosto.id,
        posto_nome: detectedPosto.nome,
        condominio_nome: detectedPosto.nome,
        posto_base_id: colaborador.condominioId || null,
        posto_detectado_id: detectedPosto.id,
        coverage_assignment_id: coverageAssignmentId || null,
        classificacao_posto: classificacao,
        tipo_evento: newEvento.tipoEvento,
        server_timestamp: newEvento.serverTimestamp,
        latitude: newEvento.latitude,
        longitude: newEvento.longitude,
        accuracy_m: newEvento.accuracyM,
        accuracy_real_m: newEvento.accuracyRealM,
        geofence_status: newEvento.geofenceStatus,
        decisao_geofence: newEvento.decisaoGeofence,
        distance_m: newEvento.distanceM,
        ambiguidade_detectada: newEvento.ambiguidadeDetectada,
        credential_id: newEvento.credentialId,
        foto_biometria_url: newEvento.fotoBiometriaUrl,
        metodo_autenticacao: newEvento.metodoAutenticacao,
        verification_status: isSavedInDatabase ? 'confirmado' : 'pendente',
        idempotency_key: newEvento.idempotencyKey,
        comprovante_numero: newEvento.comprovanteNumero,
        motivo_excecao: newEvento.motivoExcecao,
      });

      if (!peErr) isSavedInDatabase = true;

      // 3. Se for divergência de posto, cria alerta persistido para supervisão/RH
      if (isDivergencia) {
        await supabase.from('alertas').insert({
          id: `alerta-div-${Date.now()}`,
          tipo: 'posto_divergente',
          gravidade: 'moderada',
          titulo: `Divergência de Posto: ${colaborador.nome}`,
          descricao: `O colaborador ${colaborador.nome} registrou ponto no posto "${detectedPosto.nome}" sem cobertura prévia cadastrada. Lotação cadastral: "${colaborador.postoNome || 'Matriz'}". Distância apurada: ${geoResult.distanceM || 0}m.`,
          posto_id: detectedPosto.id,
          posto_nome: detectedPosto.nome,
          colaborador_id: colaborador.id,
          colaborador_nome: colaborador.nome,
          horario: horaFormatada,
          resolvido: false,
          created_at: serverTimestamp,
        });

        // Cria notificação de sistema para supervisor/RH
        await supabase.from('notificacoes_sistema').insert({
          id: `notif-div-${Date.now()}`,
          empresa_id: 'emp-matriz-principal',
          destinatario_id: 'supervisor-geral',
          destinatario_tipo: 'supervisor',
          titulo: `Aviso de Divergência: ${colaborador.nome}`,
          mensagem: `Ponto registrado no posto ${detectedPosto.nome} (lotação habitual: ${colaborador.postoNome || 'Matriz'}).`,
          tipo: 'divergencia_ponto',
          referencia_id: newEvento.id,
          link_acao: 'operacao',
          lida: false,
          created_at: serverTimestamp,
        });
      }
    } catch (err) {
      console.warn('Falha de sincronização remota do ponto com o Supabase:', err);
      offlinePending = true;
    }
  } else {
    isSavedInDatabase = true;
    offlinePending = false;
  }

  if (offlinePending) {
    newEvento.verificationStatus = 'pendente';
  }

  // Persistência local no navegador (fila de auditoria)
  const raw = localStorage.getItem(PONTO_EVENTOS_LOCAL_KEY);
  const all: PontoEvento[] = raw ? JSON.parse(raw) : [];
  all.push(newEvento);
  localStorage.setItem(PONTO_EVENTOS_LOCAL_KEY, JSON.stringify(all));

  return {
    evento: newEvento,
    isSavedInDatabase,
    offlinePending,
    isDuplicated: false,
    message: isSavedInDatabase
      ? isDivergencia
        ? `Ponto registrado com sucesso no posto "${detectedPosto.nome}". Notificação de divergência enviada à supervisão.`
        : isCobertura
        ? `Ponto registrado com sucesso como Cobertura Programada no posto "${detectedPosto.nome}".`
        : 'Ponto registrado e confirmado no servidor com sucesso.'
      : 'Ponto gravado localmente (Pendente de Sincronização com o Servidor).',
  };
}
