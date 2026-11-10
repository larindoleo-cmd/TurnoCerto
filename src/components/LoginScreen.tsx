import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  LogIn,
  Key,
  Database,
  Building,
  UserCheck,
  Sparkles,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const LoginScreen: React.FC = () => {
  const { login, colaboradores, setTrocarSenhaModalOpen, setSupabaseModalOpen } = useApp();

  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario.trim()) {
      setErro('Informe seu e-mail, CPF ou matrícula de colaborador.');
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

  const handleQuickLogin = (email: string, senhaPadrao = 'Turno@2026') => {
    setUsuario(email);
    setSenha(senhaPadrao);
    setErro(null);
  };

  // Find Laurindo if registered, or first collaborators
  const laurindo = colaboradores.find((c) => c.nome.toLowerCase().includes('laurindo'));
  const quickColabs = [
    {
      nome: 'Caetano (Controle Total)',
      cargo: 'Administrador Geral Master',
      email: 'caetano.adm@turnocerto.com.br',
      role: 'admin',
      senhaPadrao: '6814871984@Lm',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      badge: 'ADMIN TOTAL',
    },
    {
      nome: 'Supervisora Silva',
      cargo: 'Supervisão Operacional',
      email: 'supervisor@turnocerto.com.br',
      role: 'supervisor',
      senhaPadrao: 'Turno@2026',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      badge: 'SUPERVISÃO',
    },
    {
      nome: laurindo ? laurindo.nome : 'Laurindo Caetano do Carmo',
      cargo: laurindo?.funcao || 'Porteiro Líder',
      email: laurindo?.email || 'laurindo.carmo@turnocerto.com.br',
      role: 'funcionario',
      senhaPadrao: 'Turno@2026',
      avatar: laurindo?.foto || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      badge: 'PORTARIA',
    },
    {
      nome: 'Carlos Eduardo Santos',
      cargo: 'Porteiro Líder',
      email: 'carlos.santos@turnocerto.com.br',
      role: 'funcionario',
      senhaPadrao: 'Turno@2026',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      badge: 'PORTARIA',
    },
  ];

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
              v2.6
            </span>
          </h1>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Plataforma Integrada de Gestão de Escalas, Postos de Trabalho e RH Terceirizado
          </p>
        </div>

        {/* Login Box */}
        <div className="rounded-3xl bg-[#091029]/90 border border-blue-500/30 p-6 sm:p-7 shadow-2xl backdrop-blur-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <LogIn className="w-4 h-4 text-blue-400" />
                <span>Acesso ao Sistema</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Digite suas credenciais para entrar no seu painel
              </p>
            </div>
            <button
              onClick={() => setSupabaseModalOpen(true)}
              className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-1 rounded-lg border border-emerald-500/30 transition-colors"
              title="Status do Banco Supabase"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Supabase</span>
            </button>
          </div>

          {erro && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{erro}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Usuário / E-mail / CPF */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                E-mail, CPF ou Matrícula
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  placeholder="Ex: supervisor@turnocerto.com.br ou 000.000.000-00"
                  className="w-full pl-9 pr-3.5 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs font-mono"
                />
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Senha */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-300 font-semibold">
                  Senha de Acesso
                </label>
                <button
                  type="button"
                  onClick={() => setTrocarSenhaModalOpen(true)}
                  className="text-[11px] text-blue-400 hover:text-blue-300 font-medium hover:underline flex items-center gap-1"
                >
                  <Key className="w-3 h-3" />
                  <span>Trocar Senha</span>
                </button>
              </div>
              <div className="relative">
                <input
                  type={showSenha ? 'text' : 'password'}
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Sua senha ou senha provisória"
                  className="w-full pl-9 pr-9 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs font-mono"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <button
                  type="button"
                  onClick={() => setShowSenha(!showSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  title={showSenha ? 'Ocultar' : 'Ver'}
                >
                  {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Botão Entrar */}
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
          </form>

          {/* Quick Demo Accounts */}
          <div className="pt-2 border-t border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Acesso Rápido de Demonstração:</span>
              </span>
              <span className="text-[10px] text-slate-500">Clique para preencher</span>
            </div>

            <div className="space-y-1.5">
              {quickColabs.map((qc, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleQuickLogin(qc.email, qc.senhaPadrao)}
                  className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-left transition-all group cursor-pointer ${
                    qc.role === 'admin'
                      ? 'bg-gradient-to-r from-amber-500/10 via-blue-600/10 to-indigo-600/10 border-amber-500/40 hover:border-amber-400/70 shadow-lg shadow-amber-500/5'
                      : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800 hover:border-blue-500/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={qc.avatar}
                      alt={qc.nome}
                      className={`w-8 h-8 rounded-lg object-cover border ${
                        qc.role === 'admin' ? 'border-amber-400/60 ring-2 ring-amber-400/20' : 'border-slate-700'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-200 group-hover:text-blue-300 block truncate">
                          {qc.nome}
                        </span>
                        {qc.badge && (
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wider shrink-0 ${
                              qc.role === 'admin'
                                ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                                : qc.role === 'supervisor'
                                ? 'bg-blue-400/20 text-blue-300 border border-blue-400/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {qc.badge}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 block truncate font-mono">
                        {qc.cargo} · {qc.email}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-1 rounded-lg font-bold shrink-0 transition-colors ${
                      qc.role === 'admin'
                        ? 'bg-amber-500 text-slate-950 group-hover:bg-amber-400 shadow-sm'
                        : 'bg-slate-800 text-slate-300 group-hover:bg-blue-600 group-hover:text-white'
                    }`}
                  >
                    Usar
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] text-slate-500 space-y-1">
          <p>TurnoCerto Gestão de Terceirização e Escalas Ltda.</p>
          <p className="flex items-center justify-center gap-1 text-[10px] text-slate-600">
            <Building className="w-3 h-3" />
            <span>Portaria Virtual · Controle de Acesso · Rondas · Holerite CLT</span>
          </p>
        </div>
      </div>
    </div>
  );
};
