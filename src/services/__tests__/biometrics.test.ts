/**
 * Testes Unitários e de Validação do Motor Biométrico TurnoCerto
 * Arquivo: src/services/__tests__/biometrics.test.ts
 */

import {
  calculateEuclideanDistance,
  normalizeVectorL2,
  calculateCosineSimilarity,
  verifyFace1x1,
  BIOMETRIC_MODEL_INFO,
} from '../faceDetectionEngine';
import {
  computeSHA256,
  generateSecureToken,
} from '../biometricPersistenceService';
import {
  calculateDistanceMeters,
  validateGeofence,
  determineNextPunch,
} from '../pontoService';
import { Colaborador, CondominioPosto, PontoEvento } from '../../types';

export async function runBiometricValidationTests(): Promise<{
  passed: number;
  failed: number;
  results: { testName: string; passed: boolean; details: string }[];
}> {
  const results: { testName: string; passed: boolean; details: string }[] = [];

  function assert(condition: boolean, testName: string, details: string) {
    results.push({
      testName,
      passed: condition,
      details: condition ? `PASSOU: ${details}` : `FALHOU: ${details}`,
    });
  }

  // TESTE 1: Normalização L2 Unitária
  try {
    const rawVec = [3, 4, 0, 0, 0];
    const normVec = normalizeVectorL2(rawVec);
    const sumSq = normVec.reduce((acc, v) => acc + v * v, 0);
    assert(
      Math.abs(sumSq - 1.0) < 0.001,
      'Normalização Unitária L2',
      `Norma calculada = ${sumSq.toFixed(4)} (esperado: 1.0)`
    );
  } catch (err: any) {
    assert(false, 'Normalização Unitária L2', err.message);
  }

  // TESTE 2: Distância Euclidiana entre Vetores Idênticos
  try {
    const vecA = new Array(128).fill(0.088388); // 128 * 0.088388^2 ≈ 1.0
    const distIdentico = calculateEuclideanDistance(vecA, vecA);
    assert(
      distIdentico === 0,
      'Distância Euclidiana Vetores Idênticos',
      `Distância = ${distIdentico} (esperado: 0.0)`
    );
  } catch (err: any) {
    assert(false, 'Distância Euclidiana Vetores Idênticos', err.message);
  }

  // TESTE 3: Verificação 1:1 de Mesma Identidade (Match Positivo)
  try {
    const template = normalizeVectorL2(new Array(128).fill(1));
    // Simula pequena variação natural (iluminação / micro-expressão)
    const sample = normalizeVectorL2(
      template.map((v, i) => (i % 2 === 0 ? v + 0.005 : v - 0.005))
    );
    const matchRes = verifyFace1x1(sample, template, 0.50);
    assert(
      matchRes.isMatch === true && matchRes.distance <= 0.35,
      'Verificação 1:1 - Mesma Pessoa',
      `Match: ${matchRes.isMatch}, Distância: ${matchRes.distance}, Similaridade: ${matchRes.similarityPercent}%`
    );
  } catch (err: any) {
    assert(false, 'Verificação 1:1 - Mesma Pessoa', err.message);
  }

  // TESTE 4: Verificação 1:1 de Pessoas Diferentes (Rejeição de Divergência)
  try {
    const templatePessoaA = normalizeVectorL2(new Array(128).fill(1).map((_, i) => (i < 64 ? 1 : 0)));
    const samplePessoaB = normalizeVectorL2(new Array(128).fill(1).map((_, i) => (i >= 64 ? 1 : 0)));
    const matchRes = verifyFace1x1(samplePessoaB, templatePessoaA, 0.50);
    assert(
      matchRes.isMatch === false && matchRes.distance >= 0.8,
      'Verificação 1:1 - Pessoas Diferentes (Rejeição Anti-Fraude)',
      `Match: ${matchRes.isMatch} (esperado: false), Distância: ${matchRes.distance}`
    );
  } catch (err: any) {
    assert(false, 'Verificação 1:1 - Pessoas Diferentes', err.message);
  }

  // TESTE 5: Geração de Token Criptográfico Seguro
  try {
    const token1 = generateSecureToken();
    const token2 = generateSecureToken();
    assert(
      token1.length >= 32 && token1 !== token2,
      'Token Criptográfico de Uso Único',
      `Tokens gerados com entropia suficiente: ${token1.slice(0, 8)}... vs ${token2.slice(0, 8)}...`
    );
  } catch (err: any) {
    assert(false, 'Token Criptográfico de Uso Único', err.message);
  }

  // TESTE 6: Hash Criptográfico SHA-256
  try {
    const hash = await computeSHA256('TurnoCerto-Token-Teste');
    assert(
      hash.length === 64,
      'Hash Criptográfico SHA-256 de Token',
      `Hash 256 bits gerado com sucesso: ${hash.slice(0, 16)}... (tamanho: ${hash.length})`
    );
  } catch (err: any) {
    assert(false, 'Hash Criptográfico SHA-256 de Token', err.message);
  }

  // TESTE 7: Distância Geodésica Haversine e Geofence
  try {
    const lat1 = -23.55052;
    const lon1 = -46.633308;
    const lat2 = -23.55060;
    const lon2 = -46.633320;
    const distMetros = calculateDistanceMeters(lat1, lon1, lat2, lon2);
    assert(
      distMetros >= 0 && distMetros <= 20,
      'Cálculo Geodésico Haversine Real',
      `Distância calculada: ${distMetros}m entre coordenadas no mesmo quarteirão`
    );
  } catch (err: any) {
    assert(false, 'Cálculo Geodésico Haversine Real', err.message);
  }

  // TESTE 8: Validação de Geofence sem substituição de coordenadas
  try {
    const postoTeste = {
      id: 'posto-1',
      nome: 'Condomínio Central',
      tipo: 'Residencial',
      latitude: -23.55052,
      longitude: -46.633308,
      raioGpsMetros: 100,
      status: 'operacional',
      vagasContratadas: 2,
    } as unknown as CondominioPosto;
    // Usuário dentro do raio (a 20m)
    const valDentro = validateGeofence(-23.55060, -46.633308, 5, postoTeste);
    // Usuário fora do raio (a 5 km)
    const valFora = validateGeofence(-23.59000, -46.690000, 10, postoTeste);

    assert(
      valDentro.geofenceStatus === 'dentro_do_raio' && valFora.geofenceStatus === 'fora_do_raio',
      'Validação de Geofence e Bloqueio Fora do Posto',
      `Dentro: ${valDentro.geofenceStatus}, Fora: ${valFora.geofenceStatus} (${valFora.distanceM}m)`
    );
  } catch (err: any) {
    assert(false, 'Validação de Geofence', err.message);
  }

  // TESTE 9: Sequência Automática da Jornada (Entrada -> Pausa -> Retorno -> Saída)
  try {
    const colabDummy = {
      id: 'colab-1',
      nome: 'Teste',
      matricula: '1001',
      funcao: 'Porteiro',
      condominioId: 'posto-1',
      postoNome: 'Portaria',
      status: 'no_posto',
      jornada: '12x36',
      tipoEscala: '12x36',
      turno: 'diurno',
      foto: '',
      telefone: '',
      cpf: '',
      dataAdmissao: '',
      bancoHoras: 0,
      salarioBase: 2000,
    } as unknown as Colaborador;

    const p0 = determineNextPunch([], colabDummy);
    assert(p0.tipo === 'entrada', 'Sequência de Jornada - 0 Batidas', `Próxima: ${p0.tipo}`);

    const mockPunch = {
      id: 'pe-1',
      colaboradorId: 'colab-1',
      colaboradorNome: 'Teste',
      condominioId: 'posto-1',
      condominioNome: 'Posto',
      postoNome: 'Portaria',
      tipoEvento: 'entrada',
      labelEvento: 'Entrada',
      serverTimestamp: new Date().toISOString(),
      geofenceStatus: 'dentro_do_raio',
      verificationStatus: 'confirmado',
      idempotencyKey: 'idem-1',
      comprovanteNumero: 'TC-1',
      criadoEm: new Date().toISOString(),
    };

    const p1 = determineNextPunch([mockPunch as unknown as PontoEvento], colabDummy);
    assert(p1.tipo === 'saida_intervalo', 'Sequência de Jornada - 1 Batida', `Próxima: ${p1.tipo}`);
  } catch (err: any) {
    assert(false, 'Sequência de Jornada', err.message);
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  return { passed, failed, results };
}
