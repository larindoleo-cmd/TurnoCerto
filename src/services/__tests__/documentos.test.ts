import { validateDocumentBytes, MAX_DOCUMENT_SIZE_BYTES } from '../documentWorkflowService';
import { TestResultItem } from './gps_ponto.test';

export async function runDocumentosTests(): Promise<{
  passed: number;
  failed: number;
  results: TestResultItem[];
}> {
  const results: TestResultItem[] = [];
  const assert = (cond: boolean, testName: string, details: string) => {
    results.push({ testName, passed: cond, details: cond ? `PASSOU: ${details}` : `FALHOU: ${details}` });
  };

  // 1. PDF válido (%PDF-)
  const validPdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
  const rPdf = validateDocumentBytes('rg.pdf', 'application/pdf', validPdf);
  assert(rPdf.valid && rPdf.detectedMime === 'application/pdf', 'Documentos: Aceita PDF válido (%PDF)', rPdf.detectedMime || '');

  // 2. JPEG válido (FF D8 FF)
  const validJpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  const rJpg = validateDocumentBytes('foto.jpg', 'image/jpeg', validJpg);
  assert(rJpg.valid && rJpg.detectedMime === 'image/jpeg', 'Documentos: Aceita JPEG válido', rJpg.detectedMime || '');

  // 3. PNG válido (89 50 4E 47 0D 0A 1A 0A)
  const validPng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const rPng = validateDocumentBytes('aso.png', 'image/png', validPng);
  assert(rPng.valid && rPng.detectedMime === 'image/png', 'Documentos: Aceita PNG válido', rPng.detectedMime || '');

  // 4. Rejeita HTML disfarçado com extensão .pdf (magic bytes não são %PDF)
  const fakeHtml = new TextEncoder().encode('<!DOCTYPE html><html><body>Fake</body></html>');
  const rFake = validateDocumentBytes('falso.pdf', 'application/pdf', fakeHtml);
  assert(!rFake.valid, 'Documentos: Bloqueia HTML disfarçado de PDF (magic bytes)', rFake.reason || '');

  // 5. Rejeita extensão não permitida
  const rExt = validateDocumentBytes('script.html', 'text/html', fakeHtml);
  assert(!rExt.valid, 'Documentos: Bloqueia extensão não autorizada (.html)', rExt.reason || '');

  // 6. Rejeita arquivo vazio ou > 10MB
  const rEmpty = validateDocumentBytes('vazio.pdf', 'application/pdf', new Uint8Array(0));
  const oversized = new Uint8Array(MAX_DOCUMENT_SIZE_BYTES + 1);
  oversized.set([0x25, 0x50, 0x44, 0x46]);
  const rBig = validateDocumentBytes('grande.pdf', 'application/pdf', oversized);
  assert(!rEmpty.valid && !rBig.valid, 'Documentos: Bloqueia arquivo vazio e acima de 10 MB', `${rEmpty.reason} | ${rBig.reason}`);

  return {
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    results,
  };
}
