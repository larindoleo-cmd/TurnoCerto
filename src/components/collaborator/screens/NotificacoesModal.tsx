import React from 'react';
import {
  X,
  Bell,
  Calendar,
  FileText,
  Clock,
  CheckCircle2,
  ChevronRight,
  Building2,
  ShieldAlert,
  Check,
} from 'lucide-react';
import { NotificacaoColaborador, CollaboratorTabType, CondominioPosto } from '../../../types';

interface NotificacoesModalProps {
  isOpen: boolean;
  notificacoes: NotificacaoColaborador[];
  condominio?: CondominioPosto;
  onClose: () => void;
  onNavigateTab: (tab: CollaboratorTabType) => void;
  onMarcarComoLida: (id: string) => void;
  onMarcarTodasComoLidas?: () => void;
}

export const NotificacoesModal: React.FC<NotificacoesModalProps> = ({
  isOpen,
  notificacoes,
  condominio,
  onClose,
  onNavigateTab,
  onMarcarComoLida,
  onMarcarTodasComoLidas,
}) => {
  if (!isOpen) return null;

  const getIcon = (tipo: string) => {
    switch (tipo) {
      case 'holerite':
        return <FileText className="w-4 h-4 text-emerald-400" />;
      case 'escala':
        return <Calendar className="w-4 h-4 text-blue-400" />;
      case 'ponto':
        return <Clock className="w-4 h-4 text-amber-400" />;
      case 'geral':
      default:
        return <Bell className="w-4 h-4 text-purple-400" />;
    }
  };

  const unreadCount = notificacoes.filter((n) => !n.lida).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-3xl bg-[#091029] border border-blue-500/35 p-5 shadow-2xl text-slate-100 space-y-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Central de Notificações</h3>
              <p className="text-[10px] text-slate-400">
                {unreadCount > 0 ? `${unreadCount} não lida${unreadCount > 1 ? 's' : ''}` : 'Todas lidas'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Marcar todas como lidas */}
        {unreadCount > 0 && onMarcarTodasComoLidas && (
          <div className="flex justify-end">
            <button
              onClick={onMarcarTodasComoLidas}
              className="text-[11px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Marcar todas como lidas</span>
            </button>
          </div>
        )}

        {/* Lista de Notificações */}
        <div className="space-y-2 flex-1 overflow-y-auto pr-1">
          {notificacoes.length > 0 ? (
            notificacoes.map((notif) => (
              <div
                key={notif.id}
                onClick={() => {
                  onMarcarComoLida(notif.id);
                  if (notif.linkDestino) {
                    onNavigateTab(notif.linkDestino);
                    onClose();
                  }
                }}
                className={`p-3 rounded-2xl border transition-all text-xs cursor-pointer flex items-start gap-3 relative ${
                  notif.lida
                    ? 'bg-slate-900/60 border-slate-800/80 text-slate-300'
                    : 'bg-blue-950/30 border-blue-500/40 text-white shadow-md'
                }`}
              >
                {!notif.lida && (
                  <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                )}

                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 shrink-0 mt-0.5">
                  {getIcon(notif.tipo)}
                </div>

                <div className="min-w-0 flex-1 pr-3">
                  <div className="flex items-center justify-between gap-1">
                    <strong className="text-white text-xs truncate block">{notif.titulo}</strong>
                  </div>

                  <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                    {notif.mensagem}
                  </p>

                  <div className="flex items-center gap-2 mt-2 pt-1 border-t border-slate-800/60 text-[10px] text-slate-400">
                    <span className="font-mono">{notif.dataHora}</span>
                    {condominio && (
                      <span className="flex items-center gap-1 truncate text-slate-300">
                        <Building2 className="w-3 h-3 text-blue-400 shrink-0" />
                        <span className="truncate">{condominio.nome}</span>
                      </span>
                    )}
                  </div>
                </div>

                {notif.linkDestino && (
                  <ChevronRight className="w-4 h-4 text-slate-500 shrink-0 mt-1" />
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-8 space-y-2">
              <Bell className="w-8 h-8 text-slate-600 mx-auto opacity-50" />
              <p className="text-xs text-slate-400">Nenhuma notificação no momento.</p>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer transition-colors"
        >
          Fechar
        </button>
      </div>
    </div>
  );
};
