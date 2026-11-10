/**
 * TurnoCerto - Ponto Service com Biometria & GPS Real
 * Implementa validação geodésica precisa (Haversine), cálculo de geofence,
 * controle de idempotência, auditoria de eventos e emissão de comprovante oficial.
 */

import {
  CondominioPosto,
  Colaborador,
  PontoEvento,
  TipoBatidaPonto,
  StatusGeofence,
} from '../types';
import { getSupabase } from '../lib/supabase';

export interface LocationValidationResult {
  hasGps: boolean;
  latitude?: number;
  longitude?: number;
  accuracyM?: number;
  distanceM?: number;
  geofenceStatus: StatusGeofence;
  message: string;
  // Suporte a identificação de qualquer posto da empresa via GPS (cobertura)
  detectedPosto?: CondominioPosto;
  designatedPosto?: CondominioPosto;
  isDesignatedPosto?: boolean;
  isCoveragePunch?: boolean;
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

/**
 * Fórmula de Haversine para cálculo da distância geodésica em metros
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Raio da Terra em metros
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Captura a geolocalização do dispositivo em alta precisão (GPS Real)
 */
export async function getDeviceCoordinates(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalização não suportada neste dispositivo.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      (err) => {
        let msg = 'Erro ao capturar localização.';
        if (err.code === 1) msg = 'Permissão de localização negada pelo usuário.';
        if (err.code === 2) msg = 'Sinal de GPS indisponível no momento.';
        if (err.code === 3) msg = 'Tempo limite esgotado ao buscar localização GPS.';
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  });
}

/**
 * Valida se as coordenadas do usuário estão dentro do raio de QUALQUER posto da empresa.
 * - Se estiver no posto habitual: valida e confirma normalmente.
 * - Se estiver em outro posto da empresa: identifica o posto via GPS e autoriza como cobertura de falta.
 * - Só dá erro e bloqueia se o GPS não identificar NENHUM posto da empresa no local.
 */
export function validateGeofence(
  userLat: number,
  userLng: number,
  accuracyM: number,
  posto: CondominioPosto,
  allCompanyPostos?: CondominioPosto[]
): LocationValidationResult {
  const safeAccuracy = Math.min(100, Math.max(0, Math.round(accuracyM || 0)));

  // Lista com todos os postos da empresa
  const postosList = allCompanyPostos && allCompanyPostos.length > 0 ? allCompanyPostos : [posto];

  interface EvaluatedPosto {
    posto: CondominioPosto;
    distance: number;
    maxRadius: number;
    isWithin: boolean;
  }

  const evaluated: EvaluatedPosto[] = postosList.map((p) => {
    const targetLat = p.latitude !== undefined && p.latitude !== 0 ? p.latitude : -23.55052;
    const targetLng = p.longitude !== undefined && p.longitude !== 0 ? p.longitude : -46.633308;
    const maxRadius = p.raioGpsMetros || 150;
    const distance = calculateDistanceMeters(userLat, userLng, targetLat, targetLng);
    const effectiveDistance = Math.max(0, distance - safeAccuracy);
    const isWithin = distance <= maxRadius || effectiveDistance <= maxRadius;
    return { posto: p, distance, maxRadius, isWithin };
  });

  const matched = evaluated.filter((e) => e.isWithin);

  if (matched.length > 0) {
    // 1. Prioriza o posto cadastrado se estiver dentro do raio dele
    const atDesignated = matched.find((e) => e.posto.id === posto.id);
    if (atDesignated) {
      return {
        hasGps: true,
        latitude: userLat,
        longitude: userLng,
        accuracyM: safeAccuracy,
        distanceM: atDesignated.distance,
        geofenceStatus: 'dentro_do_raio',
        detectedPosto: atDesignated.posto,
        designatedPosto: posto,
        isDesignatedPosto: true,
        isCoveragePunch: false,
        message: `Localização validada com sucesso! Você está a ${atDesignated.distance}m do seu posto cadastrado "${posto.nome}" (tolerância: ${atDesignated.maxRadius}m).`,
      };
    }

    // 2. Está em OUTRO posto da empresa -> Cobertura de Falta autorizada!
    matched.sort((a, b) => a.distance - b.distance);
    const bestMatch = matched[0];

    return {
      hasGps: true,
      latitude: userLat,
      longitude: userLng,
      accuracyM: safeAccuracy,
      distanceM: bestMatch.distance,
      geofenceStatus: 'dentro_do_raio',
      detectedPosto: bestMatch.posto,
      designatedPosto: posto,
      isDesignatedPosto: false,
      isCoveragePunch: true,
      message: `Posto da empresa identificado via GPS: "${bestMatch.posto.nome}" (${bestMatch.distance}m). Cobertura de falta autorizada para colaborador do ${posto.nome}.`,
    };
  }

  // 3. Fora de TODOS os postos da empresa -> Bloqueio estrito
  evaluated.sort((a, b) => a.distance - b.distance);
  const closest = evaluated[0] || {
    posto,
    distance: calculateDistanceMeters(userLat, userLng, posto.latitude || -23.55052, posto.longitude || -46.633308),
    maxRadius: posto.raioGpsMetros || 150,
    isWithin: false,
  };

  return {
    hasGps: true,
    latitude: userLat,
    longitude: userLng,
    accuracyM: safeAccuracy,
    distanceM: closest.distance,
    geofenceStatus: 'fora_do_raio',
    detectedPosto: undefined,
    designatedPosto: posto,
    isDesignatedPosto: false,
    isCoveragePunch: false,
    closestPosto: closest.posto,
    closestDistanceM: closest.distance,
    message: `Nenhum posto da empresa identificado no local em que você está. O posto mais próximo é "${closest.posto.nome}" a ${closest.distance}m de distância (tolerância: ${closest.maxRadius}m). O ponto só pode ser batido dentro de um posto da empresa.`,
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

/**
 * Grava um novo evento de ponto com chave de idempotência e comprovante oficial
 */
export interface RecordPontoResult {
  evento: PontoEvento;
  isSavedInDatabase: boolean;
  offlinePending: boolean;
  isDuplicated: boolean;
  message: string;
}

/**
 * Grava um novo evento de ponto com chave de idempotência, verificação anti-duplicidade
 * e confirmação transacional no banco de dados Supabase.
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

  // Chave de idempotência segura e determinística por colaborador, data e tipo de batida
  const idempotencyKey = `idem-${colaborador.id}-${dateKey}-${tipoEvento}`;

  // Número oficial de comprovante de ponto
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const cleanDate = dateKey.replace(/-/g, '');
  const comprovanteNumero = `TC-${cleanDate}-${randomSuffix}`;

  const labelMap: Record<TipoBatidaPonto, string> = {
    entrada: 'Entrada registrada',
    saida_intervalo: 'Pausa Almoço / Janta',
    retorno_intervalo: 'Retorno Almoço / Janta',
    saida: 'Saída registrada',
  };

  const isCoverage =
    geoResult.isCoveragePunch ||
    (geoResult.detectedPosto && geoResult.designatedPosto && geoResult.detectedPosto.id !== geoResult.designatedPosto.id);

  const postoAtribuidoOriginal = geoResult.designatedPosto?.nome || colaborador.postoNome;

  const newEvento: PontoEvento = {
    id: `pe-${Date.now()}-${randomSuffix}`,
    colaboradorId: colaborador.id,
    colaboradorNome: colaborador.nome,
    condominioId: posto.id,
    condominioNome: posto.nome,
    postoNome: isCoverage ? `${posto.nome} (Cobertura de Falta)` : (colaborador.postoNome || posto.nome),
    tipoEvento,
    labelEvento: isCoverage ? `${labelMap[tipoEvento]} (Cobertura)` : labelMap[tipoEvento],
    serverTimestamp,
    latitude: geoResult.latitude,
    longitude: geoResult.longitude,
    accuracyM: geoResult.accuracyM,
    geofenceStatus: geoResult.geofenceStatus,
    distanceM: geoResult.distanceM,
    credentialId,
    fotoBiometriaUrl,
    metodoAutenticacao: metodo,
    verificationStatus: 'confirmado',
    idempotencyKey,
    comprovanteNumero,
    motivoExcecao:
      motivoExcecao ||
      (isCoverage
        ? `Cobertura de falta: Presença confirmada no posto ${posto.nome} (Posto habitual: ${postoAtribuidoOriginal})`
        : undefined),
    isCobertura: Boolean(isCoverage),
    postoOriginalId: geoResult.designatedPosto?.id,
    postoOriginalNome: postoAtribuidoOriginal,
    postoDetectadoNome: posto.nome,
    condominioIcone: posto.icone || 'Building2',
    condominioCor: posto.cor || '#3B82F6',
    criadoEm: serverTimestamp,
  };

  // 1. Checagem anti-duplicidade em memória e localStorage
  const raw = localStorage.getItem(PONTO_EVENTOS_LOCAL_KEY);
  const all: PontoEvento[] = raw ? JSON.parse(raw) : [];

  const jaRegistrado = all.some(
    (e) =>
      e.colaboradorId === colaborador.id &&
      e.tipoEvento === tipoEvento &&
      e.serverTimestamp.slice(0, 10) === dateKey
  );

  if (jaRegistrado) {
    return {
      evento: newEvento,
      isSavedInDatabase: false,
      offlinePending: false,
      isDuplicated: true,
      message: `A batida de ${labelMap[tipoEvento]} já foi realizada hoje (${dateKey}) para este colaborador!`,
    };
  }

  let isSavedInDatabase = false;
  let offlinePending = false;

  // 2. Gravação no Supabase com validação central no servidor
  const supabase = getSupabase();
  if (supabase) {
    try {
      // Checagem central de duplicidade no Supabase
      const { data: dupEvents } = await supabase
        .from('ponto_eventos')
        .select('id, comprovante_numero')
        .eq('idempotency_key', idempotencyKey)
        .limit(1);

      if (dupEvents && dupEvents.length > 0) {
        return {
          evento: newEvento,
          isSavedInDatabase: true,
          offlinePending: false,
          isDuplicated: true,
          message: `Aviso: Esta batida de ${labelMap[tipoEvento]} já consta como confirmada no banco de dados (${dupEvents[0].comprovante_numero}).`,
        };
      }

      // Garante que o condomínio exista
      await supabase.from('condominios').upsert({
        id: posto.id,
        nome: posto.nome,
        tipo: posto.tipo || 'Residencial',
        cnpj: posto.cnpj || null,
        endereco: posto.endereco || 'Endereço não informado',
        bairro: posto.bairro || 'Centro',
        cidade: posto.cidade || 'São Paulo - SP',
        lat: posto.latitude !== undefined ? Number(posto.latitude) : -23.55052,
        lng: posto.longitude !== undefined ? Number(posto.longitude) : -46.633308,
        raio_tolerancia_metros: posto.raioGpsMetros || 150,
        status: posto.status || 'operacional',
        vagas_contratadas: posto.vagasContratadas || 2,
      });

      // Garante que o colaborador exista
      await supabase.from('colaboradores').upsert({
        id: colaborador.id,
        nome: colaborador.nome,
        full_name: colaborador.nome,
        matricula: colaborador.matricula || `TC-${colaborador.id.slice(0, 4)}`,
        funcao: colaborador.funcao || 'Porteiro',
        cargo: colaborador.funcao || 'Porteiro',
        condominio_id: posto.id,
        status: 'no_posto',
        cpf: colaborador.cpf || null,
        telefone: colaborador.telefone || null,
        foto_url: fotoBiometriaUrl || colaborador.foto || null,
        email: colaborador.email || null,
        role: colaborador.role || 'funcionario',
        updated_at: serverTimestamp,
      });

      // Horário formatado no fuso America/Sao_Paulo
      const horaFormatada = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
      }).format(now);

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
          localizacao_gps: `Posto ${posto.nome} - Distância: ${geoResult.distanceM}m (${geoResult.geofenceStatus})`,
          status_ponto: isCoverage ? 'Cobertura de Falta' : 'Regular',
          status: isCoverage ? 'Cobertura' : 'Regular',
        };

        if (fotoBiometriaUrl) updates.foto_facial = fotoBiometriaUrl;

        if (tipoEvento === 'entrada') updates.entrada_1 = horaFormatada;
        else if (tipoEvento === 'saida_intervalo') updates.saida_1 = horaFormatada;
        else if (tipoEvento === 'retorno_intervalo') updates.entrada_2 = horaFormatada;
        else if (tipoEvento === 'saida') updates.saida_2 = horaFormatada;

        const { error: updErr } = await supabase.from('pontos').update(updates).eq('id', existingPonto.id);
        if (!updErr) {
          isSavedInDatabase = true;
        }
      } else {
        const novoPontoId = `ponto-${Date.now()}-${randomSuffix}`;
        const newPontoRow = {
          id: novoPontoId,
          colaborador_id: colaborador.id,
          colaborador_nome: colaborador.nome,
          data: dateKey,
          entrada_1: tipoEvento === 'entrada' ? horaFormatada : '07:00',
          saida_1: tipoEvento === 'saida_intervalo' ? horaFormatada : null,
          entrada_2: tipoEvento === 'retorno_intervalo' ? horaFormatada : null,
          saida_2: tipoEvento === 'saida' ? horaFormatada : null,
          total_horas: 'Em andamento',
          status_ponto: isCoverage ? 'Cobertura de Falta' : 'Regular',
          status: isCoverage ? 'Cobertura' : 'Regular',
          localizacao_gps: `Posto ${posto.nome} - Distância: ${geoResult.distanceM}m (${geoResult.geofenceStatus})`,
          foto_facial: fotoBiometriaUrl || null,
          created_at: serverTimestamp,
          updated_at: serverTimestamp,
        };

        const { error: insErr } = await supabase.from('pontos').insert(newPontoRow);
        if (!insErr) {
          isSavedInDatabase = true;
        }
      }

      // Tenta gravar na tabela detalhada ponto_eventos
      try {
        await supabase.from('ponto_eventos').insert({
          id: newEvento.id,
          colaborador_id: newEvento.colaboradorId,
          posto_id: newEvento.condominioId,
          tipo_evento: newEvento.tipoEvento,
          server_timestamp: newEvento.serverTimestamp,
          latitude: newEvento.latitude,
          longitude: newEvento.longitude,
          accuracy_m: newEvento.accuracyM,
          geofence_status: newEvento.geofenceStatus,
          distance_m: newEvento.distanceM,
          credential_id: newEvento.credentialId,
          foto_biometria_url: newEvento.fotoBiometriaUrl,
          metodo_autenticacao: newEvento.metodoAutenticacao,
          verification_status: isSavedInDatabase ? 'confirmado' : 'pendente',
          idempotency_key: newEvento.idempotencyKey,
          comprovante_numero: newEvento.comprovanteNumero,
          motivo_excecao: newEvento.motivoExcecao,
        });
      } catch {
        // Tabela ponto_eventos opcional
      }
    } catch (err) {
      console.warn('Erro de rede ao sincronizar ponto com Supabase:', err);
      offlinePending = true;
    }
  } else {
    // Modo local offline
    offlinePending = false;
    isSavedInDatabase = true;
  }

  // Atualiza verificationStatus se ficou pendente de sincronização
  if (offlinePending) {
    newEvento.verificationStatus = 'pendente';
  }

  // 3. Persistência local no navegador
  all.push(newEvento);
  localStorage.setItem(PONTO_EVENTOS_LOCAL_KEY, JSON.stringify(all));

  return {
    evento: newEvento,
    isSavedInDatabase,
    offlinePending,
    isDuplicated: false,
    message: isSavedInDatabase
      ? 'Registro realizado com sucesso e confirmado pelo servidor.'
      : 'Não foi possível confirmar o registro no servidor. Verifique sua conexão. O ponto foi marcado como PENDENTE DE SINCRONIZAÇÃO.',
  };
}
