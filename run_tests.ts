import util from 'node:util';

if (typeof (globalThis as any).TextEncoder === 'undefined') {
  (globalThis as any).TextEncoder = util.TextEncoder;
}
if (typeof (globalThis as any).TextDecoder === 'undefined') {
  (globalThis as any).TextDecoder = util.TextDecoder;
}

import { runBiometricValidationTests } from './src/services/__tests__/biometrics.test.ts';
import { runGpsPontoTests } from './src/services/__tests__/gps_ponto.test.ts';
import { runCoberturasTests } from './src/services/__tests__/coberturas.test.ts';
import { runDocumentosTests } from './src/services/__tests__/documentos.test.ts';
import { runHoleritesPdfTests } from './src/services/__tests__/holerites_pdf.test.ts';

async function main() {
  console.log('Iniciando Suite Completa de Testes Automatizados TurnoCerto...\n');

  const suites = [
    { name: 'Motor Biométrico Facial (128D)', fn: runBiometricValidationTests },
    { name: 'GPS Multi-Posto, Turno Noturno e Idempotência', fn: runGpsPontoTests },
    { name: 'Escalas, Extras e Conflitos de Cobertura', fn: runCoberturasTests },
    { name: 'Validação Binária de Documentos (RH <-> Funcionário)', fn: runDocumentosTests },
    { name: 'Geração Real de PDF (%PDF-) e Agendamento Brasília', fn: runHoleritesPdfTests },
  ];

  let totalPassed = 0;
  let totalFailed = 0;

  for (const suite of suites) {
    console.log(`=== ${suite.name} ===`);
    const res = await suite.fn();
    totalPassed += res.passed;
    totalFailed += res.failed;
    for (const r of res.results) {
      console.log(`  [${r.passed ? 'OK' : 'ERRO'}] ${r.testName}: ${r.details}`);
    }
    console.log('');
  }

  console.log(`Resumo Total: ${totalPassed} aprovados, ${totalFailed} falhas.`);
  if (totalFailed > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Erro na execução dos testes:', e);
  process.exit(1);
});
