import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY_URL = 'turnocerto_supabase_url';
const STORAGE_KEY_KEY = 'turnocerto_supabase_key';

const DEFAULT_SUPABASE_URL = 'https://cyyvubiythuzhdwbuogg.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5eXZ1Yml5dGh1emhkd2J1b2dnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5NDI5OTIsImV4cCI6MjEwOTUxODk5Mn0.DMs3SiI0Mm5YeNlKdvqjlB-GVU1WPYsRgsjCcNHCCqI';

export function getStoredSupabaseConfig() {
  const storedUrl = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_URL) : null;
  const storedKey = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_KEY) : null;

  const url = (storedUrl && storedUrl.trim().length > 0)
    ? storedUrl.trim()
    : ((import.meta.env.VITE_SUPABASE_URL as string) || DEFAULT_SUPABASE_URL);

  const anonKey = (storedKey && storedKey.trim().length > 0)
    ? storedKey.trim()
    : ((import.meta.env.VITE_SUPABASE_ANON_KEY as string) || DEFAULT_SUPABASE_ANON_KEY);

  return { url, anonKey };
}

export function saveStoredSupabaseConfig(url: string, anonKey: string) {
  if (url && url.trim()) localStorage.setItem(STORAGE_KEY_URL, url.trim());
  else localStorage.removeItem(STORAGE_KEY_URL);

  if (anonKey && anonKey.trim()) localStorage.setItem(STORAGE_KEY_KEY, anonKey.trim());
  else localStorage.removeItem(STORAGE_KEY_KEY);

  supabaseInstance = null;
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getStoredSupabaseConfig();
  return Boolean(url && anonKey && url.startsWith('https://') && anonKey.length > 20);
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const { url, anonKey } = getStoredSupabaseConfig();
  if (!url || !anonKey) {
    return null;
  }
  if (supabaseInstance) {
    return supabaseInstance;
  }
  try {
    supabaseInstance = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    return supabaseInstance;
  } catch (error) {
    console.warn('Erro ao inicializar cliente Supabase:', error);
    return null;
  }
}

export async function testSupabaseConnection(url: string, key: string): Promise<{ success: boolean; message: string }> {
  try {
    const trimmedUrl = url.trim();
    const trimmedKey = key.trim();
    if (!trimmedUrl.startsWith('https://')) {
      return { success: false, message: 'URL inválida: utilize um endpoint HTTPS do projeto Supabase.' };
    }
    if (trimmedKey.length < 20) {
      return { success: false, message: 'Chave pública (Anon Key) parece incompleta.' };
    }

    const testClient = createClient(trimmedUrl, trimmedKey);
    const [{ error: condoErr }, { error: authErr }] = await Promise.all([
      testClient.from('condominios').select('id').limit(1),
      testClient.auth.getSession(),
    ]);

    if (authErr && /fetch|network|timeout/i.test(authErr.message)) {
      return { success: false, message: `Endpoint Supabase inacessível pela rede: ${authErr.message}` };
    }

    if (condoErr) {
      const msg = condoErr.message || '';
      const code = condoErr.code || '';

      if (/Failed to fetch|NetworkError|ENOTFOUND|ERR_NAME_NOT_RESOLVED/i.test(msg)) {
        return { success: false, message: `Falha de rede ao alcançar o Supabase: ${msg}` };
      }
      if (code === 'PGRST301' || /API key|JWT|Invalid authentication/i.test(msg)) {
        return { success: false, message: `Credencial inválida (URL/Anon Key rejeitada): ${msg}` };
      }
      if (code === '42P01' || code === 'PGRST205' || /relation .* does not exist|schema cache/i.test(msg)) {
        return {
          success: false,
          message: 'Projeto acessível, mas o schema/tabelas ainda não existem. Aplique as migrações via CLI (supabase db push).',
        };
      }
      if (code === '42501' || /permission denied|row-level security/i.test(msg)) {
        return {
          success: true,
          message: 'Conexão validada! RLS ativo protegendo as tabelas (faça login para carregar os dados do tenant).',
        };
      }
      return { success: false, message: `Erro ao consultar banco (${code || 'desconhecido'}): ${msg}` };
    }

    return { success: true, message: 'Conexão com Supabase e tabelas operacionais validada com sucesso!' };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido ao conectar com Supabase';
    return { success: false, message: errorMsg };
  }
}

