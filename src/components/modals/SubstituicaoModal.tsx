import React, { useState } from 'react';
import { X, RefreshCw, AlertTriangle, ShieldCheck, Clock, UserCheck, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CondominioPosto, Colaborador } from '../../types';

interface SubstituicaoModalProps {
  posto?: CondominioPosto;
  colaboradorFalta?: Colaborador;
  onClose: () => void;
}

export const SubstituicaoModal: React.FC<SubstituicaoModalProps> = ({
  posto,
  colaboradorFalta,
  onClose,
}) => {
  const { condominios, colaboradores, substituirColaborador } = useApp();

  const [selectedPostoId, setSelectedPostoId] = useState<string>(
    posto ? posto.id : condominios[0]?.id || ''
  );

  const targetPosto = condominios.find((c) => c.id === selectedPostoId) || posto || condominios[0];

  // Candidates for substitution:
  // 1. Volantes da Reserva (funcao === 'Volante de Cobertura' or condominioId === null)
  // 2. Colaboradores de folga no mesmo perfil
  const candidatos = colaboradores.filter(
    (c) =>
      c.status === 'folga' ||
      c.funcao === 'Volante de Cobertura' ||
      c.condominioId === null
  );

  const [selectedSubstitutoId, setSelectedSubstitutoId] = useState<string>(
    candidatos[0]?.id || ''
  );

  const handleConfirm = () => {
    if (!targetPosto || !selectedSubstitutoId) return;
    substituirColaborador(targetPosto.id, selectedSubstitutoId, colaboradorFalta?.id);
  };

  const selectedCandidate = colaboradores.find((c) => c.id === selectedSubstitutoId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full sm:max-w-lg max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-[#0B132B] border border-amber-500/30 shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-250">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Substituição Operacional Rápida</h2>
              <p className="text-[11px] text-slate-400">Despacho de Volante ou Cobertura de Posto</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 overflow-y-auto space-y-4 no-scrollbar text-sm">
          {/* Target Posto Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Posto de Destino
            </label>
            <select
              value={selectedPostoId}
              onChange={(e) => setSelectedPostoId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-400"
            >
              {condominios.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} {c.status !== 'operacional' ? `(${c.status.toUpperCase()})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Missing / Vacant reason callout */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400">Situação do Posto</span>
            <p className="text-slate-200 font-medium">
              {colaboradorFalta
                ? `Substituindo ausência de ${colaboradorFalta.nome} (${colaboradorFalta.funcao})`
                : targetPosto?.motivoAtencao || 'Cobertura preventiva de rendição de turno'}
            </p>
          </div>

          {/* Available Substitute Workers */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Volantes & Colaboradores Disponíveis ({candidatos.length})
              </label>
              <span className="text-[10px] text-emerald-400 font-medium">Prontos para acionamento</span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar">
              {candidatos.map((cand) => {
                const isSelected = selectedSubstitutoId === cand.id;
                const isVolante = cand.funcao === 'Volante de Cobertura';

                return (
                  <div
                    key={cand.id}
                    onClick={() => setSelectedSubstitutoId(cand.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500/50 shadow-md shadow-amber-500/10'
                        : 'bg-slate-900/40 border-slate-800 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={cand.foto}
                        alt={cand.nome}
                        className="w-9 h-9 rounded-full object-cover border border-slate-700 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-white truncate">{cand.nome}</p>
                          {isVolante && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                              VOLANTE
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 truncate">
                          {cand.funcao} · Matrícula: {cand.matricula}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {cand.postoNome} · Banco: {cand.bancoHoras > 0 ? `+${cand.bancoHoras}h` : `${cand.bancoHoras}h`}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isSelected ? (
                        <CheckCircle2 className="w-5 h-5 text-amber-400" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border border-slate-600" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action note */}
          {selectedCandidate && (
            <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-800/40 text-[11px] text-blue-200">
              <span className="font-semibold block mb-0.5">Impacto Operacional Imediato:</span>
              Ao confirmar, {selectedCandidate.nome} será alocado no {targetPosto.nome}, o alerta crítico será resolvido no painel e o status da unidade passará para <strong>Operacional (100% de cobertura)</strong>.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-900/80 border-t border-slate-800 shrink-0 flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 rounded-xl"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedCandidate}
            className="px-5 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all disabled:opacity-50"
          >
            Confirmar Cobertura Imediata
          </button>
        </div>
      </div>
    </div>
  );
};
