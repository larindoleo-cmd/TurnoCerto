import React from 'react';
import { ShieldCheck, Bell } from 'lucide-react';
import { Colaborador } from '../../types';

interface CollaboratorHeaderProps {
  colaborador: Colaborador;
  unreadCount: number;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
}

export const CollaboratorHeader: React.FC<CollaboratorHeaderProps> = ({
  colaborador,
  unreadCount,
  onOpenNotifications,
  onOpenProfile,
}) => {
  const getGreeting = () => {
    // Horário oficial no fuso America/Sao_Paulo
    const horaSaoPaulo = parseInt(
      new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: 'numeric',
        hour12: false,
      }).format(new Date()),
      10
    );

    if (horaSaoPaulo >= 5 && horaSaoPaulo < 12) return 'Bom dia';
    if (horaSaoPaulo >= 12 && horaSaoPaulo < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const primeiroNome = colaborador.nome.split(' ')[0] || 'Colaborador';

  return (
    <header className="sticky top-0 z-30 bg-[#070B19]/95 backdrop-blur-md border-b border-slate-800/80 px-4 py-3">
      <div className="max-w-md mx-auto flex items-center justify-between gap-3">
        {/* Brand & Greeting */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-emerald-400 p-0.5 shadow-md shadow-blue-500/20 shrink-0 flex items-center justify-center">
            <div className="w-full h-full bg-[#080E24] rounded-[10px] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-blue-400" />
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black tracking-tight text-white">
                TurnoCerto
              </span>
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold uppercase tracking-wider">
                Colaborador
              </span>
            </div>
            <p className="text-[11px] text-slate-300 truncate">
              {getGreeting()}, <strong className="text-blue-400">{primeiroNome}</strong>!
            </p>
          </div>
        </div>

        {/* Actions: Notifications & Avatar */}
        <div className="flex items-center gap-2">
          {/* Notification Bell */}
          <button
            onClick={onOpenNotifications}
            className="relative p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white transition-all cursor-pointer active:scale-95"
            title="Notificações do Colaborador"
            aria-label="Ver notificações"
          >
            <Bell className="w-4 h-4 text-slate-300" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-600 rounded-full flex items-center justify-center shadow-lg shadow-red-600/50 animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* User Profile Thumbnail */}
          <button
            onClick={onOpenProfile}
            className="relative p-0.5 rounded-xl border border-blue-500/40 hover:border-blue-400 transition-all cursor-pointer active:scale-95"
            title="Ver meu perfil"
          >
            {colaborador.foto ? (
              <img
                src={colaborador.foto}
                alt={colaborador.nome}
                className="w-8 h-8 rounded-[10px] object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-[10px] bg-blue-600/30 text-blue-200 font-bold text-xs flex items-center justify-center">
                {colaborador.nome
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((p) => p[0]?.toUpperCase() || '')
                  .join('')}
              </div>
            )}
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#070B19] ${
                colaborador.status === 'no_posto' ? 'bg-emerald-500' : 'bg-slate-500'
              }`}
            />
          </button>
        </div>
      </div>
    </header>
  );
};
