import React, { useState } from 'react';
import {
  X,
  CalendarDays,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  History,
  AlertTriangle,
} from 'lucide-react';
import { CondominioPosto, CoberturaHistorico, TipoCobertura } from '../../types';
import { useApp } from '../../context/AppContext';
import { fetchCoberturaHistorico } from '../../services/escalaCoberturaService';

interface EscalaPostoModalProps {
  posto?: CondominioPosto;
  onClose: () => void;
}

export const EscalaPostoModal: React.FC<EscalaPostoModalProps> = ({ posto, onClose }) => {
  const {
    condominios,
    colaboradores,
    coberturasProgramadas,
    criarCobertura,
    alterarStatusCobertura,
    empresaInfo,
  } = useApp();

  const currentPosto = posto || condominios[0];
  const equipe = colaboradores.filter((c) => c.condominioId === currentPosto?.id);
  const coberturasPosto = coberturasProgramadas.filter(
    (cov) => cov.postoCoberturaId === currentPosto?.id
  );

  const todayBR = new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const [showForm, setShowForm] = useState(false);
  const [selectedColabId, setSelectedColabId] = useState(colaboradores[0]?.id || '');
  const [tipo, setTipo] = useState<TipoCobertura>('cobertura');
  const [dataInicio, setDataInicio] = useState(todayBR);
  const [dataFim, setDataFim] = useState(todayBR);
  const [horaInicio, setHoraInicio] = useState('07:00');
  const [horaFim, setHoraFim] = useState('19:00');
  const [valorExtraFT, setValorExtraFT] = useState<string>('160');
  const [motivo, setMotivo] = useState('');
  const [exigeAceite, setExigeAceite] = useState<boolean>(
    Boolean(empresaInfo.exigeAceiteCobertura)
  );
  const [formMsg, setFormMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [historicoId, setHistoricoId] = useState<string | null>(null);
  const [historicoItems, setHistoricoItems] = useState<CoberturaHistorico[]>([]);

  const handleCriar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPosto) return;
    const colab = colaboradores.find((c) => c.id === selectedColabId);
    if (!colab) return;
    setFormMsg(null);
    setSubmitting(true);
    try {
      const res = await criarCobertura({
        colaborador: colab,
        postoCobertura: currentPosto,
        tipo,
        dataInicio,
        dataFim,
        horaInicio,
        horaFim,
        motivo: motivo.trim() || undefined,
        valorExtraFT: parseFloat(valorExtraFT) || 0,
        exigeAceiteColaborador: exigeAceite,
      });
      if (res.success) {
        setShowForm(false);
        setMotivo('');
      } else {
        setFormMsg(res.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerHistorico = async (covId: string) => {
    if (historicoId === covId) {
      setHistoricoId(null);
      return;
    }
    const items = await fetchCoberturaHistorico(covId);
    setHistoricoItems(items);
    setHistoricoId(covId);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full sm:max-w-2xl max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-[#0B132B] border border-slate-700/60 shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-250">
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <CalendarDays className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Escala Habitual & Coberturas do Posto</h2>
              <p className="text-[11px] text-slate-400">{currentPosto?.nome || 'Posto não selecionado'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 no-scrollbar text-xs">
          {/* Resumo do Posto */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Padrão da Escala Habitual</span>
              <p className="text-sm font-bold text-white">{currentPosto?.tipoEscalaPadrao || '12x36'}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400">Vagas Contratadas</span>
              <p className="text-sm font-bold text-emerald-400 font-mono">{currentPosto?.vagasContratadas || 0} vagas</p>
            </div>
          </div>

          {/* Equipe Habitual Fixa do Posto */}
          <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Escala Habitual — Equipe Fixa ({equipe.length})
              </span>
              <span className="text-[10px] text-slate-400">Lotação base permanente</span>
            </div>
            {equipe.length === 0 ? (
              <p className="text-[11px] text-slate-400">Nenhum colaborador com lotação base fixa neste posto.</p>
            ) : (
              <div className="space-y-1.5">
                {equipe.map((e) => (
                  <div
                    key={e.id}
                    className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <span className="font-bold text-white block truncate">{e.nome}</span>
                      <span className="text-[10px] text-slate-400">
                        {e.funcao} · {e.jornada}
                      </span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/25 shrink-0">
                      {e.turno === 'noturno' ? 'Noturno' : 'Diurno'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Coberturas, Extras e Alocações Temporárias */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                Extras, Coberturas & Substituições ({coberturasPosto.length})
              </span>
              <button
                type="button"
                onClick={() => setShowForm((v) => !v)}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showForm ? 'Fechar Formulário' : 'Programar Cobertura/Extra'}</span>
              </button>
            </div>

            {showForm && (
              <form
                onSubmit={handleCriar}
                className="p-3.5 rounded-xl bg-blue-950/25 border border-blue-500/35 space-y-3"
              >
                <p className="text-[11px] text-blue-200">
                  Programa um plantão temporário neste posto <strong>sem alterar a lotação base</strong> do colaborador.
                </p>

                {formMsg && (
                  <div className="p-2 rounded-lg bg-red-950/50 border border-red-500/40 text-red-200 text-[11px] flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{formMsg}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] text-slate-300 font-semibold mb-1">Colaborador</label>
                    <select
                      value={selectedColabId}
                      onChange={(e) => setSelectedColabId(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                    >
                      {colaboradores.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome} ({c.postoNome})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-300 font-semibold mb-1">Tipo</label>
                    <select
                      value={tipo}
                      onChange={(e) => setTipo(e.target.value as TipoCobertura)}
                      className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                    >
                      <option value="cobertura">Cobertura Programada</option>
                      <option value="extra">Plantão Extra / FT</option>
                      <option value="substituicao">Substituição Temporária</option>
                      <option value="alocacao_temporaria">Alocação Temporária</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Data Início</label>
                    <input
                      type="date"
                      required
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Data Fim</label>
                    <input
                      type="date"
                      required
                      value={dataFim}
                      min={dataInicio}
                      onChange={(e) => setDataFim(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Hora Início</label>
                    <input
                      type="time"
                      required
                      value={horaInicio}
                      onChange={(e) => setHoraInicio(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Hora Fim</label>
                    <input
                      type="time"
                      required
                      value={horaFim}
                      onChange={(e) => setHoraFim(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-[11px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Valor Extra / FT (R$)</label>
                    <input
                      type="number"
                      step="10"
                      value={valorExtraFT}
                      onChange={(e) => setValorExtraFT(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Motivo / Observação</label>
                    <input
                      type="text"
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Ex: Cobertura férias / Reforço"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exigeAceite}
                    onChange={(e) => setExigeAceite(e.target.checked)}
                    className="rounded border-slate-600 bg-slate-900"
                  />
                  <span>Exigir aceite explícito do colaborador antes da confirmação</span>
                </label>

                <div className="flex justify-end gap-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? 'Salvando...' : 'Salvar Programação'}
                  </button>
                </div>
              </form>
            )}

            {coberturasPosto.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-center text-slate-400">
                Nenhuma cobertura ou extra programado para este posto no momento.
              </div>
            ) : (
              <div className="space-y-2">
                {coberturasPosto.map((cov) => (
                  <div
                    key={cov.id}
                    className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-white">{cov.colaboradorNome || cov.colaboradorId}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase font-bold">
                            {cov.tipo}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 font-mono mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-blue-400" />
                          <span>
                            {cov.dataInicio} a {cov.dataFim} · {cov.horaInicio} - {cov.horaFim}
                          </span>
                        </p>
                        {cov.motivo && <p className="text-[10px] text-slate-400 mt-0.5">{cov.motivo}</p>}
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          cov.status === 'aprovada' || cov.status === 'concluida'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : cov.status === 'aguardando_aceite'
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            : 'bg-red-500/15 text-red-400 border border-red-500/30'
                        }`}
                      >
                        {cov.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1.5 border-t border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => handleVerHistorico(cov.id)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] flex items-center gap-1 cursor-pointer"
                      >
                        <History className="w-3 h-3" />
                        <span>Histórico</span>
                      </button>
                      {(cov.status === 'aprovada' || cov.status === 'aguardando_aceite') && (
                        <>
                          <button
                            type="button"
                            onClick={() => alterarStatusCobertura(cov, 'concluida')}
                            className="px-2 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-[10px] flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Concluir</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => alterarStatusCobertura(cov, 'cancelada')}
                            className="px-2 py-1 rounded bg-red-600/20 hover:bg-red-600/30 text-red-300 text-[10px] flex items-center gap-1 cursor-pointer"
                          >
                            <XCircle className="w-3 h-3" />
                            <span>Cancelar</span>
                          </button>
                        </>
                      )}
                    </div>

                    {historicoId === cov.id && (
                      <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">
                          Auditoria da Cobertura
                        </span>
                        {historicoItems.length === 0 ? (
                          <p className="text-[10px] text-slate-500">Sem registros de auditoria.</p>
                        ) : (
                          historicoItems.map((h) => (
                            <div key={h.id} className="text-[10px] text-slate-300 flex justify-between gap-2">
                              <span>
                                <strong>{h.acao}</strong> ({h.atorNome || 'Sistema'}): {h.detalhes}
                              </span>
                              <span className="text-slate-500 font-mono shrink-0">
                                {new Date(h.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 bg-slate-900/80 border-t border-slate-800 shrink-0 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-xl cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
