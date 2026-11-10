import React from 'react';
import { LayoutDashboard, Users, MapPin, Building2, FileSpreadsheet } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { TabType } from '../types';

export const BottomBar: React.FC = () => {
  const { activeTab, setActiveTab, alertas } = useApp();

  const pendenciasCriticas = alertas.filter((a) => !a.resolvido && a.gravidade === 'critica').length;

  const tabs: { id: TabType; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }[] = [
    { id: 'operacao', label: 'Operação', icon: LayoutDashboard, badge: pendenciasCriticas },
    { id: 'equipe', label: 'Equipe', icon: Users },
    { id: 'postos', label: 'Postos', icon: MapPin },
    { id: 'matriz', label: 'Matriz', icon: Building2 },
    { id: 'rh', label: 'Holerite RH', icon: FileSpreadsheet },
  ];

  return (
    <nav
      role="navigation"
      aria-label="Navegação Principal"
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#0A1024]/95 backdrop-blur-lg border-t border-slate-800/80 pb-safe"
    >
      <div className="max-w-md md:max-w-2xl mx-auto grid grid-cols-5 h-16 items-center px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex flex-col items-center justify-center h-full min-h-[44px] py-1 transition-all group select-none active:scale-95 ${
                isActive ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {/* Active top glow indicator */}
              {isActive && (
                <span className="absolute top-0 w-8 h-0.5 bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
              )}

              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive ? 'scale-110 text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'group-hover:text-slate-300'
                  }`}
                />
                {tab.badge && tab.badge > 0 ? (
                  <span className="absolute -top-1.5 -right-2 min-w-[14px] h-[14px] px-0.5 bg-red-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-1 ring-[#0A1024]">
                    {tab.badge}
                  </span>
                ) : null}
              </div>

              <span
                className={`text-[10px] tracking-tight mt-1 whitespace-nowrap transition-colors ${
                  isActive ? 'font-semibold text-white' : 'font-normal text-slate-400'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
