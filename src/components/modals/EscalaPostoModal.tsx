import React, { useState } from 'react';
import { X, CalendarDays, Clock, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { CondominioPosto } from '../../types';
import { useApp } from '../../context/AppContext';

interface EscalaPostoModalProps {
  posto?: CondominioPosto;
  onClose: () => void;
}

export const EscalaPostoModal: React.FC<EscalaPostoModalProps> = ({ posto, onClose }) => {
  const { condominios, colaboradores } = useApp();
  const currentPosto = posto || condominios[0];
  const equipe = colaboradores.filter((c) => c.condominioId === currentPosto?.id);

  const diasDaSemana = [
    { dia: 'Seg 03', turnos: ['Diurno (07-19): Antônio C.', 'Noturno (19-07): Marcos V.'] },
    { dia: 'Ter 04', turnos: ['Diurno (07-19): Fabiana R.', 'Noturno (19-07): Carlos P.'] },
    { dia: 'Qua 05', turnos: ['Diurno (07-19): Antônio C.', 'Noturno (19-07): Marcos V.'] },
    { dia: 'Qui 06', turnos: ['Diurno (07-19): Fabiana R.', 'Noturno (19-07): Carlos P.'] },
    { dia: 'Sex 07 (Hoje)', turnos: ['Diurno (07-19): Plantão Ativo', 'Noturno (19-07): Rendição 19h'] },
    { dia: 'Sáb 08', turnos: ['Diurno (07-19): Fabiana R.', 'Noturno (19-07): Carlos P.'] },
    { dia: 'Dom 09', turnos: ['Diurno (07-19): Antônio C.', 'Noturno (19-07): Marcos V.'] },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full sm:max-w-xl max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-[#0B132B] border border-slate-700/60 shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-250">
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <CalendarDays className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Escala Operacional do Posto</h2>
              <p className="text-[11px] text-slate-400">{currentPosto?.nome}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 no-scrollbar text-xs">
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Padrão da Escala</span>
              <p className="text-sm font-bold text-white">{currentPosto?.tipoEscalaPadrao}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400">Vagas Contratadas</span>
              <p className="text-sm font-bold text-emerald-400 font-mono">{currentPosto?.vagasContratadas} postos</p>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              Grade Semanal de Plantões (Novembro/2026)
            </span>
            <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
              {diasDaSemana.map((item, idx) => (
                <div key={idx} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="font-semibold text-slate-200 min-w-[90px]">{item.dia}</div>
                  <div className="space-y-1">
                    {item.turnos.map((t, tidx) => (
                      <span
                        key={tidx}
                        className="inline-block text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 mr-2 border border-slate-700/60"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 space-y-1.5">
            <span className="text-xs font-bold text-slate-300">Equipe Designada:</span>
            <div className="flex flex-wrap gap-2">
              {equipe.map((e) => (
                <span key={e.id} className="text-[11px] px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300">
                  {e.nome} ({e.funcao})
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-900/80 border-t border-slate-800 shrink-0 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-xl"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
