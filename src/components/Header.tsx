import React, { useState, useRef, useEffect } from 'react';
import { ShieldCheck, Bell, Settings, Download, Database, Key, LogOut, ChevronDown } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface HeaderProps {
  onOpenInstall?: () => void;
  isInstallable?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onOpenInstall, isInstallable }) => {
  const {
    alertas,
    condominios,
    colaboradores,
    solicitacoesBiometria,
    notificacoesSistema,
    setNotificationModalOpen,
    setSupabaseModalOpen,
    empresaInfo,
    currentUser,
    logout,
    setTrocarSenhaModalOpen,
  } = useApp();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  // Alertas operacionais prioritários: Postos Descobertos, Faltas e Solicitações de Biometria
  const postosDescobertosCount = condominios.filter((c) => c.status === 'critico').length;
  const faltasCount = colaboradores.filter((c) => c.status === 'falta').length;
  const biometriasPendentesCount = solicitacoesBiometria.filter((s) => s.status === 'pendente').length;
  const pendenciasCriticas = alertas.filter(
    (a) => !a.resolvido && (a.gravidade === 'critica' || a.gravidade === 'moderada')
  ).length;
  const notifsNaoLidasCount = notificacoesSistema.filter(
    (n) => !n.lida && (!n.destinatarioRole || n.destinatarioRole === currentUser?.role || currentUser?.role === 'admin')
  ).length;

  const temAlertaOperacional = postosDescobertosCount > 0 || faltasCount > 0 || biometriasPendentesCount > 0;
  const totalAlertasOperacionais = postosDescobertosCount + faltasCount + pendenciasCriticas + biometriasPendentesCount + notifsNaoLidasCount;

  return (
    <header className="sticky top-0 z-30 bg-[#060913]/95 backdrop-blur-md border-b border-slate-800/80 px-3.5 sm:px-4 py-2.5 transition-all">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-2.5">
        {/* Lado esquerdo: Logotipo */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 via-blue-500 to-emerald-500 p-0.5 shadow-md shadow-blue-500/20 shrink-0 flex items-center justify-center">
            <div className="w-full h-full bg-[#0A1024] rounded-[10px] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-blue-400" />
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold tracking-tight text-white truncate leading-tight flex items-center gap-1.5">
              <span>{currentUser?.role === 'rh' ? 'Gestão RH & Folha' : 'Gestão Operacional'}</span>
            </h1>
            <p className="text-[11px] text-slate-400 truncate leading-tight">
              {empresaInfo?.nomeFantasia || 'TurnoCerto'}
            </p>
          </div>
        </div>

        {/* Lado direito */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {import.meta.env.DEV && (
            <button
              onClick={() => setSupabaseModalOpen(true)}
              title="Diagnóstico Supabase"
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl transition-colors active:scale-95"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>Supabase</span>
            </button>
          )}

          {/* Botão Direto: Trocar Senha */}
          <button
            onClick={() => setTrocarSenhaModalOpen(true)}
            title="Trocar Senha de Acesso"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-blue-300 hover:text-white bg-blue-600/15 hover:bg-blue-600/30 border border-blue-500/30 rounded-xl transition-all active:scale-95 cursor-pointer"
          >
            <Key className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Trocar Senha</span>
          </button>

          {/* Botão Direto: Deslogar */}
          <button
            onClick={logout}
            title="Deslogar / Sair da Conta"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-red-400 hover:text-red-200 bg-red-950/30 hover:bg-red-900/40 border border-red-500/30 rounded-xl transition-all active:scale-95 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Deslogar</span>
          </button>

          {isInstallable && (
            <button
              onClick={onOpenInstall}
              title="Instalar Aplicativo no Celular"
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PWA</span>
            </button>
          )}

          {/* Notificações e Alertas Operacionais (Sino) */}
          <button
            onClick={() => setNotificationModalOpen(true)}
            title={
              temAlertaOperacional
                ? `${postosDescobertosCount} posto(s) descoberto(s) · ${faltasCount} falta(s) hoje`
                : totalAlertasOperacionais > 0
                ? `${totalAlertasOperacionais} pendência(s) registrada(s)`
                : 'Central de Notificações e Alertas'
            }
            className={`relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl transition-all active:scale-95 cursor-pointer ${
              temAlertaOperacional
                ? 'bg-red-500/20 text-red-300 border border-red-500/60 shadow-lg shadow-red-500/30'
                : 'text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60'
            }`}
            aria-label="Notificações e Alertas Operacionais"
          >
            <Bell
              className={`w-4 h-4 transition-transform ${
                temAlertaOperacional ? 'text-red-400 animate-bounce' : 'text-slate-300'
              }`}
            />
            {totalAlertasOperacionais > 0 && (
              <span
                className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white rounded-full flex items-center justify-center shadow-lg ${
                  temAlertaOperacional
                    ? 'bg-red-600 shadow-red-600/60 animate-pulse'
                    : 'bg-blue-600 shadow-blue-600/40'
                }`}
              >
                {totalAlertasOperacionais}
              </span>
            )}
          </button>

          {/* Menu Dropdown de Perfil do Usuário */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-1.5 p-1 sm:px-2 sm:py-1 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 transition-all active:scale-95 cursor-pointer"
              title="Menu de Perfil do Usuário"
              aria-expanded={userMenuOpen}
            >
              <div className="relative">
                {currentUser?.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.nome}
                    className="w-7 h-7 rounded-lg object-cover border border-blue-500/40"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-[11px] font-bold text-blue-200">
                    {(currentUser?.nome || 'U').slice(0, 2).toUpperCase()}
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-slate-900" />
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform hidden sm:block ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-[#091026] border border-blue-500/30 shadow-2xl overflow-hidden py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-xs">
                <div className="px-3.5 py-2.5 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-white block truncate">
                        {currentUser?.nome}
                      </span>
                      <span className="text-[10px] text-blue-300 font-mono block truncate">
                        {currentUser?.email}
                      </span>
                      {currentUser?.role === 'admin' ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 inline-flex items-center gap-1 font-bold mt-0.5">
                          <ShieldCheck className="w-2.5 h-2.5 text-amber-400" />
                          <span>Administrador</span>
                        </span>
                      ) : (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 inline-block mt-0.5">
                          {currentUser?.role === 'supervisor' ? 'Supervisor' : currentUser?.role === 'rh' ? 'Recursos Humanos' : 'Funcionário'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Opções */}
                <div className="p-1.5 space-y-0.5">
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      setTrocarSenhaModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-200 hover:text-white hover:bg-blue-600/20 transition-colors text-left cursor-pointer"
                  >
                    <Key className="w-4 h-4 text-blue-400" />
                    <div className="min-w-0">
                      <span className="font-semibold block">Trocar Senha</span>
                      <span className="text-[10px] text-slate-400 block">Alterar credencial de acesso</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      setSupabaseModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-200 hover:text-white hover:bg-slate-800 transition-colors text-left cursor-pointer"
                  >
                    <Database className="w-4 h-4 text-emerald-400" />
                    <div className="min-w-0">
                      <span className="font-semibold block">Banco de Dados Supabase</span>
                      <span className="text-[10px] text-slate-400 block">Diagnóstico e tabelas</span>
                    </div>
                  </button>
                </div>

                <div className="border-t border-slate-800 p-1.5">
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-red-400 hover:text-red-200 hover:bg-red-950/40 transition-colors text-left cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-red-400" />
                    <div className="min-w-0">
                      <span className="font-semibold block">Deslogar do Sistema</span>
                      <span className="text-[10px] text-red-400/70 block">Encerrar sessão ativa</span>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
