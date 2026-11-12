import { hasCoverageConflict } from '../escalaCoberturaService';
import { CoberturaProgramada } from '../../types';
import { TestResultItem } from './gps_ponto.test';

function makeCov(overrides: Partial<CoberturaProgramada>): CoberturaProgramada {
  return {
    id: 'cov-base',
    empresaId: 'emp-1',
    colaboradorId: 'colab-1',
    postoCoberturaId: 'posto-b',
    tipo: 'cobertura',
    dataInicio: '2026-11-20',
    dataFim: '2026-11-20',
    horaInicio: '07:00',
    horaFim: '19:00',
    status: 'aprovada',
    criadoEm: '2026-11-10T10:00:00Z',
    ...overrides,
  };
}

export async function runCoberturasTests(): Promise<{
  passed: number;
  failed: number;
  results: TestResultItem[];
}> {
  const results: TestResultItem[] = [];
  const assert = (cond: boolean, testName: string, details: string) => {
    results.push({ testName, passed: cond, details: cond ? `PASSOU: ${details}` : `FALHOU: ${details}` });
  };

  const existing = [makeCov({})];

  // 1. Sem conflito em data distinta
  const noDiffDate = hasCoverageConflict(existing, {
    colaboradorId: 'colab-1',
    dataInicio: '2026-11-21',
    dataFim: '2026-11-21',
    horaInicio: '07:00',
    horaFim: '19:00',
  });
  assert(noDiffDate === null, 'Coberturas: Sem conflito em datas distintas', 'Null esperado');

  // 2. Conflito na mesma data e faixa horária sobreposta
  const overlapSameDay = hasCoverageConflict(existing, {
    colaboradorId: 'colab-1',
    dataInicio: '2026-11-20',
    dataFim: '2026-11-20',
    horaInicio: '14:00',
    horaFim: '22:00',
  });
  assert(overlapSameDay !== null, 'Coberturas: Detecta conflito de horário na mesma data', `Conflito=${overlapSameDay?.id}`);

  // 3. Mesmo dia mas faixa horária sequencial sem sobreposição (19:00-23:00 após 07:00-19:00)
  const sequential = hasCoverageConflict(existing, {
    colaboradorId: 'colab-1',
    dataInicio: '2026-11-20',
    dataFim: '2026-11-20',
    horaInicio: '19:00',
    horaFim: '23:00',
  });
  assert(sequential === null, 'Coberturas: Permite horários consecutivos sem sobreposição', 'Null esperado');

  // 4. Ignora coberturas canceladas ou recusadas
  const canceledList = [makeCov({ status: 'cancelada' }), makeCov({ id: 'cov-2', status: 'recusada' })];
  const afterCancel = hasCoverageConflict(canceledList, {
    colaboradorId: 'colab-1',
    dataInicio: '2026-11-20',
    dataFim: '2026-11-20',
    horaInicio: '07:00',
    horaFim: '19:00',
  });
  assert(afterCancel === null, 'Coberturas: Ignora coberturas canceladas e recusadas', 'Null esperado');

  return {
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    results,
  };
}
