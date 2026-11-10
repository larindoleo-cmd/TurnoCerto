import React, { useState } from 'react';
import {
  ClipboardCheck,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  AlertTriangle,
  Receipt,
  FileQuestion,
  Filter,
  Send,
  X,
  MapPin,
  Fingerprint,
} from 'lucide-react';
import {
  Colaborador,
  CondominioPosto,
  PontoEvento,
  PontoRegistro,
} from '../../../types';
import { CondominioBadge } from '../../common/CondominioBadge';

interface MeusRegistrosScreenProps {
  colaborador: Colaborador;
  posto: CondominioPosto;
  eventos: PontoEvento[];
  pontosHistoricos: PontoRegistro[];
  onVerComprovante: (evento: PontoEvento) => void;
}

export const MeusRegistrosScreen: React.FC<MeusRegistrosScreenProps> = ({
  colaborador,
  posto,
  eventos,
  pontosHistoricos,
  onVerComprovante,
}) => {
  const [filterType, setFilterType] = useState<'todos' | 'pontos' | 'escalas'>('todos');
  const [periodo, setPeriodo] = useState<'hoje' | 'semana' | 'mes'>('mes');
  const [correcaoModalOpen, setCorrecaoModalOpen] = useState(false);
  const [dataCorrecao, setDataCorrecao] = useState('2026-04-15');
  const [tipoCorrecao, setTipoCorrecao] = useState('esquecimento');
  const [justificativa, setJustificativa] = useState('');
  const [enviadoSucesso, setEnviadoSucesso] = useState(false);

  const handleEnviarCorrecao = (e: React.FormEvent) => {
    e.preventDefault();
    if (!justificativa.trim()) return;
    setEnviadoSucesso(true);
    setTimeout(() => {
      setEnviadoSucesso(false);
      setCorrecaoModalOpen(false);
      setJustificativa('');
    }, 2000);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-blue-400" />
            <span>Meus Registros de Ponto</span>
          </h2>
          <p className="text-xs text-slate-400">
            Espelho digital e histórico de batidas com biometria e GPS
          </p>
        </div>

        <button
          onClick={() => setCorrecaoModalOpen(true)}
          className="px-3 py-1.5 rounded-xl bg-blue-600/15 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
        >
          <FileQuestion className="w-3.5 h-3.5" />
          <span>Solicitar Correção</span>
        </button>
      </div>

      {/* Resumo do Espelho */}
      <div className="grid grid-cols-4 gap-2">
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-2.5 text-center">
          <span className="text-[10px] text-slate-400 block font-medium">Previstas</span>
          <span className="text-sm font-extrabold text-white block mt-0.5 font-mono">180h</span>
        </div>
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-2.5 text-center">
          <span className="text-[10px] text-slate-400 block font-medium">Cumpridas</span>
          <span className="text-sm font-extrabold text-emerald-400 block mt-0.5 font-mono">176h</span>
        </div>
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-2.5 text-center" title="Folgas Trabalhadas em plantões">
          <span className="text-[10px] text-slate-400 block font-medium">Plantões FT</span>
          <span className="text-sm font-extrabold text-amber-400 block mt-0.5 font-mono">2 FTs</span>
        </div>
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-2.5 text-center">
          <span className="text-[10px] text-slate-400 block font-medium">Atrasos</span>
          <span className="text-sm font-extrabold text-slate-300 block mt-0.5 font-mono">00:00</span>
        </div>
      </div>

      {/* Filtros de Tipo e Período */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Filtro por Categoria */}
        <div className="flex bg-slate-900/90 p-1 rounded-2xl border border-slate-800 flex-1">
          <button
            onClick={() => setFilterType('todos')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              filterType === 'todos' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilterType('pontos')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              filterType === 'pontos' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Pontos
          </button>
          <button
            onClick={() => setFilterType('escalas')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              filterType === 'escalas' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Escalas
          </button>
        </div>

        {/* Filtro por Período */}
        <div className="flex bg-slate-900/90 p-1 rounded-2xl border border-slate-800 shrink-0">
          <button
            onClick={() => setPeriodo('hoje')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              periodo === 'hoje' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Hoje
          </button>
          <button
            onClick={() => setPeriodo('semana')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              periodo === 'semana' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Semana
          </button>
          <button
            onClick={() => setPeriodo('mes')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              periodo === 'mes' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Mês
          </button>
        </div>
      </div>

      {/* Lista de Batidas Registradas */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
          Histórico Cronológico de Batidas
        </h3>

        {/* Eventos Biométricos Recentes */}
        {eventos.map((ev) => (
          <div
            key={ev.id}
            className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-950/30 via-slate-900/90 to-slate-900 border border-blue-500/25 flex items-center justify-between gap-3 text-xs shadow-md"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-white block truncate">
                    {ev.labelEvento}
                  </span>
                  {ev.isCobertura && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold uppercase border border-amber-500/30">
                      Cobertura
                    </span>
                  )}
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-mono font-bold">
                    {new Date(ev.serverTimestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-300 mt-0.5 truncate">
                  <CondominioBadge
                    icone={ev.condominioIcone || posto.icone}
                    cor={ev.condominioCor || posto.cor}
                    size="xs"
                    showLabel={false}
                  />
                  <span className="truncate font-medium">{ev.condominioNome}</span>
                  {ev.postoOriginalNome && ev.postoOriginalNome !== ev.condominioNome && (
                    <span className="text-slate-400 text-[10px] truncate">
                      (Origem: {ev.postoOriginalNome})
                    </span>
                  )}
                  <span>·</span>
                  <span className="text-emerald-400 flex items-center gap-1 shrink-0">
                    <Fingerprint className="w-3 h-3" />
                    <span>GPS ±{ev.accuracyM || 12}m</span>
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => onVerComprovante(ev)}
              className="px-2.5 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-[11px] font-bold shrink-0 transition-colors cursor-pointer flex items-center gap-1"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Recibo</span>
            </button>
          </div>
        ))}

        {/* Histórico Consolidado de Jornadas Anteriores */}
        {pontosHistoricos.map((pto) => (
          <div
            key={pto.id}
            className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-slate-200 block truncate">
                  {pto.data} · Escala cumprida ({pto.totalHoras})
                </span>
                <span className="text-[10px] text-slate-400 font-mono block truncate">
                  Entrada: {pto.entrada1} | Almoço: {pto.saida1} às {pto.entrada2} | Saída: {pto.saida2}
                </span>
              </div>
            </div>

            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 shrink-0">
              {pto.statusPonto}
            </span>
          </div>
        ))}
      </div>

      {/* Modal: Solicitar Correção de Ponto */}
      {correcaoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-[#091029] border border-blue-500/30 p-5 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <FileQuestion className="w-4 h-4 text-blue-400" />
                <span>Solicitar Ajuste / Correção de Ponto</span>
              </h3>
              <button
                onClick={() => setCorrecaoModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {enviadoSucesso ? (
              <div className="text-center py-6 space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <h4 className="text-sm font-bold text-white">Solicitação Encaminhada!</h4>
                <p className="text-xs text-slate-400">
                  Sua justificativa foi registrada com sucesso para o setor de RH.
                </p>
              </div>
            ) : (
              <form onSubmit={handleEnviarCorrecao} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Data da Batida a Corrigir
                  </label>
                  <input
                    type="date"
                    required
                    value={dataCorrecao}
                    onChange={(e) => setDataCorrecao(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Tipo de Divergência
                  </label>
                  <select
                    value={tipoCorrecao}
                    onChange={(e) => setTipoCorrecao(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="esquecimento">Esquecimento de registro</option>
                    <option value="divergencia_horario">Divergência de horário registrado</option>
                    <option value="problema_dispositivo">Problema técnico no smartphone</option>
                    <option value="servico_externo">Ronda externa / Atendimento emergencial</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Justificativa Detalhada
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={justificativa}
                    onChange={(e) => setJustificativa(e.target.value)}
                    placeholder="Descreva o que ocorreu com o horário exato pretendido..."
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setCorrecaoModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Enviar</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
