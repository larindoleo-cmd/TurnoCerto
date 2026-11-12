/**
 * Supabase Edge Function: publish-scheduled-holerites
 * Invocada via cron (Supabase pg_cron / Cloudflare Cron Worker) para publicar lotes
 * de holerites agendados em America/Sao_Paulo sem depender de navegador aberto.
 *
 * Variáveis de ambiente obrigatórias no Supabase Secrets:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - CRON_SECRET
 */

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  Deno.serve(async (req: Request): Promise<Response> => {
    if (req.method !== 'POST' && req.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const cronSecret = Deno.env.get('CRON_SECRET') || '';
    const authHeader = req.headers.get('Authorization') || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    if (!cronSecret || !bearerToken || !timingSafeCompare(bearerToken, cronSecret)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Missing Supabase server configuration' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/publicar_lotes_holerites_agendados`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({}),
    });

    const bodyText = await rpcResponse.text();
    if (!rpcResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to run scheduled payslip publisher', details: bodyText }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(bodyText, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
}
