import util from 'node:util';

if (typeof (globalThis as any).TextEncoder === 'undefined') {
  (globalThis as any).TextEncoder = util.TextEncoder;
}
if (typeof (globalThis as any).TextDecoder === 'undefined') {
  (globalThis as any).TextDecoder = util.TextDecoder;
}

import { runBiometricValidationTests } from './src/services/__tests__/biometrics.test.ts';

async function main() {
  console.log('Iniciando Testes de Validação do Motor Biométrico TurnoCerto...');
  const res = await runBiometricValidationTests();
  console.log(`\nResultados: ${res.passed} aprovados, ${res.failed} falhas.\n`);
  for (const r of res.results) {
    console.log(`[${r.passed ? 'OK' : 'ERRO'}] ${r.testName}: ${r.details}`);
  }
  if (res.failed > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Erro na execução dos testes:', e);
  process.exit(1);
});
