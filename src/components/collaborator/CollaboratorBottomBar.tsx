import React from 'react';
import {
  Clock,
  Calendar,
  ClipboardList,
  FolderLock,
  User,
} from 'lucide-react';
import { CollaboratorTabType } from '../../types';

interface CollaboratorBottomBarProps {
  activeTab: CollaboratorTabType;
  onChangeTab: (tab: CollaboratorTabType) => void;
  unreadCount?: number;
}

export const CollaboratorBottomBar: React.FC<CollaboratorBottomBarProps> = ({
  activeTab,
  onChangeTab,
}) => {
  const tabs = [
    {
      id: 'meu_turno' as CollaboratorTabType,
      label: 'Meu Turno',
      icon: Clock,
    },
    {
      id: 'minha_escala' as CollaboratorTabType,
      label: 'Minha Escala',
      icon: Calendar,
    },
    {
      id: 'meus_registros' as CollaboratorTabType,
      label: 'Registros',
      icon: ClipboardList,
    },
    {
      id: 'documentos' as CollaboratorTabType,
      label: 'Documentos',
      icon: FolderLock,
    },
    {
      id: 'meu_perfil' as CollaboratorTabType,
      label: 'Meu Perfil',
      icon: User,
    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#070B19]/95 backdrop-blur-xl border-t border-slate-800/80 px-2 py-1.5 pb-safe"
      role="navigation"
      aria-label="Navegação do Funcionário"
    >
      <div className="max-w-md mx-auto grid grid-cols-5 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all cursor-pointer ${
                isActive
                  ? 'text-blue-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div
                className={`w-9 h-7 rounded-xl flex items-center justify-center transition-all ${
                  isActive
                    ? 'bg-blue-600/20 border border-blue-500/40 text-blue-400 shadow-md shadow-blue-500/10 scale-105'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-full">
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 w-3 h-0.5 rounded-full bg-blue-500 shadow-sm shadow-blue-400" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
