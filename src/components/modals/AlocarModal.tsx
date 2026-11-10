import React, { useState } from 'react';
import { X, UserPlus, ShieldCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CondominioPosto } from '../../types';

interface AlocarModalProps {
  posto?: CondominioPosto;
  onClose: () => void;
}

export const AlocarModal: React.FC<AlocarModalProps> = ({ posto, onClose }) => {
  const { condominios, colaboradores, alocarColaborador } = useApp();

  const [selectedPostoId, setSelectedPostoId] = useState<string>(
    posto ? posto.id : condominios[0]?.id || ''
  );

  // Available staff (volantes or currently unassigned or from other posts)
  const candidatos = colaboradores;
  const [selectedColabId, setSelectedColabId] = useState<string>(candidatos[0]?.id || '');
  const [jornada, setJornada] = useState<string>('12x36 (07:00 - 19:00)');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPostoId || !selectedColabId) return;
    alocarColaborador(selectedPostoId, selectedColabId, jornada);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full sm:max-w-md flex flex-col rounded-t-3xl sm:rounded-2xl bg-[#0B132B] border border-blue-500/30 shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-250">
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Alocar Funcionário</h2>
              <p className="text-[11px] text-slate-400">Vincular colaborador a uma unidade</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Selecione o Condomínio</label>
            <select
              value={selectedPostoId}
              onChange={(e) => setSelectedPostoId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
            >
              {condominios.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} ({c.vagasContratadas} vagas)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Selecione o Colaborador</label>
            <select
              value={selectedColabId}
              onChange={(e) => setSelectedColabId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
            >
              {candidatos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} — {c.funcao} ({c.postoNome})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Jornada / Turno</label>
            <select
              value={jornada}
              onChange={(e) => setJornada(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
            >
              <option value="12x36 (07:00 - 19:00)">12x36 Diurno (07:00 - 19:00)</option>
              <option value="12x36 (19:00 - 07:00)">12x36 Noturno (19:00 - 07:00)</option>
              <option value="44h (08:00 - 17:00)">44h Comercial (08:00 - 17:00)</option>
              <option value="6x1 (06:00 - 14:20)">6x1 Manhã (06:00 - 14:20)</option>
            </select>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-white shadow-lg shadow-blue-600/30 active:scale-95 transition-all"
            >
              Confirmar Alocação
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
