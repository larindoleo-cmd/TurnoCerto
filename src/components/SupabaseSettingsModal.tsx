import React, { useState, useEffect } from 'react';
import { X, Database, CheckCircle2, AlertCircle, RefreshCw, Copy, Check, Shield } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getStoredSupabaseConfig, saveStoredSupabaseConfig, testSupabaseConnection } from '../lib/supabase';

export const SupabaseSettingsModal: React.FC = () => {
  const { supabaseModalOpen, setSupabaseModalOpen, syncWithSupabase, isSyncing, showToast } = useApp();

  const stored = getStoredSupabaseConfig();
  const [url, setUrl] = useState(stored.url);
  const [anonKey, setAnonKey] = useState(stored.anonKey);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

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

  const sqlSchemaSnippet = `-- ================================================================================
-- TurnoCerto: Pacote Mestre de Estruturação e RLS (Executar no Supabase SQL Editor)
-- Cria: condominios, colaboradores, profiles, alertas, ocorrencias, holerites, pontos, atestados, empresa_info
-- ================================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. CONDOMÍNIOS
CREATE TABLE IF NOT EXISTS public.condominios (
  id TEXT PRIMARY KEY DEFAULT ('cond-' || substr(md5(random()::text), 1, 8)),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'Residencial',
  cnpj TEXT,
  contrato_numero TEXT,
  endereco TEXT NOT NULL DEFAULT 'Endereço não informado',
  bairro TEXT,
  cidade TEXT DEFAULT 'Não informada',
  supervisor TEXT,
  telefone_supervisor TEXT,
  vagas_contratadas INTEGER NOT NULL DEFAULT 2,
  status TEXT NOT NULL DEFAULT 'operacional',
  motivo_atencao TEXT,
  tipo_escala_padrao TEXT DEFAULT '12x36 (07:00 - 19:00)',
  cobertura_percentual INTEGER DEFAULT 100,
  contato_sindico TEXT,
  telefone_sindico TEXT,
  instrucoes_guarita TEXT,
  foto_url TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. COLABORADORES
CREATE TABLE IF NOT EXISTS public.colaboradores (
  id TEXT PRIMARY KEY DEFAULT ('colab-' || extract(epoch from now())::bigint),
  nome TEXT NOT NULL,
  full_name TEXT,
  cpf TEXT UNIQUE,
  rg TEXT,
  data_nascimento DATE,
  telefone TEXT,
  foto_url TEXT,
  matricula TEXT,
  pis TEXT,
  ctps TEXT,
  nome_mae TEXT,
  cep TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade_uf TEXT,
  endereco TEXT,
  condominio_id TEXT,
  cargo TEXT NOT NULL DEFAULT 'Porteiro',
  funcao TEXT DEFAULT 'Porteiro',
  tipo_jornada TEXT NOT NULL DEFAULT '12x36',
  jornada TEXT DEFAULT '12x36 (07:00 - 19:00)',
  turno_inicio TIME DEFAULT '07:00:00',
  turno_fim TIME DEFAULT '19:00:00',
  data_admissao DATE DEFAULT CURRENT_DATE,
  salario_base NUMERIC(10, 2) NOT NULL DEFAULT 2150.00,
  status TEXT NOT NULL DEFAULT 'no_posto',
  banco_horas NUMERIC(6, 2) DEFAULT 0.0,
  pix TEXT,
  banco TEXT DEFAULT '341 - Itaú Unibanco S.A.',
  agencia TEXT,
  conta TEXT,
  recebe_vt BOOLEAN NOT NULL DEFAULT TRUE,
  recebe_vr BOOLEAN NOT NULL DEFAULT TRUE,
  valor_vr NUMERIC(10, 2) NOT NULL DEFAULT 28.50,
  recebe_va BOOLEAN NOT NULL DEFAULT TRUE,
  valor_va NUMERIC(10, 2) NOT NULL DEFAULT 220.00,
  valor_extra_ft NUMERIC(10, 2) NOT NULL DEFAULT 160.00,
  valor_bonus NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  email TEXT,
  role TEXT DEFAULT 'funcionario',
  primeiro_acesso_concluido BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PROFILES (Espelho de Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  nome TEXT,
  full_name TEXT,
  cpf TEXT,
  cargo TEXT DEFAULT 'Porteiro',
  role TEXT DEFAULT 'funcionario',
  condominio_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. OCORRÊNCIAS
CREATE TABLE IF NOT EXISTS public.ocorrencias (
  id TEXT PRIMARY KEY DEFAULT ('ocorr-' || extract(epoch from now())::bigint),
  posto_id TEXT NOT NULL,
  posto_nome TEXT,
  tipo TEXT NOT NULL DEFAULT 'Posto Descoberto',
  descricao TEXT NOT NULL,
  registrado_por TEXT NOT NULL DEFAULT 'Sistema',
  data_hora TEXT DEFAULT ('Hoje às ' || to_char(now(), 'HH24:MI')),
  urgencia TEXT NOT NULL DEFAULT 'alta',
  resolvida BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ALERTAS OPERACIONAIS
CREATE TABLE IF NOT EXISTS public.alertas (
  id TEXT PRIMARY KEY DEFAULT ('alert-' || extract(epoch from now())::bigint),
  tipo TEXT NOT NULL DEFAULT 'posto_descoberto',
  gravidade TEXT NOT NULL DEFAULT 'critica',
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  posto_id TEXT NOT NULL,
  posto_nome TEXT,
  horario TEXT DEFAULT to_char(now(), 'HH24:MI'),
  resolvido BOOLEAN NOT NULL DEFAULT FALSE,
  resolvido_por TEXT,
  resolvido_em TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. HOLERITES
CREATE TABLE IF NOT EXISTS public.holerites (
  id TEXT PRIMARY KEY DEFAULT ('hol-' || extract(epoch from now())::bigint),
  colaborador_id TEXT NOT NULL,
  colaborador_nome TEXT NOT NULL,
  matricula TEXT,
  funcao TEXT NOT NULL DEFAULT 'Porteiro',
  mes_referencia TEXT NOT NULL,
  salario_base NUMERIC(10, 2) NOT NULL DEFAULT 2150.00,
  adicional_periculosidade NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  adicional_noturno NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  horas_extras_50 NUMERIC(6, 2) DEFAULT 0.00,
  valor_horas_extras NUMERIC(10, 2) DEFAULT 0.00,
  desconto_inss NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  desconto_fgts NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  desconto_vt NUMERIC(10, 2) DEFAULT 0.00,
  desconto_vr NUMERIC(10, 2) DEFAULT 0.00,
  bonus_assiduidade NUMERIC(10, 2) DEFAULT 0.00,
  liquido_receber NUMERIC(10, 2) NOT NULL,
  status_envio TEXT NOT NULL DEFAULT 'Pendente',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. PONTOS ELETRÔNICOS
CREATE TABLE IF NOT EXISTS public.pontos (
  id TEXT PRIMARY KEY DEFAULT ('ponto-' || extract(epoch from now())::bigint),
  colaborador_id TEXT NOT NULL,
  colaborador_nome TEXT,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  entrada_1 TEXT DEFAULT '07:00',
  saida_1 TEXT DEFAULT '12:00',
  entrada_2 TEXT DEFAULT '13:00',
  saida_2 TEXT DEFAULT '19:00',
  total_horas TEXT DEFAULT '11h 00m',
  status_ponto TEXT NOT NULL DEFAULT 'Regular',
  status TEXT DEFAULT 'Regular',
  localizacao_gps TEXT DEFAULT 'Dentro do Raio Geofence (12m)',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. ATESTADOS MÉDICOS
CREATE TABLE IF NOT EXISTS public.atestados (
  id TEXT PRIMARY KEY DEFAULT ('atest-' || extract(epoch from now())::bigint),
  colaborador_id TEXT NOT NULL,
  colaborador_nome TEXT NOT NULL,
  matricula TEXT,
  posto_nome TEXT,
  medico TEXT NOT NULL,
  crm TEXT NOT NULL,
  cid TEXT NOT NULL,
  data_inicio DATE NOT NULL,
  dias_afastamento INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'Pendente',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. EMPRESA MATRIZ
CREATE TABLE IF NOT EXISTS public.empresa_info (
  id TEXT PRIMARY KEY DEFAULT 'matriz-principal',
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  telefone TEXT,
  whatsapp TEXT,
  email TEXT,
  endereco TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  responsavel_operacional TEXT,
  cargo_responsavel TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. ROW LEVEL SECURITY (RLS) & PERMISSÕES
ALTER TABLE public.condominios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holerites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pontos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atestados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa_info ENABLE ROW LEVEL SECURITY;

-- 10. ROW LEVEL SECURITY (RLS) & ISOLAMENTO ZERO-TRUST
-- Execute a migração oficial: supabase/migrations/20261112100000_security_hardening_auth_rls.sql
ALTER TABLE public.condominios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holerites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pontos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atestados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa_info ENABLE ROW LEVEL SECURITY;

-- Revoga privilégios excessivos do papel anônimo
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;`;

  const copySql = () => {
    navigator.clipboard.writeText(sqlSchemaSnippet);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

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

          {/* Schema Snippet accordion */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                SQL Schema para o Editor do Supabase
              </span>
              <button
                onClick={copySql}
                className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300"
              >
                {copiedSql ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copiedSql ? 'Copiado!' : 'Copiar SQL'}
              </button>
            </div>
            <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-[10px] text-slate-300 font-mono overflow-x-auto max-h-36 no-scrollbar">
              {sqlSchemaSnippet}
            </pre>
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
