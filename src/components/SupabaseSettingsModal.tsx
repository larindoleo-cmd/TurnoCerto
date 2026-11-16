import React, { useState, useEffect } from 'react';
import { X, Database, CheckCircle2, AlertCircle, RefreshCw, Shield, AlertTriangle, Terminal } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getStoredSupabaseConfig, saveStoredSupabaseConfig, testSupabaseConnection } from '../lib/supabase';

export const SupabaseSettingsModal: React.FC = () => {
  const { supabaseModalOpen, setSupabaseModalOpen, syncWithSupabase, isSyncing, showToast } = useApp();

  const stored = getStoredSupabaseConfig();
  const [url, setUrl] = useState(stored.url);
  const [anonKey, setAnonKey] = useState(stored.anonKey);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (supabaseModalOpen) {
      const cfg = getStoredSupabaseConfig();
      setUrl(cfg.url);
      setAnonKey(cfg.anonKey);
      testSupabaseConnection(cfg.url, cfg.anonKey).then((res) => {
        setTestResult(res);
      });
    }
  }, [supabaseModalOpen]);

  if (!supabaseModalOpen) return null;

  const handleSave = () => {
    saveStoredSupabaseConfig(url, anonKey);
    showToast('Configuração do Supabase salva com sucesso!');
  };

  const handleTest = async () => {
    if (!url || !anonKey) {
      setTestResult({ success: false, message: 'Preencha a URL e a Anon Key antes de testar.' });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    const result = await testSupabaseConnection(url, anonKey);
    setIsTesting(false);
    setTestResult(result);
    if (result.success) {
      handleSave();
    }
  };

  const migrationSequence = [
    'supabase/migrations/20261114100001_ponto_schema_geofence_serverside.sql',
    'supabase/migrations/20261114100002_coberturas_conflitos_substituicao.sql',
    'supabase/migrations/20261114100003_rls_security_hardening_v2.sql',
    'supabase/migrations/20261114100004_storage_documentos_pedidos_rh.sql',
    'supabase/migrations/20261114100005_holerites_ciencia_cron_hardening.sql',
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full sm:max-w-xl max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-[#0B132B] border border-slate-700/60 shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-250">
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Integração Supabase Database</h2>
              <p className="text-[11px] text-slate-400">Persistência em nuvem e Row Level Security (RLS)</p>
            </div>
          </div>
          <button
            onClick={() => setSupabaseModalOpen(false)}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 text-xs no-scrollbar">
          {/* Status badge */}
          <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400" />
              <div>
                <span className="font-semibold text-slate-200 block">Modo de Operação Híbrido</span>
                <span className="text-[11px] text-slate-400">
                  Armazenamento local ativo com suporte a sincronização direta ao Supabase.
                </span>
              </div>
            </div>
          </div>

          {/* Form fields */}
          <div className="space-y-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Supabase Project URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://xyzcompany.supabase.co"
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Supabase Anon / Public API Key
              </label>
              <input
                type="password"
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 font-mono text-[11px]"
              />
            </div>
          </div>

          {/* Test connection feedback */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border flex items-start gap-2 ${
                testResult.success
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                  : 'bg-red-950/30 border-red-500/40 text-red-300'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              )}
              <span className="text-[11px]">{testResult.message}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleTest}
              disabled={isTesting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              Testar Conexão
            </button>
            <button
              onClick={syncWithSupabase}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 font-semibold transition-colors disabled:opacity-50"
            >
              <Database className="w-3.5 h-3.5" />
              {isSyncing ? 'Sincronizando...' : 'Sincronizar Dados'}
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold ml-auto transition-colors"
            >
              Salvar Credenciais
            </button>
          </div>

          {/* Instruções oficiais de migração versionada */}
          <div className="pt-2 border-t border-slate-800 space-y-2.5">
            <div className="flex items-center gap-1.5 text-slate-300 font-bold text-[11px] uppercase tracking-wider">
              <Terminal className="w-3.5 h-3.5 text-blue-400" />
              <span>Migrações Versionadas Oficiais (CLI Supabase)</span>
            </div>
            <div className="p-3 rounded-xl bg-red-950/30 border border-red-500/40 text-red-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <strong className="block text-red-300">Aviso de Segurança Operacional</strong>
                Nunca execute <code className="font-mono bg-red-950 px-1 rounded">supabase/04_SEGURANCA_E_RLS.sql</code> nem cole SQL genérico pela interface web do navegador. Aplique apenas as migrações versionadas via <code className="font-mono bg-slate-900 px-1 rounded">supabase db push</code> após backup.
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-[10px] text-slate-300 font-mono space-y-1">
              {migrationSequence.map((m) => (
                <div key={m} className="truncate text-emerald-300/90">• {m}</div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-3 bg-slate-900/80 border-t border-slate-800 shrink-0 flex justify-end">
          <button
            onClick={() => setSupabaseModalOpen(false)}
            className="px-4 py-2 text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-xl"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
