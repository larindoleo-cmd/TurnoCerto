import React from 'react';
import {
  Building2,
  Building,
  Home,
  TreePine,
  Shield,
  Landmark,
  Castle,
  Warehouse,
  Hotel,
  Compass,
  Sparkles,
  Key,
  LucideIcon,
} from 'lucide-react';

export interface CondoIconOption {
  id: string;
  label: string;
  icon: LucideIcon;
}

export interface CondoColorOption {
  id: string;
  name: string;
  hex: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
}

export const CONDOMINIO_ICONS: CondoIconOption[] = [
  { id: 'Building2', label: 'Edifício Residencial', icon: Building2 },
  { id: 'Building', label: 'Torre / Prédio', icon: Building },
  { id: 'Home', label: 'Casas / Vila', icon: Home },
  { id: 'TreePine', label: 'Parque / Verde', icon: TreePine },
  { id: 'Shield', label: 'Segurança / Guarita', icon: Shield },
  { id: 'Landmark', label: 'Empresarial / Centro', icon: Landmark },
  { id: 'Castle', label: 'Alto Padrão / Mansões', icon: Castle },
  { id: 'Warehouse', label: 'Industrial / Galpão', icon: Warehouse },
  { id: 'Hotel', label: 'Hotelaria / Flat', icon: Hotel },
  { id: 'Compass', label: 'Polo / Hub', icon: Compass },
  { id: 'Sparkles', label: 'Exclusivo / Premium', icon: Sparkles },
  { id: 'Key', label: 'Portaria Controlada', icon: Key },
];

export const CONDOMINIO_COLORS: CondoColorOption[] = [
  {
    id: 'blue',
    name: 'Azul Safira',
    hex: '#3B82F6',
    bgClass: 'bg-blue-500/15',
    borderClass: 'border-blue-500/40',
    textClass: 'text-blue-400',
  },
  {
    id: 'emerald',
    name: 'Esmeralda',
    hex: '#10B981',
    bgClass: 'bg-emerald-500/15',
    borderClass: 'border-emerald-500/40',
    textClass: 'text-emerald-400',
  },
  {
    id: 'purple',
    name: 'Roxo Violeta',
    hex: '#8B5CF6',
    bgClass: 'bg-purple-500/15',
    borderClass: 'border-purple-500/40',
    textClass: 'text-purple-400',
  },
  {
    id: 'amber',
    name: 'Âmbar Dourado',
    hex: '#F59E0B',
    bgClass: 'bg-amber-500/15',
    borderClass: 'border-amber-500/40',
    textClass: 'text-amber-400',
  },
  {
    id: 'red',
    name: 'Rubi Carmim',
    hex: '#EF4444',
    bgClass: 'bg-red-500/15',
    borderClass: 'border-red-500/40',
    textClass: 'text-red-400',
  },
  {
    id: 'pink',
    name: 'Rosa Magenta',
    hex: '#EC4899',
    bgClass: 'bg-pink-500/15',
    borderClass: 'border-pink-500/40',
    textClass: 'text-pink-400',
  },
  {
    id: 'cyan',
    name: 'Ciano Oceano',
    hex: '#06B6D4',
    bgClass: 'bg-cyan-500/15',
    borderClass: 'border-cyan-500/40',
    textClass: 'text-cyan-400',
  },
  {
    id: 'orange',
    name: 'Laranja Coral',
    hex: '#F97316',
    bgClass: 'bg-orange-500/15',
    borderClass: 'border-orange-500/40',
    textClass: 'text-orange-400',
  },
  {
    id: 'teal',
    name: 'Turquesa',
    hex: '#14B8A6',
    bgClass: 'bg-teal-500/15',
    borderClass: 'border-teal-500/40',
    textClass: 'text-teal-400',
  },
  {
    id: 'indigo',
    name: 'Índigo Noite',
    hex: '#6366F1',
    bgClass: 'bg-indigo-500/15',
    borderClass: 'border-indigo-500/40',
    textClass: 'text-indigo-400',
  },
];

const ICON_MAP: Record<string, LucideIcon> = {
  Building2,
  Building,
  Home,
  TreePine,
  Shield,
  Landmark,
  Castle,
  Warehouse,
  Hotel,
  Compass,
  Sparkles,
  Key,
};

export function getCondoIconComponent(iconName?: string): LucideIcon {
  if (iconName && ICON_MAP[iconName]) {
    return ICON_MAP[iconName];
  }
  return Building2;
}

export function getCondoColorDef(hexOrId?: string): CondoColorOption {
  if (!hexOrId) return CONDOMINIO_COLORS[0];
  const found =
    CONDOMINIO_COLORS.find((c) => c.hex.toLowerCase() === hexOrId.toLowerCase()) ||
    CONDOMINIO_COLORS.find((c) => c.id === hexOrId);
  return (
    found || {
      id: 'custom',
      name: 'Customizada',
      hex: hexOrId,
      bgClass: 'bg-blue-500/15',
      borderClass: 'border-blue-500/40',
      textClass: 'text-blue-400',
    }
  );
}

interface CondominioBadgeProps {
  icone?: string;
  cor?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  showLabel?: boolean;
  label?: string;
}

export const CondominioBadge: React.FC<CondominioBadgeProps> = ({
  icone,
  cor,
  size = 'md',
  className = '',
  showLabel = false,
  label,
}) => {
  const IconComp = getCondoIconComponent(icone);
  const colorDef = getCondoColorDef(cor);

  const sizeClasses = {
    xs: 'w-5 h-5 rounded-md text-[10px]',
    sm: 'w-6 h-6 rounded-lg text-xs',
    md: 'w-8 h-8 rounded-xl text-sm',
    lg: 'w-10 h-10 rounded-2xl text-base',
  }[size];

  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  }[size];

  return (
    <div
      style={{
        backgroundColor: `${colorDef.hex}22`,
        borderColor: `${colorDef.hex}55`,
        color: colorDef.hex,
      }}
      className={`border flex items-center justify-center shrink-0 shadow-sm transition-transform ${sizeClasses} ${className}`}
      title={colorDef.name}
    >
      <IconComp className={iconSizes} style={{ color: colorDef.hex }} />
    </div>
  );
};

interface CondominioIconSelectorProps {
  selectedIcon: string;
  selectedColor: string;
  onChangeIcon: (iconId: string) => void;
  onChangeColor: (colorHex: string) => void;
}

export const CondominioIconSelector: React.FC<CondominioIconSelectorProps> = ({
  selectedIcon,
  selectedColor,
  onChangeIcon,
  onChangeColor,
}) => {
  const currentColorDef = getCondoColorDef(selectedColor);
  const CurrentIconComp = getCondoIconComponent(selectedIcon);

  return (
    <div className="space-y-3 p-3.5 rounded-2xl bg-gradient-to-b from-[#09112A] to-[#070D1F] border border-blue-500/30">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-white block">
            Identidade Visual & Cor do Condomínio
          </span>
          <span className="text-[10px] text-slate-400 block">
            Este ícone aparecerá no card de ponto e marcará os dias de serviço no calendário
          </span>
        </div>

        {/* Live Preview do Selo */}
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800">
          <div
            style={{
              backgroundColor: `${currentColorDef.hex}25`,
              borderColor: `${currentColorDef.hex}60`,
              color: currentColorDef.hex,
            }}
            className="w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 shadow-inner"
          >
            <CurrentIconComp className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-bold text-white">{currentColorDef.name}</span>
        </div>
      </div>

      {/* Paleta de Cores */}
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
          1. Selecionar Cor de Destaque:
        </label>
        <div className="flex items-center gap-2 flex-wrap">
          {CONDOMINIO_COLORS.map((col) => {
            const isSelected = selectedColor.toLowerCase() === col.hex.toLowerCase();
            return (
              <button
                key={col.id}
                type="button"
                onClick={() => onChangeColor(col.hex)}
                className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                  isSelected
                    ? 'ring-2 ring-white scale-110 shadow-lg'
                    : 'opacity-70 hover:opacity-100 hover:scale-105'
                }`}
                style={{ backgroundColor: col.hex }}
                title={col.name}
              >
                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white shadow" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Seletor de Ícones */}
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
          2. Selecionar Ícone Representativo:
        </label>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
          {CONDOMINIO_ICONS.map((item) => {
            const Icon = item.icon;
            const isSelected = selectedIcon === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeIcon(item.id)}
                className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600/25 border-blue-400 text-white shadow-md'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850'
                }`}
                title={item.label}
              >
                <Icon
                  className="w-4 h-4"
                  style={{ color: isSelected ? currentColorDef.hex : undefined }}
                />
                <span className="text-[9px] truncate w-full text-center block">
                  {item.label.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
