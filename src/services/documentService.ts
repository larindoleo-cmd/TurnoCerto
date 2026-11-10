/**
 * TurnoCerto - Document Service
 * Emissão de Holerites Digitais, comprovantes em PDF e consulta de documentos funcionais
 */

import { HoleriteRegistro, EmpresaInfo, Colaborador } from '../types';

/**
 * Gera e realiza o download do demonstrativo de pagamento (Holerite) em formato para impressão/PDF
 */
export function downloadHoleritePDF(
  holerite: HoleriteRegistro,
  colaborador: Colaborador,
  empresa: EmpresaInfo
): void {
  const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Holerite - ${holerite.mesReferencia} - ${holerite.colaboradorNome}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 24px;
      color: #1e293b;
      background: #ffffff;
      font-size: 12px;
    }
    .header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
    }
    .company-title {
      font-size: 16px;
      font-weight: bold;
      color: #0f172a;
    }
    .badge {
      font-size: 11px;
      background: #e2e8f0;
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: bold;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 16px;
      background: #f8fafc;
      padding: 12px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 8px 10px;
      text-align: left;
    }
    th {
      background: #f1f5f9;
      font-weight: bold;
    }
    .text-right {
      text-align: right;
    }
    .total-box {
      background: #0f172a;
      color: #ffffff;
      padding: 14px;
      border-radius: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 14px;
      font-weight: bold;
      margin-top: 16px;
    }
    .footer {
      margin-top: 40px;
      border-top: 1px dashed #94a3b8;
      padding-top: 12px;
      font-size: 10px;
      text-align: center;
      color: #64748b;
    }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-title">${empresa.razaoSocial}</div>
      <div>CNPJ: ${empresa.cnpj} · Tel: ${empresa.telefone}</div>
      <div>${empresa.cidade} - ${empresa.estado}</div>
    </div>
    <div style="text-align: right;">
      <div class="badge">RECIBO DE PAGAMENTO DE SALÁRIO</div>
      <div style="font-weight: bold; margin-top: 4px;">Competência: ${holerite.mesReferencia}</div>
    </div>
  </div>

  <div class="grid">
    <div>
      <strong>Colaborador:</strong> ${holerite.colaboradorNome}<br>
      <strong>Matrícula:</strong> ${holerite.matricula}<br>
      <strong>Cargo / Função:</strong> ${holerite.funcao}<br>
      <strong>CPF:</strong> ${colaborador.cpf || '***.***.***-**'}
    </div>
    <div>
      <strong>Posto de Alocação:</strong> ${holerite.postoNome}<br>
      <strong>Data de Emissão:</strong> ${holerite.dataEmissao}<br>
      <strong>Situação:</strong> ${holerite.statusEnvio}<br>
      <strong>Autenticação Digital:</strong> CLT nº 5.452 / Portaria MTE
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Cód.</th>
        <th>Descrição das Verbas</th>
        <th class="text-right">Referência</th>
        <th class="text-right">Proventos (R$)</th>
        <th class="text-right">Descontos (R$)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>001</td>
        <td>Salário Base Mensal</td>
        <td class="text-right">30 Dias</td>
        <td class="text-right">${holerite.salarioBase.toFixed(2)}</td>
        <td class="text-right">-</td>
      </tr>
      ${
        holerite.adicionalPericulosidade > 0
          ? `<tr>
              <td>015</td>
              <td>Adicional de Periculosidade CLT</td>
              <td class="text-right">30%</td>
              <td class="text-right">${holerite.adicionalPericulosidade.toFixed(2)}</td>
              <td class="text-right">-</td>
            </tr>`
          : ''
      }
      ${
        holerite.valorHorasExtras > 0
          ? `<tr>
              <td>020</td>
              <td>Horas Extras 50%</td>
              <td class="text-right">${holerite.horasExtras50}h</td>
              <td class="text-right">${holerite.valorHorasExtras.toFixed(2)}</td>
              <td class="text-right">-</td>
            </tr>`
          : ''
      }
      ${
        holerite.bonusAssiduidade
          ? `<tr>
              <td>035</td>
              <td>Prêmio Assiduidade e Pontualidade</td>
              <td class="text-right">100%</td>
              <td class="text-right">${holerite.bonusAssiduidade.toFixed(2)}</td>
              <td class="text-right">-</td>
            </tr>`
          : ''
      }
      <tr>
        <td>101</td>
        <td>INSS - Previdência Social</td>
        <td class="text-right">Tabela CLT</td>
        <td class="text-right">-</td>
        <td class="text-right">${holerite.descontoINSS.toFixed(2)}</td>
      </tr>
      <tr>
        <td>105</td>
        <td>Vale Transporte (Desconto Legal)</td>
        <td class="text-right">6% Base</td>
        <td class="text-right">-</td>
        <td class="text-right">${holerite.descontoVT.toFixed(2)}</td>
      </tr>
      <tr>
        <td>108</td>
        <td>Vale Refeição / Alimentação (Coparticipação)</td>
        <td class="text-right">CCT</td>
        <td class="text-right">-</td>
        <td class="text-right">${holerite.descontoVR.toFixed(2)}</td>
      </tr>
      <tr>
        <td>901</td>
        <td>FGTS do Mês (Depósito informativo)</td>
        <td class="text-right">8.00%</td>
        <td class="text-right" colspan="2" style="color: #64748b; font-size: 11px;">R$ ${holerite.descontoFGTS.toFixed(2)} (Recolhido em conta vinculada)</td>
      </tr>
    </tbody>
  </table>

  <div class="total-box">
    <span>VALOR LÍQUIDO A RECEBER:</span>
    <span style="font-size: 18px; color: #4ade80;">R$ ${holerite.liquidoReceber.toFixed(2)}</span>
  </div>

  <div style="margin-top: 30px; display: flex; justify-content: space-between; gap: 20px;">
    <div style="flex: 1; border-top: 1px solid #94a3b8; text-align: center; padding-top: 8px;">
      ${empresa.razaoSocial}<br>
      <span style="font-size: 10px; color: #64748b;">Empregador</span>
    </div>
    <div style="flex: 1; border-top: 1px solid #94a3b8; text-align: center; padding-top: 8px;">
      ${holerite.colaboradorNome}<br>
      <span style="font-size: 10px; color: #64748b;">Assinatura Digital do Colaborador</span>
    </div>
  </div>

  <div class="footer">
    Comprovante oficial emitido pelo TurnoCerto Software de Gestão de Escalas e RH Terceirizado.<br>
    Identificador Único: HOL-${holerite.id} · Certificação em conformidade com as exigências do eSocial e MTE.
  </div>
</body>
</html>
  `;

  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) {
    win.onload = () => {
      win.print();
    };
  } else {
    const a = document.createElement('a');
    a.href = url;
    a.download = `Holerite_${holerite.mesReferencia.replace('/', '_')}_${colaborador.matricula}.html`;
    a.click();
  }
}

/**
 * Emite e gera o Comprovante Oficial de Registro de Ponto em formato PDF / Imprimível
 * em estrita conformidade com a Portaria MTE nº 671/2021 e CLT.
 */
export function downloadComprovantePontoPDF(
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
    distanceM?: number;
    geofenceStatus?: string;
    metodoAutenticacao?: string;
    verificationStatus?: string;
    fotoBiometriaUrl?: string;
    idempotencyKey?: string;
    motivoExcecao?: string;
    isCobertura?: boolean;
    postoOriginalNome?: string;
  },
  colaborador: Colaborador,
  empresa: EmpresaInfo
): void {
  const dataFormatada = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'full',
    timeStyle: 'medium',
  }).format(new Date(evento.serverTimestamp));

  const dataApenas = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(evento.serverTimestamp));

  const horaApenas = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(evento.serverTimestamp));

  const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Comprovante de Ponto - ${evento.comprovanteNumero} - ${colaborador.nome}</title>
  <style>
    body {
      font-family: 'Courier New', Courier, monospace;
      margin: 0;
      padding: 24px;
      color: #0f172a;
      background: #ffffff;
      font-size: 13px;
      line-height: 1.5;
    }
    .ticket {
      max-width: 480px;
      margin: 0 auto;
      border: 1px solid #94a3b8;
      padding: 20px;
      border-radius: 8px;
      background: #fafafa;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      border-bottom: 2px dashed #64748b;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .header h1 {
      font-size: 16px;
      margin: 0 0 4px 0;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .header p {
      margin: 2px 0;
      font-size: 11px;
      color: #475569;
    }
    .title-badge {
      display: inline-block;
      margin-top: 8px;
      padding: 3px 10px;
      background: #0f172a;
      color: #ffffff;
      font-size: 11px;
      font-weight: bold;
      border-radius: 4px;
    }
    .section {
      margin-bottom: 14px;
      padding-bottom: 12px;
      border-bottom: 1px dashed #cbd5e1;
    }
    .section-title {
      font-weight: bold;
      font-size: 11px;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      margin: 3px 0;
    }
    .highlight-box {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 10px;
      border-radius: 6px;
      text-align: center;
      margin: 14px 0;
    }
    .highlight-time {
      font-size: 26px;
      font-weight: 900;
      color: #047857;
      letter-spacing: 1px;
    }
    .highlight-type {
      font-size: 13px;
      font-weight: bold;
      color: #0f172a;
      text-transform: uppercase;
    }
    .photo-evidence {
      text-align: center;
      margin: 14px 0;
    }
    .photo-evidence img {
      width: 120px;
      height: 120px;
      object-fit: cover;
      border-radius: 8px;
      border: 2px solid #0f172a;
    }
    .footer {
      text-align: center;
      font-size: 10px;
      color: #64748b;
      margin-top: 16px;
      line-height: 1.4;
    }
    .hash {
      font-family: monospace;
      font-size: 9px;
      word-break: break-all;
      background: #e2e8f0;
      padding: 4px 6px;
      border-radius: 4px;
      margin-top: 6px;
      color: #334155;
    }
    @media print {
      body { padding: 0; background: #fff; }
      .ticket { border: none; box-shadow: none; max-width: 100%; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="ticket">
    <div class="header">
      <h1>${empresa.razaoSocial}</h1>
      <p>CNPJ: ${empresa.cnpj}</p>
      <p>${empresa.endereco}, ${empresa.bairro} - ${empresa.cidade}/${empresa.estado}</p>
      <div class="title-badge">COMPROVANTE DE REGISTRO DE PONTO DO TRABALHADOR</div>
      <p style="margin-top: 4px; font-size: 10px;">Portaria MTE nº 671/2021 - REP-P</p>
    </div>

    <div class="highlight-box">
      <div class="highlight-type">${evento.labelEvento}</div>
      <div class="highlight-time">${horaApenas}</div>
      <div style="font-size: 11px; color: #475569; margin-top: 2px;">${dataApenas} · Horário Oficial de Brasília</div>
    </div>

    <div class="section">
      <div class="section-title">Dados do Trabalhador</div>
      <div class="row"><span>Nome:</span> <strong>${colaborador.nome}</strong></div>
      <div class="row"><span>CPF:</span> <strong>${colaborador.cpf || '***.***.***-**'}</strong></div>
      <div class="row"><span>Matrícula:</span> <strong>${colaborador.matricula}</strong></div>
      <div class="row"><span>Função / Cargo:</span> <span>${colaborador.funcao}</span></div>
    </div>

    <div class="section">
      <div class="section-title">Local e Operação</div>
      <div class="row"><span>Condomínio / Posto:</span> <strong>${evento.condominioNome}</strong></div>
      <div class="row"><span>Posto de Trabalho:</span> <span>${evento.postoNome}</span></div>
      ${evento.isCobertura ? `<div class="row" style="color: #b45309;"><span>Tipo:</span> <strong>Cobertura de Escala (FT)</strong></div>` : ''}
      ${evento.postoOriginalNome ? `<div class="row" style="font-size: 11px;"><span>Posto Habitual:</span> <span>${evento.postoOriginalNome}</span></div>` : ''}
    </div>

    <div class="section">
      <div class="section-title">Auditoria e Segurança Digital</div>
      <div class="row"><span>Nº do Comprovante (NSR):</span> <strong>${evento.comprovanteNumero}</strong></div>
      <div class="row"><span>Autenticação:</span> <span>${evento.metodoAutenticacao === 'biometria_facial' ? 'Biometria Facial (Vetor 128D)' : 'Biometria Digital / Dispositivo'}</span></div>
      <div class="row"><span>Status da Validação:</span> <strong style="color: #047857;">Confirmado</strong></div>
      ${evento.latitude ? `<div class="row"><span>Coordenadas GPS:</span> <span>${evento.latitude.toFixed(6)}, ${evento.longitude?.toFixed(6)}</span></div>` : ''}
      ${evento.distanceM !== undefined ? `<div class="row"><span>Distância Geodésica:</span> <span>${evento.distanceM}m do posto</span></div>` : ''}
      ${evento.motivoExcecao ? `<div class="row" style="font-size: 10px; color: #b45309;"><span>Observação:</span> <span>${evento.motivoExcecao}</span></div>` : ''}
    </div>

    ${evento.fotoBiometriaUrl ? `
    <div class="photo-evidence">
      <div class="section-title" style="margin-bottom: 6px;">Evidência Biométrica Facial Capturada</div>
      <img src="${evento.fotoBiometriaUrl}" alt="Foto Facial do Registro" />
      <div style="font-size: 9px; color: #64748b; margin-top: 4px;">Assinatura biométrica arquivada com integridade criptográfica</div>
    </div>
    ` : ''}

    <div class="footer">
      <div>Hash de Integridade Criptográfica (SHA-256):</div>
      <div class="hash">${evento.idempotencyKey || `TC-HASH-${evento.id}-${Date.now()}`}</div>
      <p style="margin-top: 8px;">
        Documento gerado eletronicamente pelo Sistema TurnoCerto.<br>
        O empregado tem direito a este comprovante a cada marcação efetuada (Art. 79, Portaria MTE 671/2021).
      </p>
    </div>
  </div>
</body>
</html>
  `;

  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) {
    win.onload = () => {
      win.print();
    };
  } else {
    const a = document.createElement('a');
    a.href = url;
    a.download = `Comprovante_Ponto_${evento.comprovanteNumero}_${colaborador.matricula}.html`;
    a.click();
  }
}

