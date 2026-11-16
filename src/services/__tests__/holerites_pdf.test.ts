import zlib from 'node:zlib';
import {
  generateHoleritePdfBytes,
  generateComprovantePontoPdfBytes,
} from '../documentService';
import {
  saoPauloLocalInputToIsoUtc,
  buildHoleriteFromColaborador,
  emitirLoteHolerites,
} from '../holeriteWorkflowService';
import { Colaborador, HoleriteRegistro } from '../../types';
import { TestResultItem } from './gps_ponto.test';

function extractPdfText(pdfBytes: Uint8Array): string {
  const buf = Buffer.from(pdfBytes);
  const parts: string[] = [buf.toString('latin1')];
  let idx = 0;
  while (idx < buf.length) {
    const startIdx = buf.indexOf('stream', idx);
    if (startIdx === -1) break;
    if (startIdx >= 3 && buf.subarray(startIdx - 3, startIdx).toString('ascii') === 'end') {
      idx = startIdx + 6;
      continue;
    }
    let dataStart = startIdx + 6;
    if (buf[dataStart] === 0x0d && buf[dataStart + 1] === 0x0a) dataStart += 2;
    else if (buf[dataStart] === 0x0a) dataStart += 1;
    else {
      idx = dataStart;
      continue;
    }
    const endMarker = buf.indexOf('endstream', dataStart);
    if (endMarker === -1) break;
    for (const trim of [0, 1, 2]) {
      const candidate = buf.subarray(dataStart, endMarker - trim);
      try {
        const inflated = zlib.inflateSync(candidate).toString('latin1');
        const decodedHex = inflated.replace(/<([0-9A-Fa-f]+)>/g, (_, hex: string) =>
          Buffer.from(hex, 'hex').toString('latin1')
        );
        parts.push(inflated, decodedHex);
        break;
      } catch {
        // try next trim length
      }
    }
    idx = endMarker + 9;
  }
  return parts.join('\n');
}

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

  // 4. Bloqueio de salário base ausente ou zerado na emissão de holerite
  const colabSemSalario: Colaborador = {
    id: 'colab-zero',
    nome: 'Sem Salario',
    matricula: '999',
    funcao: 'Porteiro',
    condominioId: 'posto-1',
    postoNome: 'Posto 1',
    status: 'no_posto',
    jornada: '12x36',
    tipoEscala: '12x36',
    turno: 'diurno',
    foto: '',
    telefone: '',
    cpf: '',
    dataAdmissao: '2026-01-01',
    bancoHoras: 0,
    salarioBase: 0,
  };
  let threwZeroSalary = false;
  try {
    buildHoleriteFromColaborador(colabSemSalario, '2026-11', 'Novembro/2026', 'lote-1', 'rascunho');
  } catch {
    threwZeroSalary = true;
  }
  assert(
    threwZeroSalary,
    'Holerite: Rejeita colaborador sem salário base válido (<= 0)',
    `threwZeroSalary=${threwZeroSalary}`
  );

  // 5. Publicação exige confirmação explícita das rubricas oficiais
  const colabValido: Colaborador = { ...colabSemSalario, id: 'colab-ok', salarioBase: 2400 };
  const blockedSemRubrica = await emitirLoteHolerites({
    empresa: {
      id: 'emp-1',
      razaoSocial: 'Empresa Teste',
      nomeFantasia: 'Teste',
      cnpj: '00.000.000/0001-00',
      inscricaoEstadual: '',
      inscricaoMunicipal: '',
      telefone: '1100000000',
      whatsapp: '',
      email: '',
      endereco: '',
      bairro: '',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '',
      responsavelOperacional: '',
      cargoResponsavel: '',
      chavePix: '',
      logoUrl: '',
      apresentacao: '',
    },
    colaboradores: [colabValido],
    competencia: '2026-11',
    mesReferenciaLabel: 'Novembro/2026',
    modo: 'publicar_agora',
    criadoPorNome: 'RH',
    rubricasOficiaisConfirmadas: false,
  });
  assert(
    !blockedSemRubrica.success && /rubricas oficiais/i.test(blockedSemRubrica.message),
    'Holerite: Bloqueia publicação sem confirmação de rubricas oficiais',
    blockedSemRubrica.message
  );

  // 6. PDF não contém alegação enganosa de ICP-Brasil e exibe FGTS Informativo no conteúdo decodificado
  const pdfDecodedText = extractPdfText(pdfRes.bytes);
  assert(
    !/ICP-Brasil/i.test(pdfDecodedText) && /FGTS Depositado/i.test(pdfDecodedText),
    'Holerite PDF: Sem alegação ICP-Brasil e com rótulo FGTS Informativo',
    'Validado conteúdo textual decodificado do stream PDF'
  );

  return {
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    results,
  };
}
