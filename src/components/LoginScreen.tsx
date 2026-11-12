import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  LogIn,
  Key,
  Building,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SolicitarAjudaAcessoModal } from './modals/SolicitarAjudaAcessoModal';

export const LoginScreen: React.FC = () => {
  const {
    login,
    setSupabaseModalOpen,
    setAjudaAcessoModalOpen,
  } = useApp();

  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario.trim()) {
      setErro('Informe seu e-mail corporativo cadastrado no Supabase Auth.');
      return;
    }
    if (!senha.trim()) {
      setErro('Informe sua senha cadastrada no Supabase Auth.');
      return;
    }

    setIsLoading(true);
    setErro(null);
    try {
      const res = await login(usuario, senha);
      if (!res.success) {
        setErro(res.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#050814] via-[#080E24] to-[#0A122E] flex flex-col justify-center items-center px-4 py-8 text-slate-100 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="w-full max-w-md space-y-5 animate-in fade-in duration-300">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-emerald-400 p-0.5 shadow-xl shadow-blue-600/30">
            <div className="w-full h-full bg-[#080E24] rounded-[22px] flex items-center justify-center">
              <ShieldCheck className="w-9 h-9 text-blue-400" />
            </div>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center gap-1.5">
            <span>TurnoCerto</span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              v2.7
            </span>
          </h1>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Plataforma Integrada de Gestão de Escalas, Postos de Trabalho e RH
          </p>
        </div>

        {/* Login Box */}
        <div className="rounded-3xl bg-[#091029]/90 border border-blue-500/30 p-6 sm:p-7 shadow-2xl backdrop-blur-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <LogIn className="w-4 h-4 text-blue-400" />
                <span>Acesso Autenticado</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Entre com seu e-mail corporativo e senha
              </p>
            </div>
            {import.meta.env.DEV && (
              <button
                type="button"
                onClick={() => setSupabaseModalOpen(true)}
                className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-1 rounded-lg border border-emerald-500/30 transition-colors cursor-pointer"
                title="Configurações do Banco Supabase"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Supabase</span>
              </button>
            )}
          </div>

          {erro && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{erro}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                E-mail Corporativo
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  placeholder="nome@empresa.com.br"
                  className="w-full pl-9 pr-3.5 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs font-mono"
                />
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-300 font-semibold">
                  Senha de Acesso
                </label>
                <button
                  type="button"
                  onClick={() => setAjudaAcessoModalOpen(true)}
                  className="text-[11px] text-amber-400 hover:text-amber-300 font-medium hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Key className="w-3 h-3" />
                  <span>Esqueceu a Senha?</span>
                </button>
              </div>
              <div className="relative">
                <input
                  type={showSenha ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Sua senha pessoal"
                  className="w-full pl-9 pr-9 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs font-mono"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <button
                  type="button"
                  onClick={() => setShowSenha(!showSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  title={showSenha ? 'Ocultar' : 'Ver'}
                >
                  {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white font-bold text-xs shadow-xl shadow-blue-600/30 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Verificando credenciais...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Acessar Painel</span>
                </>
              )}
            </button>

            <div className="text-center pt-0.5">
              <button
                type="button"
                onClick={() => setAjudaAcessoModalOpen(true)}
                className="text-[11px] text-slate-400 hover:text-blue-300 transition-colors inline-flex items-center gap-1.5 cursor-pointer py-1"
              >
                <span>Precisa redefinir sua senha?</span>
                <span className="text-blue-400 font-semibold underline">Recuperar Acesso</span>
              </button>
            </div>
          </form>
        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] text-slate-500 space-y-1">
          <p>TurnoCerto Gestão Operacional e Recursos Humanos</p>
          <p className="flex items-center justify-center gap-1 text-[10px] text-slate-600">
            <Building className="w-3 h-3" />
            <span>Controle de Acesso · Escalas · Ponto Digital REP-P · Folha CLT</span>
          </p>
        </div>
      </div>

      <SolicitarAjudaAcessoModal />
    </div>
  );
};
