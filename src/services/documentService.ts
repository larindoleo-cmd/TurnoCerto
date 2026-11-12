/**
 * TurnoCerto - Document Service
 * Geração real de PDF binário (%PDF-) com pdf-lib para Holerites e Comprovantes de Ponto,
 * cálculo de integridade SHA-256 e download seguro sem window.open() ou HTML disfarçado.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { HoleriteRegistro, EmpresaInfo, Colaborador } from '../types';

export interface GeneratedPdfResult {
  bytes: Uint8Array;
  sha256: string;
  fileName: string;
}

function sanitizePdfText(input: string | undefined | null): string {
  // WinAnsi fallback seguro para StandardFonts Helvetica (preserva acentos latinos comuns e substitui símbolos fora WinAnsi)
  return (input || '')
    .replace(/[\u2014\u2013]/g, '-')
    .replace(/[\u2022\u00b7]/g, '-')
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, ' ');
}

export async function computeSha256Hex(bytes: Uint8Array): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const digest = await crypto.subtle.digest('SHA-256', copy.buffer);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback determinístico em ambientes sem WebCrypto
  let hash = 2166136261;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function triggerBrowserPdfDownload(bytes: Uint8Array, fileName: string): void {
  if (typeof document === 'undefined') return;
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1500);
}

/**
 * Gera bytes binários reais de PDF (%PDF-1.x) para Holerite (sem HTML falso e sem ICP-Brasil enganoso).
 */
export async function generateHoleritePdfBytes(
  holerite: HoleriteRegistro,
  colaborador: Pick<Colaborador, 'nome' | 'matricula' | 'cpf' | 'funcao'>,
  empresa: Pick<EmpresaInfo, 'razaoSocial' | 'cnpj' | 'telefone' | 'cidade' | 'estado'>
): Promise<GeneratedPdfResult> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const dark = rgb(0.06, 0.09, 0.16);
  const muted = rgb(0.39, 0.45, 0.55);
  const accent = rgb(0.11, 0.31, 0.85);
  const green = rgb(0.02, 0.47, 0.34);
  const red = rgb(0.72, 0.11, 0.11);
  const border = rgb(0.82, 0.86, 0.91);

  let y = 790;
  const left = 44;
  const right = 551;

  // Cabeçalho
  page.drawText(sanitizePdfText(empresa.razaoSocial), { x: left, y, size: 13, font: fontBold, color: dark });
  page.drawText('DEMONSTRATIVO DE PAGAMENTO', { x: 350, y, size: 11, font: fontBold, color: accent });
  y -= 16;
  page.drawText(sanitizePdfText(`CNPJ: ${empresa.cnpj} | Tel: ${empresa.telefone} | ${empresa.cidade} - ${empresa.estado}`), {
    x: left,
    y,
    size: 8.5,
    font: fontRegular,
    color: muted,
  });
  page.drawText(sanitizePdfText(`Competencia: ${holerite.mesReferencia} (v${holerite.versao || 1})`), {
    x: 350,
    y,
    size: 9,
    font: fontBold,
    color: dark,
  });

  y -= 14;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1.5, color: dark });
  y -= 20;

  // Dados do colaborador
  page.drawText(sanitizePdfText(`Colaborador: ${holerite.colaboradorNome}`), { x: left, y, size: 9.5, font: fontBold, color: dark });
  page.drawText(sanitizePdfText(`Matricula: ${holerite.matricula}`), { x: 350, y, size: 9.5, font: fontRegular, color: dark });
  y -= 14;
  page.drawText(sanitizePdfText(`Cargo: ${holerite.funcao} | Posto: ${holerite.postoNome}`), { x: left, y, size: 9, font: fontRegular, color: dark });
  page.drawText(sanitizePdfText(`CPF: ${colaborador.cpf || '***.***.***-**'}`), { x: 350, y, size: 9, font: fontRegular, color: dark });
  y -= 14;
  page.drawText(sanitizePdfText(`Emissao: ${holerite.dataEmissao} | Situacao: ${holerite.statusEnvio}`), {
    x: left,
    y,
    size: 8.5,
    font: fontRegular,
    color: muted,
  });

  if (holerite.motivoRetificacao) {
    y -= 14;
    page.drawText(sanitizePdfText(`Retificacao: ${holerite.motivoRetificacao}`), {
      x: left,
      y,
      size: 8.5,
      font: fontBold,
      color: red,
    });
  }

  y -= 18;
  page.drawRectangle({ x: left, y: y - 16, width: right - left, height: 20, color: rgb(0.95, 0.96, 0.98) });
  page.drawText('Cod', { x: left + 6, y: y - 10, size: 8.5, font: fontBold, color: dark });
  page.drawText('Descricao da Verba', { x: left + 48, y: y - 10, size: 8.5, font: fontBold, color: dark });
  page.drawText('Ref.', { x: 325, y: y - 10, size: 8.5, font: fontBold, color: dark });
  page.drawText('Proventos', { x: 395, y: y - 10, size: 8.5, font: fontBold, color: green });
  page.drawText('Descontos', { x: 482, y: y - 10, size: 8.5, font: fontBold, color: red });
  y -= 28;

  const rows: Array<{ cod: string; desc: string; ref: string; prov?: number; descVal?: number }> = [
    { cod: '001', desc: 'Salario Base Mensal', ref: '30d', prov: holerite.salarioBase },
  ];
  if (holerite.adicionalPericulosidade > 0) {
    rows.push({ cod: '015', desc: 'Adicional de Periculosidade', ref: '30%', prov: holerite.adicionalPericulosidade });
  }
  if (holerite.adicionalNoturno > 0) {
    rows.push({ cod: '018', desc: 'Adicional Noturno', ref: 'CLT', prov: holerite.adicionalNoturno });
  }
  if (holerite.valorHorasExtras > 0 || (holerite.valorFT && holerite.valorFT > 0)) {
    rows.push({
      cod: '040',
      desc: holerite.plantoesFT ? 'Plantao FT / Extras' : 'Horas Extras 50%',
      ref: holerite.plantoesFT ? `${holerite.plantoesFT} FT` : `${holerite.horasExtras50}h`,
      prov: holerite.valorFT || holerite.valorHorasExtras,
    });
  }
  if (holerite.bonusAssiduidade && holerite.bonusAssiduidade > 0 && holerite.bonusAtivo !== false) {
    rows.push({ cod: '070', desc: 'Bonus de Assiduidade', ref: '100%', prov: holerite.bonusAssiduidade });
  }
  rows.push({ cod: '101', desc: 'INSS Folha Mensal', ref: 'Tab.', descVal: holerite.descontoINSS });
  rows.push({ cod: '105', desc: 'Vale Transporte (6%)', ref: '6%', descVal: holerite.descontoVT });
  rows.push({ cod: '108', desc: 'Vale Refeicao / Alimentacao', ref: 'Copart.', descVal: holerite.descontoVR });

  for (const r of rows) {
    page.drawText(r.cod, { x: left + 6, y, size: 8.5, font: fontRegular, color: muted });
    page.drawText(sanitizePdfText(r.desc), { x: left + 48, y, size: 8.5, font: fontRegular, color: dark });
    page.drawText(sanitizePdfText(r.ref), { x: 325, y, size: 8.5, font: fontRegular, color: muted });
    page.drawText(r.prov !== undefined ? `R$ ${r.prov.toFixed(2)}` : '-', {
      x: 395,
      y,
      size: 8.5,
      font: fontBold,
      color: r.prov !== undefined ? green : muted,
    });
    page.drawText(r.descVal !== undefined ? `R$ ${r.descVal.toFixed(2)}` : '-', {
      x: 482,
      y,
      size: 8.5,
      font: fontBold,
      color: r.descVal !== undefined ? red : muted,
    });
    y -= 6;
    page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.5, color: border });
    y -= 14;
  }

  const totalProventos =
    holerite.salarioBase +
    holerite.adicionalPericulosidade +
    holerite.adicionalNoturno +
    (holerite.valorFT || holerite.valorHorasExtras) +
    (holerite.bonusAtivo !== false ? holerite.bonusAssiduidade || 0 : 0);
  const totalDescontos = holerite.descontoINSS + holerite.descontoVT + holerite.descontoVR;
  const liquido = holerite.liquidoReceber ?? Math.max(0, totalProventos - totalDescontos);

  y -= 10;
  page.drawRectangle({ x: left, y: y - 34, width: right - left, height: 42, color: dark });
  page.drawText(`Proventos: R$ ${totalProventos.toFixed(2)} | Descontos: R$ ${totalDescontos.toFixed(2)} | FGTS (8%): R$ ${holerite.descontoFGTS.toFixed(2)}`, {
    x: left + 12,
    y: y - 6,
    size: 8.5,
    font: fontRegular,
    color: rgb(0.8, 0.85, 0.92),
  });
  page.drawText(`VALOR LIQUIDO A RECEBER: R$ ${liquido.toFixed(2)}`, {
    x: left + 12,
    y: y - 24,
    size: 11,
    font: fontBold,
    color: rgb(0.3, 0.87, 0.5),
  });

  y -= 62;
  page.drawText('CONFIRMACAO DE RECEBIMENTO E CIENCIA', { x: left, y, size: 9, font: fontBold, color: dark });
  y -= 13;
  const cienciaInfo = holerite.cienciaConfirmadaEm
    ? `Recebimento confirmado em ${new Date(holerite.cienciaConfirmadaEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (Versao termo: ${holerite.cienciaDeclaracaoVersao || 'v1'}).`
    : 'Aguardando confirmacao de recebimento e ciencia pelo colaborador no aplicativo.';
  page.drawText(sanitizePdfText(cienciaInfo), { x: left, y, size: 8.5, font: fontRegular, color: dark });
  y -= 12;
  page.drawText(
    'Aviso: A confirmacao eletronica atesta apenas o recebimento e ciencia do demonstrativo, nao implicando concordancia com valores.',
    { x: left, y, size: 7.5, font: fontRegular, color: muted }
  );

  page.drawText(sanitizePdfText(`Documento ID: ${holerite.id} | TurnoCerto RH`), {
    x: left,
    y: 44,
    size: 7.5,
    font: fontRegular,
    color: muted,
  });

  const bytes = await pdfDoc.save();
  const sha256 = await computeSha256Hex(bytes);
  const safeRef = (holerite.competencia || holerite.mesReferencia).replace(/[^\w-]+/g, '_');
  const fileName = `Holerite_${safeRef}_${holerite.matricula}_v${holerite.versao || 1}.pdf`;

  return { bytes, sha256, fileName };
}

export async function downloadHoleritePDF(
  holerite: HoleriteRegistro,
  colaborador: Colaborador,
  empresa: EmpresaInfo
): Promise<GeneratedPdfResult> {
  const result = await generateHoleritePdfBytes(holerite, colaborador, empresa);
  triggerBrowserPdfDownload(result.bytes, result.fileName);
  return result;
}

/**
 * Gera bytes binários reais de PDF (%PDF-1.x) para Comprovante de Registro de Ponto (Portaria MTE 671).
 */
export async function generateComprovantePontoPdfBytes(
  evento: {
    id: string;
    comprovanteNumero: string;
    labelEvento: string;
    tipoEvento: string;
    serverTimestamp: string;
    condominioNome: string;
    postoNome: string;
    latitude?: number;
    longitude?: number;
    accuracyM?: number;
    distanceM?: number;
    geofenceStatus?: string;
    classificacaoPosto?: string;
    metodoAutenticacao?: string;
    verificationStatus?: string;
    idempotencyKey?: string;
    motivoExcecao?: string;
    postoOriginalNome?: string;
  },
  colaborador: Pick<Colaborador, 'nome' | 'cpf' | 'matricula' | 'funcao'>,
  empresa: Pick<EmpresaInfo, 'razaoSocial' | 'cnpj' | 'endereco' | 'bairro' | 'cidade' | 'estado'>
): Promise<GeneratedPdfResult> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([420, 620]);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const dark = rgb(0.06, 0.09, 0.16);
  const muted = rgb(0.39, 0.45, 0.55);
  const green = rgb(0.02, 0.47, 0.34);

  const dt = new Date(evento.serverTimestamp);
  const dataBR = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short' }).format(dt);
  const horaBR = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', timeStyle: 'medium' }).format(dt);

  let y = 580;
  const left = 28;
  const writeLine = (label: string, value: string, boldVal = false) => {
    page.drawText(sanitizePdfText(label), { x: left, y, size: 8.5, font: fontRegular, color: muted });
    page.drawText(sanitizePdfText(value), { x: left + 135, y, size: 8.5, font: boldVal ? fontBold : fontRegular, color: dark });
    y -= 15;
  };

  page.drawText(sanitizePdfText(empresa.razaoSocial), { x: left, y, size: 11, font: fontBold, color: dark });
  y -= 13;
  page.drawText(sanitizePdfText(`CNPJ: ${empresa.cnpj}`), { x: left, y, size: 8, font: fontRegular, color: muted });
  y -= 18;
  page.drawText('COMPROVANTE DE REGISTRO DE PONTO', { x: left, y, size: 10.5, font: fontBold, color: dark });
  y -= 12;
  page.drawText('Portaria MTE n 671/2021 - REP-P (Horario de Brasilia)', { x: left, y, size: 8, font: fontRegular, color: muted });
  y -= 16;

  page.drawRectangle({ x: left, y: y - 40, width: 364, height: 46, color: rgb(0.95, 0.97, 0.99) });
  page.drawText(sanitizePdfText(evento.labelEvento.toUpperCase()), { x: left + 10, y: y - 14, size: 9, font: fontBold, color: dark });
  page.drawText(`${dataBR}  ${horaBR}`, { x: left + 10, y: y - 32, size: 14, font: fontBold, color: green });
  y -= 58;

  writeLine('Colaborador:', colaborador.nome, true);
  writeLine('CPF / Matricula:', `${colaborador.cpf || '***.***.***-**'} | ${colaborador.matricula}`);
  writeLine('Funcao:', colaborador.funcao);
  writeLine('Posto Detectado:', `${evento.condominioNome} (${evento.postoNome})`, true);
  if (evento.postoOriginalNome) writeLine('Posto Base:', evento.postoOriginalNome);
  if (evento.classificacaoPosto) writeLine('Classificacao:', evento.classificacaoPosto);
  writeLine('Comprovante NSR:', evento.comprovanteNumero, true);
  writeLine('Metodo Auth:', evento.metodoAutenticacao || 'biometria_facial');
  writeLine('Status:', evento.verificationStatus === 'confirmado' ? 'Confirmado no servidor' : 'Pendente sincronizacao');
  if (evento.latitude !== undefined && evento.longitude !== undefined) {
    writeLine('Coordenadas GPS:', `${evento.latitude.toFixed(6)}, ${evento.longitude.toFixed(6)} (±${evento.accuracyM || '?'}m)`);
  }
  if (evento.distanceM !== undefined) {
    writeLine('Distancia Posto:', `${evento.distanceM} m`);
  }
  if (evento.motivoExcecao) {
    writeLine('Observacao:', evento.motivoExcecao.slice(0, 48));
  }

  y -= 10;
  page.drawText(sanitizePdfText(`Idempotencia: ${evento.idempotencyKey || evento.id}`), {
    x: left,
    y,
    size: 7.5,
    font: fontRegular,
    color: muted,
  });

  const bytes = await pdfDoc.save();
  const sha256 = await computeSha256Hex(bytes);
  const fileName = `Comprovante_Ponto_${evento.comprovanteNumero}_${colaborador.matricula}.pdf`;
  return { bytes, sha256, fileName };
}

export async function downloadComprovantePontoPDF(
  evento: Parameters<typeof generateComprovantePontoPdfBytes>[0],
  colaborador: Colaborador,
  empresa: EmpresaInfo
): Promise<GeneratedPdfResult> {
  const result = await generateComprovantePontoPdfBytes(evento, colaborador, empresa);
  triggerBrowserPdfDownload(result.bytes, result.fileName);
  return result;
}
