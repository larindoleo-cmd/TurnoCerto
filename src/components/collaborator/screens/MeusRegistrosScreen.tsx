import React, { useState, useMemo } from 'react';
import {
  ClipboardCheck,
  CheckCircle2,
  Clock,
  Receipt,
  FileQuestion,
  Send,
  X,
  Fingerprint,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import {
  Colaborador,
  CondominioPosto,
  PontoEvento,
  PontoRegistro,
  SolicitacaoCorrecaoPonto,
} from '../../../types';
import { CondominioBadge } from '../../common/CondominioBadge';
import { computeColaboradorMetrics } from './IndicadorDetalheModal';

interface MeusRegistrosScreenProps {
  colaborador: Colaborador;
  posto: CondominioPosto;
  eventos: PontoEvento[];
  pontosHistoricos: PontoRegistro[];
  solicitacoesCorrecao?: SolicitacaoCorrecaoPonto[];
  onSolicitarCorrecao?: (dados: {
    colaboradorId: string;
    colaboradorNome: string;
    dataPonto: string;
    tipoCorrecao: SolicitacaoCorrecaoPonto['tipoCorrecao'];
    justificativa: string;
  }) => Promise<{ success: boolean; message: string }>;
  onVerComprovante: (evento: PontoEvento) => void;
}

function getTodayIsoSP(): string {
  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function getEventDayIsoSP(iso: string): string {
  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

export const MeusRegistrosScreen: React.FC<MeusRegistrosScreenProps> = ({
  colaborador,
  posto,
  eventos,
  pontosHistoricos,
  solicitacoesCorrecao = [],
  onSolicitarCorrecao,
  onVerComprovante,
}) => {
  const [filterType, setFilterType] = useState<'todos' | 'pontos' | 'solicitacoes'>('todos');
  const [periodo, setPeriodo] = useState<'hoje' | 'semana' | 'mes'>('mes');
  const [correcaoModalOpen, setCorrecaoModalOpen] = useState(false);
  const [dataCorrecao, setDataCorrecao] = useState(getTodayIsoSP);
  const [tipoCorrecao, setTipoCorrecao] =
    useState<SolicitacaoCorrecaoPonto['tipoCorrecao']>('esquecimento');
  const [justificativa, setJustificativa] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [enviadoSucesso, setEnviadoSucesso] = useState(false);

  const metrics = useMemo(
    () => computeColaboradorMetrics(colaborador, pontosHistoricos, eventos),
    [colaborador, pontosHistoricos, eventos]
  );

  const expectedHours = colaborador.tipoEscala === '12x36' ? '180h' : '220h';

  const todayIso = getTodayIsoSP();
  const monthPrefix = todayIso.slice(0, 7);
  const sevenDaysAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const filteredEventos = useMemo(() => {
    return eventos.filter((ev) => {
      const evDay = getEventDayIsoSP(ev.serverTimestamp);
      if (periodo === 'hoje') return evDay === todayIso;
      if (periodo === 'semana') return new Date(ev.serverTimestamp).getTime() >= sevenDaysAgoMs;
      return evDay.startsWith(monthPrefix);
    });
  }, [eventos, periodo, todayIso, monthPrefix, sevenDaysAgoMs]);

  const handleEnviarCorrecao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!justificativa.trim() || !onSolicitarCorrecao) return;
    setEnviando(true);
    setErroEnvio(null);
    const res = await onSolicitarCorrecao({
      colaboradorId: colaborador.id,
      colaboradorNome: colaborador.nome,
      dataPonto: dataCorrecao,
      tipoCorrecao,
      justificativa: justificativa.trim(),
    });
    setEnviando(false);
    if (!res.success) {
      setErroEnvio(res.message);
      return;
    }
    setEnviadoSucesso(true);
    setJustificativa('');
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-blue-400" />
            <span>Meus Registros de Ponto</span>
          </h2>
          <p className="text-xs text-slate-400">
            Espelho digital e histórico real de batidas com biometria e GPS
          </p>
        </div>

        <button
          onClick={() => {
            setEnviadoSucesso(false);
            setErroEnvio(null);
            setCorrecaoModalOpen(true);
          }}
          className="px-3 py-1.5 rounded-xl bg-blue-600/15 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 shrink-0"
        >
          <FileQuestion className="w-3.5 h-3.5" />
          <span>Solicitar Correção</span>
        </button>
      </div>

      {/* Resumo Real do Espelho */}
      <div className="grid grid-cols-4 gap-2">
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-2.5 text-center">
          <span className="text-[10px] text-slate-400 block font-medium">Previstas</span>
          <span className="text-sm font-extrabold text-white block mt-0.5 font-mono">{expectedHours}</span>
        </div>
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-2.5 text-center">
          <span className="text-[10px] text-slate-400 block font-medium">Cumpridas</span>
          <span className="text-sm font-extrabold text-emerald-400 block mt-0.5 font-mono">
            {metrics.horasTrabalhadasLabel}
          </span>
        </div>
        <div
          className="rounded-2xl bg-slate-900/80 border border-slate-800 p-2.5 text-center"
          title="Folgas Trabalhadas em plantões"
        >
          <span className="text-[10px] text-slate-400 block font-medium">Plantões FT</span>
          <span className="text-sm font-extrabold text-amber-400 block mt-0.5 font-mono">
            {metrics.plantoesFT} FT
          </span>
        </div>
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-2.5 text-center">
          <span className="text-[10px] text-slate-400 block font-medium">Atrasos</span>
          <span className="text-sm font-extrabold text-slate-300 block mt-0.5 font-mono">
            {metrics.atrasosCount}
          </span>
        </div>
      </div>

      {/* Filtros de Categoria e Período */}
      <div className="flex flex-col sm:flex-row gap-2">
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
            Batidas ({filteredEventos.length})
          </button>
          <button
            onClick={() => setFilterType('solicitacoes')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              filterType === 'solicitacoes'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Ajustes ({solicitacoesCorrecao.length})
          </button>
        </div>

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
            7 dias
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

      {/* Lista de Solicitações de Correção/Ajuste */}
      {(filterType === 'todos' || filterType === 'solicitacoes') && solicitacoesCorrecao.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
            Solicitações de Correção e Ajuste
          </h3>
          {solicitacoesCorrecao.map((sc) => (
            <div
              key={sc.id}
              className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1.5 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <strong className="text-white font-mono">
                  {sc.dataPonto} · {sc.tipoCorrecao.replace(/_/g, ' ')}
                </strong>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    sc.status === 'aprovado'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : sc.status === 'rejeitado'
                      ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {sc.status}
                </span>
              </div>
              <p className="text-[11px] text-slate-300">{sc.justificativa}</p>
              {sc.respostaRH && (
                <p className="text-[11px] text-blue-300 bg-blue-950/30 border border-blue-500/20 rounded-xl px-2.5 py-1.5">
                  Resposta RH: {sc.respostaRH}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lista de Batidas Registradas */}
      {(filterType === 'todos' || filterType === 'pontos') && (
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
            Histórico Cronológico de Batidas
          </h3>

          {filteredEventos.length === 0 && pontosHistoricos.length === 0 && (
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-400">
              Nenhuma batida ou registro encontrado para o período selecionado.
            </div>
          )}

          {filteredEventos.map((ev) => (
            <div
              key={ev.id}
              className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-950/30 via-slate-900/90 to-slate-900 border border-blue-500/25 flex items-center justify-between gap-3 text-xs shadow-md"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                    ev.verificationStatus === 'confirmado'
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                      : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                  }`}
                >
                  {ev.verificationStatus === 'confirmado' ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-white block truncate">{ev.labelEvento}</span>
                    {ev.classificacaoPosto === 'divergencia_posto' && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold uppercase border border-amber-500/30">
                        Divergência Posto
                      </span>
                    )}
                    {(ev.classificacaoPosto === 'cobertura_programada' ||
                      ev.classificacaoPosto === 'extra_programada') && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-bold uppercase border border-indigo-500/30">
                        {ev.classificacaoPosto === 'extra_programada' ? 'Extra/FT' : 'Cobertura'}
                      </span>
                    )}
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-mono font-bold">
                      {new Intl.DateTimeFormat('pt-BR', {
                        timeZone: 'America/Sao_Paulo',
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(new Date(ev.serverTimestamp))}
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
                        (Base: {ev.postoOriginalNome})
                      </span>
                    )}
                    <span>·</span>
                    <span className="text-emerald-400 flex items-center gap-1 shrink-0">
                      <Fingerprint className="w-3 h-3" />
                      <span>
                        {ev.accuracyM ? `GPS ±${ev.accuracyM}m` : 'Exceção'}
                      </span>
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
                    {pto.data} · Total: {pto.totalHoras}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono block truncate">
                    Entrada: {pto.entrada1} | Intervalo: {pto.saida1} às {pto.entrada2} | Saída: {pto.saida2}
                  </span>
                </div>
              </div>

              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 shrink-0">
                {pto.statusPonto}
              </span>
            </div>
          ))}
        </div>
      )}

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
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {enviadoSucesso ? (
              <div className="text-center py-6 space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <h4 className="text-sm font-bold text-white">Solicitação Persistida!</h4>
                <p className="text-xs text-slate-400">
                  Sua justificativa foi salva no servidor e encaminhada ao setor de RH.
                </p>
                <button
                  onClick={() => setCorrecaoModalOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <form onSubmit={handleEnviarCorrecao} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Data da Batida a Corrigir</label>
                  <input
                    type="date"
                    required
                    value={dataCorrecao}
                    onChange={(e) => setDataCorrecao(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Tipo de Divergência</label>
                  <select
                    value={tipoCorrecao}
                    onChange={(e) =>
                      setTipoCorrecao(e.target.value as SolicitacaoCorrecaoPonto['tipoCorrecao'])
                    }
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="esquecimento">Esquecimento de registro</option>
                    <option value="divergencia_horario">Divergência de horário registrado</option>
                    <option value="problema_dispositivo">Problema técnico no smartphone</option>
                    <option value="servico_externo">Ronda externa / Atendimento emergencial</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Justificativa Detalhada</label>
                  <textarea
                    required
                    rows={3}
                    value={justificativa}
                    onChange={(e) => setJustificativa(e.target.value)}
                    placeholder="Descreva o que ocorreu com o horário exato pretendido..."
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                {erroEnvio && (
                  <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-[11px]">
                    {erroEnvio}
                  </div>
                )}

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
                    disabled={enviando || !justificativa.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-bold shadow-lg shadow-blue-600/30 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {enviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>{enviando ? 'Enviando...' : 'Enviar'}</span>
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
