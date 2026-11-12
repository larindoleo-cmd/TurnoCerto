import {
  validateGeofence,
  determineNextPunch,
  resolvePunchClassification,
  buildIdempotencyKey,
} from '../pontoService';
import {
  Colaborador,
  CondominioPosto,
  CoberturaProgramada,
  PontoEvento,
} from '../../types';

export interface TestResultItem {
  testName: string;
  passed: boolean;
  details: string;
}

function makePosto(overrides: Partial<CondominioPosto>): CondominioPosto {
  return {
    id: 'posto-a',
    nome: 'Posto A',
    tipo: 'Residencial',
    cnpj: '',
    contratoNumero: '',
    endereco: 'Rua A',
    bairro: 'Centro',
    cidade: 'São Paulo',
    supervisor: '',
    telefoneSupervisor: '',
    vagasContratadas: 2,
    status: 'operacional',
    ativo: true,
    tipoEscalaPadrao: '12x36',
    plantaoAtual: { operandoAgora: [], proximaRendicao: { colaboradorId: '', horarioTroca: '19:00' } },
    coberturaPercentual: 100,
    contatoSindico: '',
    telefoneSindico: '',
    instrucoesGuarita: '',
    raioGpsMetros: 100,
    ...overrides,
  };
}

function makeColab(overrides: Partial<Colaborador> = {}): Colaborador {
  return {
    id: 'colab-1',
    nome: 'Carlos Teste',
    matricula: '001',
    funcao: 'Porteiro',
    condominioId: 'posto-a',
    postoNome: 'Posto A',
    status: 'no_posto',
    jornada: '12x36 (19:00 - 07:00)',
    tipoEscala: '12x36',
    turno: 'noturno',
    turnoInicio: '19:00',
    turnoFim: '07:00',
    foto: '',
    telefone: '',
    cpf: '',
    dataAdmissao: '2026-01-01',
    bancoHoras: 0,
    salarioBase: 2500,
    ...overrides,
  };
}

export async function runGpsPontoTests(): Promise<{
  passed: number;
  failed: number;
  results: TestResultItem[];
}> {
  const results: TestResultItem[] = [];
  const assert = (cond: boolean, testName: string, details: string) => {
    results.push({ testName, passed: cond, details: cond ? `PASSOU: ${details}` : `FALHOU: ${details}` });
  };

  const postoA = makePosto({ id: 'posto-a', nome: 'Posto A', latitude: -23.5, longitude: -46.6, raioGpsMetros: 100 });
  const postoB = makePosto({ id: 'posto-b', nome: 'Posto B', latitude: -23.52, longitude: -46.62, raioGpsMetros: 100 });
  const postoSemCoords = makePosto({ id: 'posto-c', nome: 'Posto C Sem Coords', latitude: undefined, longitude: undefined });

  // 1. Dentro com confiança (distance + accuracy <= raio)
  const rDentro = validateGeofence(-23.5002, -46.6, 15, postoA, [postoA, postoB], 80);
  assert(
    rDentro.geofenceStatus === 'dentro_do_raio' && rDentro.detectedPosto?.id === 'posto-a',
    'GPS 3-Estados: Dentro com confiança',
    `Status=${rDentro.geofenceStatus}, dist=${rDentro.distanceM}m`
  );

  // 2. Inconclusivo quando intervalo cruza o raio (dist ~89m, acc 25m -> 89+25=114 > 100 e 89-25=64 <= 100)
  const rInc = validateGeofence(-23.5008, -46.6, 25, postoA, [postoA], 80);
  assert(
    rInc.geofenceStatus === 'inconclusivo',
    'GPS 3-Estados: Inconclusivo na borda do raio',
    `Status=${rInc.geofenceStatus}, dist=${rInc.distanceM}m, acc=${rInc.accuracyM}m`
  );

  // 3. Limite configurável de accuracy por empresa
  const rAccRuim = validateGeofence(-23.5, -46.6, 95, postoA, [postoA], 80);
  const rAccAceita = validateGeofence(-23.5, -46.6, 95, postoA, [postoA], 120);
  assert(
    rAccRuim.geofenceStatus === 'inconclusivo' && rAccAceita.geofenceStatus === 'dentro_do_raio',
    'GPS Accuracy Configurável por Empresa',
    `Com max 80m: ${rAccRuim.geofenceStatus}; com max 120m: ${rAccAceita.geofenceStatus}`
  );

  // 4. Multi-posto: colaborador lotado no Posto A bate ponto no Posto B válido
  const rOutroPosto = validateGeofence(-23.52, -46.62, 10, postoA, [postoA, postoB], 80);
  assert(
    rOutroPosto.geofenceStatus === 'dentro_do_raio' &&
      rOutroPosto.detectedPosto?.id === 'posto-b' &&
      rOutroPosto.isDesignatedPosto === false,
    'Multi-Posto: Reconhece outro posto ativo da mesma empresa',
    `Detectado=${rOutroPosto.detectedPosto?.id}, designated=${rOutroPosto.isDesignatedPosto}`
  );

  // 5. Posto sem coordenadas nunca prova que colaborador está fora
  const rSemCoords = validateGeofence(-23.59, -46.69, 10, postoSemCoords, [postoA, postoSemCoords], 80);
  assert(
    rSemCoords.geofenceStatus === 'inconclusivo' && (rSemCoords.uncalibratedPostos?.length || 0) === 1,
    'Posto sem coordenadas gera alerta e não prova ausência',
    `Status=${rSemCoords.geofenceStatus}, uncalibrated=${rSemCoords.uncalibratedPostos?.length}`
  );

  // 6. Sobreposição determinística: menor distância vence e sinaliza ambiguidade
  const postoBPerto = makePosto({ id: 'posto-b-perto', nome: 'Posto B Perto', latitude: -23.5003, longitude: -46.6, raioGpsMetros: 150 });
  const rOverlap = validateGeofence(-23.50005, -46.6, 5, postoA, [postoBPerto, postoA], 80);
  assert(
    rOverlap.detectedPosto?.id === 'posto-a' && rOverlap.ambiguidadeDetectada === true,
    'Sobreposição de Geofences: Desempate determinístico e flag de ambiguidade',
    `Vencedor=${rOverlap.detectedPosto?.id}, ambiguidade=${rOverlap.ambiguidadeDetectada}`
  );

  // 7. Fora com confiança de TODOS os postos calibrados da empresa
  const rForaTodos = validateGeofence(-23.65, -46.75, 10, postoA, [postoA, postoB], 80);
  assert(
    rForaTodos.geofenceStatus === 'fora_do_raio' && rForaTodos.closestPosto !== undefined,
    'GPS 3-Estados: Fora com confiança de todos os postos ativos',
    `Status=${rForaTodos.geofenceStatus}, maisProximo=${rForaTodos.closestPosto?.nome}`
  );

  // 8. Turno Noturno (entrada ontem 19:00, consulta hoje 06:30)
  const colab = makeColab();
  const entradaNoturna: PontoEvento = {
    id: 'ev-1',
    colaboradorId: 'colab-1',
    colaboradorNome: 'Carlos Teste',
    condominioId: 'posto-a',
    condominioNome: 'Posto A',
    postoNome: 'Posto A',
    tipoEvento: 'entrada',
    labelEvento: 'Entrada',
    serverTimestamp: '2026-11-12T22:00:00.000Z', // 19:00 BRT
    geofenceStatus: 'dentro_do_raio',
    metodoAutenticacao: 'biometria_facial',
    verificationStatus: 'confirmado',
    idempotencyKey: 'k1',
    comprovanteNumero: 'TC-1',
    criadoEm: '2026-11-12T22:00:00.000Z',
  };
  const nextNight = determineNextPunch([entradaNoturna], colab, new Date('2026-11-13T09:30:00.000Z')); // 06:30 BRT
  assert(
    nextNight.tipo === 'saida_intervalo' && nextNight.isOvernightOpen === true,
    'Turno Noturno (virada de meia-noite): Mantém jornada aberta',
    `Próxima=${nextNight.tipo}, overnight=${nextNight.isOvernightOpen}`
  );

  // 9. Múltiplos turnos após saída concluída
  const saidaNoturna: PontoEvento = {
    ...entradaNoturna,
    id: 'ev-2',
    tipoEvento: 'saida',
    labelEvento: 'Saída',
    serverTimestamp: '2026-11-13T10:00:00.000Z',
  };
  const nextDobra = determineNextPunch([entradaNoturna, saidaNoturna], colab, new Date('2026-11-13T14:00:00.000Z'));
  assert(
    nextDobra.tipo === 'entrada' && nextDobra.shiftIndex === 2,
    'Múltiplos turnos/dobra no mesmo ciclo',
    `Próxima=${nextDobra.tipo}, shiftIndex=${nextDobra.shiftIndex}`
  );

  // 10. Classificação Regular vs Cobertura/Extra vs Divergência
  const todayBr = new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const covExtra: CoberturaProgramada = {
    id: 'cov-1',
    empresaId: 'emp-1',
    colaboradorId: 'colab-1',
    postoCoberturaId: 'posto-b',
    tipo: 'extra',
    dataInicio: todayBr,
    dataFim: todayBr,
    horaInicio: '07:00',
    horaFim: '19:00',
    status: 'aprovada',
    criadoEm: new Date().toISOString(),
  };

  const clsReg = resolvePunchClassification('posto-a', 'posto-a', [covExtra]);
  const clsExt = resolvePunchClassification('posto-a', 'posto-b', [covExtra]);
  const clsDiv = resolvePunchClassification('posto-a', 'posto-c', [covExtra]);
  assert(
    clsReg.classificacao === 'posto_regular' &&
      clsExt.classificacao === 'extra_programada' &&
      clsDiv.classificacao === 'divergencia_posto',
    'Classificação de Batida (Regular / Extra Programada / Divergência)',
    `reg=${clsReg.classificacao}, extra=${clsExt.classificacao}, div=${clsDiv.classificacao}`
  );

  // 11. Idempotência determinística por tentativa
  const key1 = buildIdempotencyKey('colab-1', 'entrada', 'att-123');
  const key2 = buildIdempotencyKey('colab-1', 'entrada', 'att-123');
  const key3 = buildIdempotencyKey('colab-1', 'entrada', 'att-456');
  assert(
    key1 === key2 && key1 !== key3,
    'Chave de Idempotência Determinística por Tentativa',
    `${key1} === ${key2} !== ${key3}`
  );

  return {
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    results,
  };
}
