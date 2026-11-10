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
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return { success: false, message: 'URL deve começar com https://' };
    }
    const testClient = createClient(url, key);
    // Ping primary tables
    const { error: condoErr } = await testClient.from('condominios').select('id').limit(1);
    const { error: colabErr } = await testClient.from('colaboradores').select('id').limit(1);

    if (condoErr && colabErr) {
      if (condoErr.message.includes('API key') || condoErr.message.includes('JWT') || condoErr.code === 'PGRST301') {
        return { success: false, message: `Falha na autenticação: ${condoErr.message}` };
      }
      return { success: true, message: 'Conectado ao Supabase! (Tabelas prontas para execução do pacote SQL)' };
    }

    return { success: true, message: 'Conexão com Supabase e tabelas operacionais validada com sucesso!' };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido ao conectar com Supabase';
    return { success: false, message: errorMsg };
  }
}
