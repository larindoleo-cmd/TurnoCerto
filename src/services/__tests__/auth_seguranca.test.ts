import fs from 'node:fs';
import path from 'node:path';
import { testSupabaseConnection } from '../../lib/supabase';
import { TestResultItem } from './gps_ponto.test';

export async function runAuthSegurancaTests(): Promise<{
  passed: number;
  failed: number;
  results: TestResultItem[];
}> {
  const results: TestResultItem[] = [];
  const assert = (cond: boolean, testName: string, details: string) => {
    results.push({ testName, passed: cond, details: cond ? `PASSOU: ${details}` : `FALHOU: ${details}` });
  };

  // 1. Validação de configuração Supabase
  const badUrl = await testSupabaseConnection('http://inseguro.supabase.co', 'chave_suficientemente_longa_12345');
  const badKey = await testSupabaseConnection('https://exemplo.supabase.co', 'curta');
  assert(
    !badUrl.success && !badKey.success,
    'Supabase Settings: Rejeita URL não-HTTPS e Anon Key incompleta',
    `badUrl=${badUrl.success}, badKey=${badKey.success}`
  );

  // 2. MockData sem senhas em texto puro e sem status legado 'Assinado'
  const mockPath = path.resolve(process.cwd(), 'src/data/mockData.ts');
  const mockContent = fs.readFileSync(mockPath, 'utf8');
  const hasPlaintextSenha = /\bsenha\s*:/i.test(mockContent);
  const hasAssinadoStatus = /statusEnvio\s*:\s*['"]Assinado['"]/.test(mockContent);
  assert(
    !hasPlaintextSenha && !hasAssinadoStatus,
    'MockData: Sem campo senha em texto puro e sem status Assinado enganoso',
    `hasPlaintextSenha=${hasPlaintextSenha}, hasAssinadoStatus=${hasAssinadoStatus}`
  );

  // 3. Migrações de endurecimento RLS / Storage / Holerites / Coberturas
  const rlsSql = fs.readFileSync(
    path.resolve(process.cwd(), 'supabase/migrations/20261114100003_rls_security_hardening_v2.sql'),
    'utf8'
  );
  const hasSilentFuncFallback = /COALESCE\s*\([^)]*'funcionario'/i.test(rlsSql);
  const hasValidTenantFn = /CREATE OR REPLACE FUNCTION public\.has_valid_tenant_profile/i.test(rlsSql);
  const hasTriggerAlerta = /trg_notify_alerta_operacional/i.test(rlsSql);
  const hasTriggerCorrecao = /trg_notify_solicitacao_correcao_ponto/i.test(rlsSql);
  assert(
    !hasSilentFuncFallback && hasValidTenantFn && hasTriggerAlerta && hasTriggerCorrecao,
    'SQL RLS v2: Remove fallback silencioso funcionario, exige perfil válido e cria triggers de notificação',
    `noFallback=${!hasSilentFuncFallback}, validTenantFn=${hasValidTenantFn}, triggers=${hasTriggerAlerta && hasTriggerCorrecao}`
  );

  const storageSql = fs.readFileSync(
    path.resolve(process.cwd(), 'supabase/migrations/20261114100004_storage_documentos_pedidos_rh.sql'),
    'utf8'
  );
  const hasPrivateBuckets =
    /'fotos-colaboradores'/.test(storageSql) &&
    /'ocorrencias-anexos'/.test(storageSql) &&
    /public\s*=\s*FALSE/i.test(storageSql);
  const hasRhRequestRpc = /CREATE OR REPLACE FUNCTION public\.criar_solicitacao_colaborador_rh/i.test(storageSql);
  assert(
    hasPrivateBuckets && hasRhRequestRpc,
    'SQL Storage & RH: Privatiza buckets e cria RPC transacional de pedidos ao RH',
    `privateBuckets=${hasPrivateBuckets}, rhRpc=${hasRhRequestRpc}`
  );

  const holSql = fs.readFileSync(
    path.resolve(process.cwd(), 'supabase/migrations/20261114100005_holerites_ciencia_cron_hardening.sql'),
    'utf8'
  );
  const revokesCron = /REVOKE ALL ON FUNCTION public\.publicar_lotes_holerites_agendados\(\) FROM PUBLIC, anon, authenticated/i.test(holSql);
  const grantsServiceRole = /GRANT EXECUTE ON FUNCTION public\.publicar_lotes_holerites_agendados\(\) TO service_role/i.test(holSql);
  const usesRecebimentoConfirmado = /Recebimento confirmado/.test(holSql);
  assert(
    revokesCron && grantsServiceRole && usesRecebimentoConfirmado,
    'SQL Holerites & Cron: Restringe função agendada a service_role e usa Recebimento confirmado',
    `revokesCron=${revokesCron}, grantsServiceRole=${grantsServiceRole}, statusRecebimento=${usesRecebimentoConfirmado}`
  );

  // 4. AppContext não possui fallback silencioso para 'funcionario' nem INSERT direto em notificacoes_sistema
  const appCtxContent = fs.readFileSync(path.resolve(process.cwd(), 'src/context/AppContext.tsx'), 'utf8');
  const hasDirectNotifInsert = /\.from\(\s*['"]notificacoes_sistema['"]\s*\)\s*\.insert\(/i.test(appCtxContent);
  const hasAuthBlockedReason = /setAuthBlockedReason\(/.test(appCtxContent);
  assert(
    !hasDirectNotifInsert && hasAuthBlockedReason,
    'AppContext: Sem insert direto em notificacoes_sistema e bloqueia sessão sem vínculo válido',
    `noDirectNotifInsert=${!hasDirectNotifInsert}, authBlockedReason=${hasAuthBlockedReason}`
  );

  return {
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    results,
  };
}
