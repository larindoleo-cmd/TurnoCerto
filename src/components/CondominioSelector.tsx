import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Building2, CheckCircle2, AlertTriangle, XCircle, Filter } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CondominioBadge } from './common/CondominioBadge';

export const CondominioSelector: React.FC = () => {
  const { condominios, selectedCondominioId, setSelectedCondominioId } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedCondo = condominios.find((c) => c.id === selectedCondominioId);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const totalPostos = condominios.length;
  const postosComAtencao = condominios.filter((c) => c.status !== 'operacional').length;

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Botão estilo pílula/card largo solicitado na especificação */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-[#0B132B]/90 hover:bg-[#0E1A38] border border-blue-500/20 hover:border-blue-500/40 transition-all text-left shadow-lg shadow-black/30 active:scale-[0.99] min-h-[52px]"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {selectedCondominioId === 'todos' ? (
            <span className="text-base shrink-0">🏢</span>
          ) : (
            <CondominioBadge
              icone={selectedCondo?.icone}
              cor={selectedCondo?.cor}
              size="xs"
              showLabel={false}
            />
          )}
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-semibold text-white truncate">
              {selectedCondominioId === 'todos'
                ? 'Todos os Condomínios'
                : selectedCondo?.nome}
              <span className="text-slate-400 font-normal ml-1.5 hidden sm:inline">
                — {selectedCondominioId === 'todos' ? 'Visualizando todos os condomínios' : `${selectedCondo?.bairro} · ${selectedCondo?.vagasContratadas} vagas`}
              </span>
            </p>
            <p className="text-[11px] text-slate-400 truncate sm:hidden">
              {selectedCondominioId === 'todos'
                ? 'Visualizando todos os condomínios'
                : `${selectedCondo?.bairro} · ${selectedCondo?.status === 'operacional' ? '🟢 Operacional' : '🟡 Atenção'}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 text-slate-400">
          {selectedCondominioId === 'todos' ? (
            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {totalPostos} postos
            </span>
          ) : (
            <span
              className={`w-2 h-2 rounded-full ${
                selectedCondo?.status === 'operacional' ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
          )}
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-400' : ''}`}
          />
        </div>
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute top-full left-0 right-0 mt-2 z-50 glass-dropdown rounded-2xl p-2 shadow-2xl max-h-80 overflow-y-auto no-scrollbar border border-slate-700/80 animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {/* Opção: Todos os Condomínios */}
          <button
            type="button"
            onClick={() => {
              setSelectedCondominioId('todos');
              setIsOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left transition-colors ${
              selectedCondominioId === 'todos'
                ? 'bg-blue-600/25 text-white font-medium border border-blue-500/40'
                : 'text-slate-300 hover:bg-slate-800/80'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-base">🏢</span>
              <div>
                <p className="text-xs font-bold text-white">Todos os Condomínios</p>
                <p className="text-[11px] text-slate-400">Visualizando todos os condomínios ({totalPostos} unidades)</p>
              </div>
            </div>
            {postosComAtencao > 0 && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                {postosComAtencao} atenção
              </span>
            )}
          </button>

          <div className="my-1.5 border-t border-slate-800" />

          {/* Lista dos condomínios individuais */}
          {condominios.length === 0 ? (
            <div className="px-3.5 py-4 text-center text-slate-400 text-xs">
              Nenhum condomínio cadastrado ainda.
            </div>
          ) : (
            condominios.map((condo) => {
              const isSelected = selectedCondominioId === condo.id;
              const isOperacional = condo.status === 'operacional';
              const isCritico = condo.status === 'critico';

              return (
                <button
                  key={condo.id}
                  type="button"
                  onClick={() => {
                    setSelectedCondominioId(condo.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left transition-colors mb-1 ${
                    isSelected
                      ? 'bg-blue-600/25 text-white font-medium border border-blue-500/40'
                      : 'text-slate-300 hover:bg-slate-800/80'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <CondominioBadge icone={condo.icone} cor={condo.cor} size="xs" showLabel={false} />
                      <p className="text-xs font-semibold text-slate-100 truncate">{condo.nome}</p>
                      <span className="text-[10px]">
                        {isOperacional ? '🟢' : isCritico ? '🔴' : '🟡'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate pl-6">
                      {condo.bairro} · {condo.vagasContratadas} vagas ({condo.coberturaPercentual}% cobertura)
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
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
