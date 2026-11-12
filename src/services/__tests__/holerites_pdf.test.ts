import {
  generateHoleritePdfBytes,
  generateComprovantePontoPdfBytes,
} from '../documentService';
import { saoPauloLocalInputToIsoUtc } from '../holeriteWorkflowService';
import { HoleriteRegistro } from '../../types';
import { TestResultItem } from './gps_ponto.test';

export async function runHoleritesPdfTests(): Promise<{
  passed: number;
  failed: number;
  results: TestResultItem[];
}> {
  const results: TestResultItem[] = [];
  const assert = (cond: boolean, testName: string, details: string) => {
    results.push({ testName, passed: cond, details: cond ? `PASSOU: ${details}` : `FALHOU: ${details}` });
  };

  const hol: HoleriteRegistro = {
    id: 'hol-teste-1',
    colaboradorId: 'colab-1',
    colaboradorNome: 'João Teste',
    matricula: '1001',
    funcao: 'Porteiro',
    postoNome: 'Condomínio Horizonte',
    mesReferencia: 'Novembro/2026',
    competencia: '2026-11',
    salarioBase: 2200,
    adicionalPericulosidade: 0,
    adicionalNoturno: 0,
    horasExtras50: 0,
    valorHorasExtras: 320,
    plantoesFT: 2,
    valorFT: 320,
    descontoINSS: 226.8,
    descontoFGTS: 201.6,
    descontoVT: 132,
    descontoVR: 45,
    bonusAssiduidade: 100,
    bonusAtivo: true,
    liquidoReceber: 2216.2,
    statusEnvio: 'Aguardando Assinatura',
    dataEmissao: '13/11/2026',
    versao: 1,
  };

  // 1. Geração binária real de PDF (%PDF-) para holerite
  const pdfRes = await generateHoleritePdfBytes(
    hol,
    { nome: 'João Teste', matricula: '1001', cpf: '123.456.789-00', funcao: 'Porteiro' },
    { razaoSocial: 'Empresa Teste LTDA', cnpj: '00.000.000/0001-00', telefone: '1100000000', cidade: 'São Paulo', estado: 'SP' }
  );
  const headerStr = new TextDecoder().decode(pdfRes.bytes.slice(0, 5));
  assert(
    headerStr === '%PDF-' && pdfRes.bytes.byteLength > 500 && pdfRes.sha256.length >= 8,
    'Holerite PDF: Gera binário %PDF- real com SHA-256 (sem HTML disfarçado)',
    `Header="${headerStr}", bytes=${pdfRes.bytes.byteLength}, sha256=${pdfRes.sha256.slice(0, 12)}`
  );

  // 2. Geração binária real de PDF (%PDF-) para comprovante de ponto
  const compRes = await generateComprovantePontoPdfBytes(
    {
      id: 'pe-1',
      comprovanteNumero: 'TC-20261113-ABC',
      labelEvento: 'Entrada',
      tipoEvento: 'entrada',
      serverTimestamp: '2026-11-13T10:00:00.000Z',
      condominioNome: 'Condomínio Horizonte',
      postoNome: 'Portaria',
      latitude: -23.5,
      longitude: -46.6,
      accuracyM: 12,
      distanceM: 18,
      geofenceStatus: 'dentro_do_raio',
      classificacaoPosto: 'posto_regular',
      metodoAutenticacao: 'biometria_facial',
      verificationStatus: 'confirmado',
      idempotencyKey: 'tc-pe-1',
    },
    { nome: 'João Teste', cpf: '123.456.789-00', matricula: '1001', funcao: 'Porteiro' },
    { razaoSocial: 'Empresa Teste LTDA', cnpj: '00.000.000/0001-00', endereco: 'Rua A', bairro: 'Centro', cidade: 'São Paulo', estado: 'SP' }
  );
  const compHeader = new TextDecoder().decode(compRes.bytes.slice(0, 5));
  assert(
    compHeader === '%PDF-' && compRes.bytes.byteLength > 400,
    'Comprovante Ponto PDF: Gera binário %PDF- real',
    `Header="${compHeader}", bytes=${compRes.bytes.byteLength}`
  );

  // 3. Conversão de agendamento local America/Sao_Paulo (-03:00) para ISO UTC
  const utcIso = saoPauloLocalInputToIsoUtc('2026-11-15T08:00');
  assert(
    utcIso === '2026-11-15T11:00:00.000Z',
    'Agendamento America/Sao_Paulo -> UTC (-03:00)',
    `2026-11-15T08:00 BRT => ${utcIso}`
  );

  return {
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    results,
  };
}
