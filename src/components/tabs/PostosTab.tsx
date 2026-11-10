import React, { useState } from 'react';
import {
  MapPin,
  Building,
  Users,
  Clock,
  ShieldCheck,
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  Plus,
  Search,
  Pencil,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CondominioBadge } from '../common/CondominioBadge';

export const PostosTab: React.FC = () => {
  const {
    condominios,
    colaboradores,
    openPosto360,
    openSubstituicaoModal,
    openNovoCondominioModal,
    openEditarCondominioModal,
  } = useApp();
  const [filterStatus, setFilterStatus] = useState<'todos' | 'operacional' | 'atencao'>('todos');
  const [search, setSearch] = useState('');

  const filtered = condominios.filter((c) => {
    if (filterStatus === 'operacional' && c.status !== 'operacional') return false;
    if (filterStatus === 'atencao' && c.status === 'operacional') return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        c.nome.toLowerCase().includes(q) ||
        c.bairro.toLowerCase().includes(q) ||
        c.cidade.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4 pb-20 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-400" />
            Condomínios & Postos Terceirizados
          </h2>
          <p className="text-xs text-slate-400">
            {condominios.length} unidades sob gestão ativa · Toque para Painel 360°
          </p>
        </div>

        <button
          onClick={() => openNovoCondominioModal()}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 rounded-xl shadow-lg shadow-blue-600/30 active:scale-95 transition-all self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Novo Condomínio</span>
        </button>
      </div>

      {/* Filter Chips & Search */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setFilterStatus('todos')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
              filterStatus === 'todos'
                ? 'bg-blue-600 text-white font-semibold'
                : 'bg-slate-900 text-slate-300 border border-slate-800'
            }`}
          >
            Todos ({condominios.length})
          </button>
          <button
            onClick={() => setFilterStatus('operacional')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
              filterStatus === 'operacional'
                ? 'bg-emerald-600 text-white font-semibold'
                : 'bg-slate-900 text-slate-300 border border-slate-800'
            }`}
          >
            Operacionais ({condominios.filter((c) => c.status === 'operacional').length})
          </button>
          <button
            onClick={() => setFilterStatus('atencao')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
              filterStatus === 'atencao'
                ? 'bg-red-600 text-white font-semibold'
                : 'bg-slate-900 text-slate-300 border border-slate-800'
            }`}
          >
            Com Pendência ({condominios.filter((c) => c.status !== 'operacional').length})
          </button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome do condomínio, bairro ou cidade..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900/80 border border-slate-700/60 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Postos Grid */}
      {filtered.length === 0 ? (
        <div className="p-8 text-center glass-panel rounded-2xl text-slate-400 space-y-3 border border-slate-800">
          <Building className="w-10 h-10 mx-auto text-slate-500" />
          <p className="text-sm font-semibold text-slate-200">Nenhum condomínio cadastrado</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Cadastre os postos de trabalho e condomínios clientes para iniciar a escala e alocação da equipe.
          </p>
          <button
            onClick={() => openNovoCondominioModal()}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all shadow-md inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Cadastrar Primeiro Condomínio</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((condo) => {
          const isOperacional = condo.status === 'operacional';
          const isCritico = condo.status === 'critico';
          const equipe = colaboradores.filter((c) => c.condominioId === condo.id);
          const emPostoCount = equipe.filter((c) => c.status === 'no_posto').length;

          return (
            <div
              key={condo.id}
              onClick={() => openPosto360(condo)}
              className="glass-panel glass-panel-hover rounded-2xl p-4 cursor-pointer flex flex-col justify-between gap-3 active:scale-[0.99] transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <CondominioBadge icone={condo.icone} cor={condo.cor} size="xs" showLabel={false} />
                      <h3 className="text-sm font-bold text-white truncate">{condo.nome}</h3>
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isOperacional ? 'bg-emerald-400' : isCritico ? 'bg-red-400' : 'bg-amber-400'
                        }`}
                      />
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {condo.endereco}, {condo.bairro} · {condo.cidade}
                    </p>
                  </div>

                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 ${
                      isOperacional
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : isCritico
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {isOperacional ? 'Operacional' : isCritico ? 'Crítico' : 'Atenção'}
                  </span>
                </div>

                {condo.motivoAtencao && (
                  <div className="mt-2.5 p-2.5 rounded-xl bg-red-950/40 border border-red-500/30 flex items-center justify-between gap-2">
                    <p className="text-xs text-red-300 truncate">{condo.motivoAtencao}</p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openSubstituicaoModal(condo);
                      }}
                      className="px-2 py-1 text-[10px] font-bold text-white bg-red-600 rounded-lg hover:bg-red-500 shrink-0"
                    >
                      Cobrir Posto
                    </button>
                  </div>
                )}
              </div>

              {/* Specs & Plantão Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-2 border-t border-slate-800/80">
                <div>
                  <span className="text-slate-400 block text-[10px]">Contrato</span>
                  <span className="text-slate-200 font-medium font-mono text-[11px]">
                    {condo.contratoNumero}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Ocupação</span>
                  <span className="text-slate-200 font-medium">
                    {emPostoCount}/{condo.vagasContratadas} postos
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Escala</span>
                  <span className="text-slate-200 font-medium truncate block">
                    {condo.tipoEscalaPadrao}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Raio GPS</span>
                  <span className="text-emerald-400 font-medium font-mono text-[11px] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span>±{condo.raioGpsMetros || 150}m</span>
                  </span>
                </div>
              </div>

              {/* Team preview */}
              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs">
                <div className="flex items-center -space-x-1.5 overflow-hidden">
                  {equipe.slice(0, 4).map((c) => (
                    <img
                      key={c.id}
                      src={c.foto}
                      alt={c.nome}
                      title={`${c.nome} (${c.funcao})`}
                      className="inline-block w-6 h-6 rounded-full ring-2 ring-[#0B132B] object-cover"
                    />
                  ))}
                  {equipe.length > 4 && (
                    <div className="w-6 h-6 rounded-full bg-slate-800 ring-2 ring-[#0B132B] text-[9px] text-slate-300 flex items-center justify-center font-bold">
                      +{equipe.length - 4}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditarCondominioModal(condo);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold transition-colors"
                    title="Editar informações do condomínio"
                  >
                    <Pencil className="w-3 h-3 text-blue-400" />
                    <span>Editar</span>
                  </button>

                  <span className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    Painel 360°
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
};
