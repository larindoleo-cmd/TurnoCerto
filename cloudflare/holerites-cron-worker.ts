/**
 * Cloudflare Worker (Cron Trigger) para publicação agendada de holerites.
 * Executa a cada 5 minutos e aciona a Edge Function segura no Supabase.
 */

export interface WorkerEnv {
  SUPABASE_PUBLISH_HOLERITES_URL: string;
  CRON_SECRET: string;
}

export async function triggerScheduledPayslips(env: WorkerEnv): Promise<Response> {
  if (!env.SUPABASE_PUBLISH_HOLERITES_URL || !env.CRON_SECRET) {
    return new Response('Missing Worker secrets', { status: 500 });
  }

  return fetch(env.SUPABASE_PUBLISH_HOLERITES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.CRON_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ source: 'cloudflare-cron', triggeredAt: new Date().toISOString() }),
  });
}

export default {
  async scheduled(_controller: unknown, env: WorkerEnv): Promise<void> {
    const res = await triggerScheduledPayslips(env);
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Scheduled payslip dispatch failed (${res.status}): ${msg}`);
    }
  },
};
