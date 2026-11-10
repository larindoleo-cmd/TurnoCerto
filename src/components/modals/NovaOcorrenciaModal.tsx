import React, { useState } from 'react';
import { X, FileWarning } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CondominioPosto, Ocorrencia } from '../../types';

interface NovaOcorrenciaModalProps {
  posto?: CondominioPosto;
  onClose: () => void;
}

export const NovaOcorrenciaModal: React.FC<NovaOcorrenciaModalProps> = ({ posto, onClose }) => {
  const { condominios, criarOcorrencia } = useApp();

  const [selectedPostoId, setSelectedPostoId] = useState<string>(
    posto ? posto.id : condominios[0]?.id || ''
  );
  const [tipo, setTipo] = useState<Ocorrencia['tipo']>('Posto Descoberto');
  const [urgencia, setUrgencia] = useState<Ocorrencia['urgencia']>('alta');
  const [descricao, setDescricao] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPostoId || !descricao.trim()) return;

    criarOcorrencia({
      postoId: selectedPostoId,
      tipo,
      descricao: descricao.trim(),
      urgencia,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full sm:max-w-md flex flex-col rounded-t-3xl sm:rounded-2xl bg-[#0B132B] border border-slate-700/60 shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-250">
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400">
              <FileWarning className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Registrar Ocorrência</h2>
              <p className="text-[11px] text-slate-400">Anotação no livro de supervisão operacional</p>
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
            <label className="block text-slate-300 font-semibold mb-1">Condomínio / Posto</label>
            <select
              value={selectedPostoId}
              onChange={(e) => setSelectedPostoId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
            >
              {condominios.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Tipo de Evento</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as Ocorrencia['tipo'])}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
              >
                <option value="Posto Descoberto">Posto Descoberto</option>
                <option value="Atraso">Atraso na Rendição</option>
                <option value="Falta de Material">Falta de Material / EPI</option>
                <option value="Manutenção em Portão">Manutenção em Portão / CFTV</option>
                <option value="Ronda">Ronda Operacional</option>
                <option value="Ponto Divergente">Ponto Divergente</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Urgência</label>
              <select
                value={urgencia}
                onChange={(e) => setUrgencia(e.target.value as Ocorrencia['urgencia'])}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
              >
                <option value="alta">Alta (Crítica)</option>
                <option value="media">Média</option>
                <option value="baixa">Baixa / Rotina</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Descrição do Ocorrido</label>
            <textarea
              rows={3}
              required
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva detalhadamente o evento, providências tomadas ou pendências..."
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
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
              className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 font-semibold text-white shadow-lg shadow-red-600/30 active:scale-95 transition-all"
            >
              Gravar Ocorrência
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
