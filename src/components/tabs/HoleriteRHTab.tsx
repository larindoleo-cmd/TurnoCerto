import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Clock,
  CheckCircle2,
  Eye,
  Search,
  Calendar,
  FileText,
  FolderCheck,
  Plus,
  Send,
  CalendarClock,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  History,
  XCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  ColaboradorDocumento,
  CoberturaHistorico,
  HoleriteRegistro,
  TipoCobertura,
} from '../../types';
import {
  criarSolicitacaoDocumentoRH,
  revisarDocumentoRH,
  getDocumentoSignedUrl,
} from '../../services/documentWorkflowService';
import {
  emitirLoteHolerites,
  publicarLoteAgora,
  retificarHolerite,
} from '../../services/holeriteWorkflowService';
import { fetchCoberturaHistorico } from '../../services/escalaCoberturaService';

type RHSubTab = 'holerites' | 'documentos' | 'coberturas' | 'pontos' | 'atestados';

export const HoleriteRHTab: React.FC = () => {
  const {
    holerites,
    setHolerites,
    holeriteLotes,
    setHoleriteLotes,
    holeriteEventos,
    pontos,
    pontoEventos,
    atestados,
    colaboradores,
    condominios,
    empresaInfo,
    currentUser,
    documentoSolicitacoes,
    setDocumentoSolicitacoes,
    colaboradorDocumentos,
    setColaboradorDocumentos,
    documentoHistorico,
    coberturasProgramadas,
    criarCobertura,
    alterarStatusCobertura,
    solicitacoesCorrecao,
    revisarSolicitacaoCorrecao,
    openHoleriteDetalhe,
    aprovarAtestado,
    recusarAtestado,
    syncWithSupabase,
    showToast,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<RHSubTab>('holerites');
  const [search, setSearch] = useState('');

  // Lote de Holerites
  const nowSP = new Date();
  const defaultComp = `${nowSP.getFullYear()}-${String(nowSP.getMonth() + 1).padStart(2, '0')}`;
  const defaultCompLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(nowSP);
  const [showLoteForm, setShowLoteForm] = useState(false);
  const [competencia, setCompetencia] = useState(defaultComp);
  const [mesRefLabel, setMesRefLabel] = useState(
    defaultCompLabel.charAt(0).toUpperCase() + defaultCompLabel.slice(1)
  );
  const [modoEmissao, setModoEmissao] = useState<'rascunho' | 'agendar' | 'publicar_agora'>('rascunho');
  const [agendadoLocal, setAgendadoLocal] = useState('');
  const [selectedColabIds, setSelectedColabIds] = useState<string[]>([]);
  const [emitindoLote, setEmitindoLote] = useState(false);

  // Retificação de Holerite
  const [retificandoHol, setRetificandoHol] = useState<HoleriteRegistro | null>(null);
  const [motivoRetif, setMotivoRetif] = useState('');
  const [novoSalarioRetif, setNovoSalarioRetif] = useState('');
  const [novoExtrasRetif, setNovoExtrasRetif] = useState('');
  const [retifLoading, setRetifLoading] = useState(false);

  // Solicitação & Revisão de Documentos RH
  const [docColabId, setDocColabId] = useState(colaboradores[0]?.id || '');
  const [docTipo, setDocTipo] = useState<ColaboradorDocumento['tipo']>('ASO / Exame');
  const [docTitulo, setDocTitulo] = useState('');
  const [docInstrucoes, setDocInstrucoes] = useState('');
  const [docPrazo, setDocPrazo] = useState('');
  const [docObrigatorio, setDocObrigatorio] = useState(true);
  const [enviandoSolDoc, setEnviandoSolDoc] = useState(false);

  const [reviewDocId, setReviewDocId] = useState<string | null>(null);
  const [reviewObs, setReviewObs] = useState('');
  const [signedLinks, setSignedLinks] = useState<Record<string, string>>({});

  // Coberturas
  const todayBR = new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(nowSP);
  const [covColabId, setCovColabId] = useState(colaboradores[0]?.id || '');
  const [covPostoId, setCovPostoId] = useState(condominios[0]?.id || '');
  const [covTipo, setCovTipo] = useState<TipoCobertura>('extra');
  const [covDataIni, setCovDataIni] = useState(todayBR);
  const [covDataFim, setCovDataFim] = useState(todayBR);
  const [covHoraIni, setCovHoraIni] = useState('07:00');
  const [covHoraFim, setCovHoraFim] = useState('19:00');
  const [covValor, setCovValor] = useState('160');
  const [covMotivo, setCovMotivo] = useState('');
  const [covAceite, setCovAceite] = useState(Boolean(empresaInfo.exigeAceiteCobertura));
  const [covHistId, setCovHistId] = useState<string | null>(null);
  const [covHistItems, setCovHistItems] = useState<CoberturaHistorico[]>([]);

  // Correções de Ponto
  const [correcaoRespId, setCorrecaoRespId] = useState<string | null>(null);
  const [correcaoObs, setCorrecaoObs] = useState('');

  const atorNome = currentUser?.nome || 'RH TurnoCerto';

  const filteredHolerites = holerites.filter((h) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      h.colaboradorNome.toLowerCase().includes(q) ||
      h.matricula.toLowerCase().includes(q) ||
      h.postoNome.toLowerCase().includes(q)
    );
  });

  const toggleColabLote = (id: string) => {
    setSelectedColabIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleEmitirLote = async (e: React.FormEvent) => {
    e.preventDefault();
    const alvoColabs =
      selectedColabIds.length > 0
        ? colaboradores.filter((c) => selectedColabIds.includes(c.id))
        : colaboradores;
    setEmitindoLote(true);
    try {
      const res = await emitirLoteHolerites({
        empresa: empresaInfo,
        colaboradores: alvoColabs,
        competencia,
        mesReferenciaLabel: mesRefLabel.trim() || competencia,
        modo: modoEmissao,
        agendadoLocalSaoPaulo: modoEmissao === 'agendar' ? agendadoLocal : undefined,
        criadoPorNome: atorNome,
      });
      showToast(res.message);
      if (res.lote) {
        setHoleriteLotes((prev) => [res.lote!, ...prev]);
      }
      if (res.holerites.length > 0) {
        setHolerites((prev) => [...res.holerites, ...prev]);
      }
      if (res.success) {
        setShowLoteForm(false);
        await syncWithSupabase();
      }
    } finally {
      setEmitindoLote(false);
    }
  };

  const handlePublicarLote = async (loteId: string) => {
    const lote = holeriteLotes.find((l) => l.id === loteId);
    if (!lote) return;
    const itens = holerites.filter((h) => h.loteId === loteId);
    const res = await publicarLoteAgora(lote, itens, atorNome);
    showToast(res.message);
    if (res.success) await syncWithSupabase();
  };

  const handleRetificarSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!retificandoHol) return;
    const colab = colaboradores.find((c) => c.id === retificandoHol.colaboradorId);
    if (!colab) {
      showToast('Colaborador do holerite não localizado.');
      return;
    }
    setRetifLoading(true);
    try {
      const res = await retificarHolerite({
        original: retificandoHol,
        colaborador: colab,
        empresa: empresaInfo,
        motivo: motivoRetif,
        novoSalarioBase: novoSalarioRetif ? Number(novoSalarioRetif) : undefined,
        novoValorExtras: novoExtrasRetif ? Number(novoExtrasRetif) : undefined,
        atorNome,
      });
      showToast(res.message);
      if (res.success && res.novoHolerite) {
        setHolerites((prev) => [
          res.novoHolerite!,
          ...prev.map((h) =>
            h.id === retificandoHol.id ? { ...h, statusPublicacao: 'retificado' as const } : h
          ),
        ]);
        setRetificandoHol(null);
        setMotivoRetif('');
        await syncWithSupabase();
      }
    } finally {
      setRetifLoading(false);
    }
  };

  const handleSolicitarDocRH = async (e: React.FormEvent) => {
    e.preventDefault();
    const colab = colaboradores.find((c) => c.id === docColabId) || colaboradores[0];
    if (!colab || !docTitulo.trim()) return;
    setEnviandoSolDoc(true);
    try {
      const res = await criarSolicitacaoDocumentoRH({
        empresaId: empresaInfo.id || 'emp-matriz-principal',
        colaboradorId: colab.id,
        colaboradorNome: colab.nome,
        tipoDocumento: docTipo,
        titulo: docTitulo.trim(),
        instrucoes: docInstrucoes.trim() || undefined,
        prazoEntrega: docPrazo || undefined,
        obrigatorio: docObrigatorio,
        solicitadoPorNome: atorNome,
      });
      showToast(res.message);
      if (res.success && res.solicitacao) {
        setDocumentoSolicitacoes((prev) => [res.solicitacao!, ...prev]);
        setDocTitulo('');
        setDocInstrucoes('');
      }
    } finally {
      setEnviandoSolDoc(false);
    }
  };

  const handleRevisarDoc = async (
    doc: ColaboradorDocumento,
    decisao: 'aprovar' | 'recusar' | 'solicitar_atualizacao'
  ) => {
    const res = await revisarDocumentoRH({
      documento: doc,
      decisao,
      observacao: reviewObs.trim() || undefined,
      revisorNome: atorNome,
    });
    showToast(res.message);
    if (res.success) {
      setColaboradorDocumentos((prev) =>
        prev.map((d) =>
          d.id === doc.id
            ? {
                ...d,
                status:
                  decisao === 'aprovar' ? 'valido' : decisao === 'recusar' ? 'recusado' : 'solicitado',
                observacaoRevisao: reviewObs.trim() || d.observacaoRevisao,
              }
            : d
        )
      );
      setReviewDocId(null);
      setReviewObs('');
      await syncWithSupabase();
    }
  };

  const handleGerarSignedUrl = async (doc: ColaboradorDocumento) => {
    const res = await getDocumentoSignedUrl(doc, atorNome);
    if (res.url) {
      setSignedLinks((prev) => ({ ...prev, [doc.id]: res.url! }));
    } else if (res.message) {
      showToast(res.message);
    }
  };

  const handleCriarCoberturaRH = async (e: React.FormEvent) => {
    e.preventDefault();
    const colab = colaboradores.find((c) => c.id === covColabId) || colaboradores[0];
    const posto = condominios.find((p) => p.id === covPostoId) || condominios[0];
    if (!colab || !posto) {
      showToast('Selecione colaborador e posto válidos.');
      return;
    }
    const res = await criarCobertura({
      colaborador: colab,
      postoCobertura: posto,
      tipo: covTipo,
      dataInicio: covDataIni,
      dataFim: covDataFim < covDataIni ? covDataIni : covDataFim,
      horaInicio: covHoraIni,
      horaFim: covHoraFim,
      valorExtraFT: parseFloat(covValor) || 0,
      motivo: covMotivo.trim() || undefined,
      exigeAceiteColaborador: covAceite,
    });
    if (res.success) {
      setCovMotivo('');
    }
  };

  return (
    <div className="space-y-4 pb-20 animate-in fade-in duration-200">
      <div>
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
          Departamento Pessoal, Documentos & Holerites RH
        </h2>
        <p className="text-xs text-slate-400">
          Lotes e agendamento (Brasília), prontuário documental, extras/coberturas, espelho e atestados
        </p>
      </div>

      {/* Sub-navigation */}
      <div className="overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 min-w-max">
          <button
            onClick={() => setActiveSubTab('holerites')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'holerites' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Holerites & Lotes ({holerites.length})
          </button>
          <button
            onClick={() => setActiveSubTab('documentos')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'documentos' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Documentos RH ({colaboradorDocumentos.length})
          </button>
          <button
            onClick={() => setActiveSubTab('coberturas')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'coberturas' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Escalas & Coberturas ({coberturasProgramadas.length})
          </button>
          <button
            onClick={() => setActiveSubTab('pontos')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'pontos' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Espelho & Correções ({pontoEventos.length + pontos.length})
          </button>
          <button
            onClick={() => setActiveSubTab('atestados')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'atestados' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Atestados ({atestados.length})
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: HOLERITES & LOTES */}
      {activeSubTab === 'holerites' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar holerite por funcionário, matrícula ou posto..."
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700/60 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowLoteForm((v) => !v)}
              className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{showLoteForm ? 'Fechar Emissão' : 'Emitir Lote de Holerites'}</span>
            </button>
          </div>

          {/* Formulário de Emissão de Lote + Agendamento América/São Paulo */}
          {showLoteForm && (
            <form
              onSubmit={handleEmitirLote}
              className="glass-panel rounded-2xl p-4 border border-emerald-500/35 space-y-3 text-xs"
            >
              <h3 className="font-bold text-white flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Nova Emissão em Lote (PDF Real + SHA-256)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Competência (YYYY-MM)</label>
                  <input
                    type="month"
                    required
                    value={competencia}
                    onChange={(e) => setCompetencia(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Descrição Competência</label>
                  <input
                    type="text"
                    required
                    value={mesRefLabel}
                    onChange={(e) => setMesRefLabel(e.target.value)}
                    placeholder="Ex: Novembro/2026"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Modo de Publicação</label>
                  <select
                    value={modoEmissao}
                    onChange={(e) => setModoEmissao(e.target.value as typeof modoEmissao)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                  >
                    <option value="rascunho">Salvar Rascunho</option>
                    <option value="agendar">Agendar Publicação (Brasília)</option>
                    <option value="publicar_agora">Publicar Imediatamente</option>
                  </select>
                </div>
              </div>

              {modoEmissao === 'agendar' && (
                <div>
                  <label className="block text-[11px] text-amber-300 font-semibold mb-1">
                    Data e Hora de Liberação (Fuso America/Sao_Paulo)
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={agendadoLocal}
                    onChange={(e) => setAgendadoLocal(e.target.value)}
                    className="w-full sm:w-72 px-3 py-2 rounded-lg bg-slate-900 border border-amber-500/40 text-white font-mono text-xs"
                  />
                </div>
              )}

              <div>
                <span className="block text-[11px] text-slate-300 mb-1">
                  Colaboradores ({selectedColabIds.length === 0 ? `Todos (${colaboradores.length})` : `${selectedColabIds.length} selecionado(s)`})
                </span>
                <div className="max-h-36 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-2 rounded-xl bg-slate-950/70 border border-slate-800">
                  {colaboradores.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedColabIds.includes(c.id)}
                        onChange={() => toggleColabLote(c.id)}
                      />
                      <span className="truncate">
                        {c.nome} ({c.matricula})
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  disabled={emitindoLote || colaboradores.length === 0}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer disabled:opacity-50"
                >
                  {emitindoLote ? 'Gerando PDFs...' : 'Confirmar Emissão do Lote'}
                </button>
              </div>
            </form>
          )}

          {/* Lotes Programados / Recentes */}
          {holeriteLotes.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Lotes de Folha ({holeriteLotes.length})
              </span>
              {holeriteLotes.map((lote) => (
                <div
                  key={lote.id}
                  className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <strong className="text-white block">{lote.titulo}</strong>
                    <span className="text-[11px] text-slate-400">
                      Status: <strong className="text-blue-300 uppercase">{lote.status}</strong>
                      {lote.agendadoPara &&
                        ` · Agendado: ${new Date(lote.agendadoPara).toLocaleString('pt-BR', {
                          timeZone: 'America/Sao_Paulo',
                        })}`}
                      {lote.ultimoErro && ` · Erro: ${lote.ultimoErro}`}
                    </span>
                  </div>
                  {(lote.status === 'rascunho' || lote.status === 'agendado' || lote.status === 'erro') && (
                    <button
                      type="button"
                      onClick={() => handlePublicarLote(lote.id)}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] cursor-pointer"
                    >
                      Publicar Agora
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Modal inline de Retificação */}
          {retificandoHol && (
            <form
              onSubmit={handleRetificarSubmit}
              className="p-4 rounded-2xl bg-amber-950/25 border border-amber-500/40 space-y-3 text-xs"
            >
              <div className="flex items-center justify-between">
                <strong className="text-amber-300">
                  Retificar Holerite de {retificandoHol.colaboradorNome} ({retificandoHol.mesReferencia} · v{retificandoHol.versao || 1})
                </strong>
                <button
                  type="button"
                  onClick={() => setRetificandoHol(null)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-300 mb-1">Novo Salário Base (opcional)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={novoSalarioRetif}
                    onChange={(e) => setNovoSalarioRetif(e.target.value)}
                    placeholder={String(retificandoHol.salarioBase)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-300 mb-1">Novo Valor Extras/FT (opcional)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={novoExtrasRetif}
                    onChange={(e) => setNovoExtrasRetif(e.target.value)}
                    placeholder={String(retificandoHol.valorHorasExtras)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-slate-300 mb-1">Motivo da Retificação *</label>
                <input
                  type="text"
                  required
                  value={motivoRetif}
                  onChange={(e) => setMotivoRetif(e.target.value)}
                  placeholder="Ex: Ajuste de plantão FT não computado no fechamento"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
                />
              </div>
              <button
                type="submit"
                disabled={retifLoading}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer disabled:opacity-50"
              >
                {retifLoading ? 'Gerando Nova Versão...' : 'Emitir Versão Retificada'}
              </button>
            </form>
          )}

          {/* Lista de Holerites */}
          <div className="space-y-2.5">
            {filteredHolerites.length === 0 ? (
              <div className="p-8 text-center glass-panel rounded-2xl text-slate-400 space-y-2">
                <FileSpreadsheet className="w-8 h-8 text-blue-400 mx-auto mb-1" />
                <p className="text-xs font-semibold text-slate-300">Nenhum contracheque emitido ainda</p>
                <p className="text-[11px] text-slate-500">
                  Clique em &quot;Emitir Lote de Holerites&quot; para gerar PDFs reais para sua equipe.
                </p>
              </div>
            ) : (
              filteredHolerites.map((hol) => (
                <div
                  key={hol.id}
                  className="glass-panel rounded-2xl p-4 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-sm font-bold text-white truncate">{hol.colaboradorNome}</h4>
                        <span className="text-[10px] text-slate-400 font-mono">{hol.matricula}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                          v{hol.versao || 1}
                        </span>
                      </div>
                      <p className="text-xs text-blue-400 font-medium truncate">
                        {hol.funcao} · <span className="text-slate-400">{hol.postoNome}</span>
                      </p>
                      <span className="text-[11px] text-slate-400">
                        Ref: {hol.mesReferencia} · {hol.statusPublicacao || 'publicado'}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 ${
                        hol.cienciaConfirmadaEm || hol.statusEnvio === 'Assinado'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {hol.cienciaConfirmadaEm ? 'Ciência Confirmada' : hol.statusEnvio}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-slate-800/80">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Salário Base</span>
                      <span className="text-slate-200 font-mono font-medium">R$ {hol.salarioBase.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Extras / FT</span>
                      <span className="text-emerald-400 font-mono font-medium">
                        R$ {(hol.valorFT || hol.valorHorasExtras).toFixed(2)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-blue-400 block uppercase font-bold">Líquido</span>
                      <span className="text-sm font-bold font-mono text-white">R$ {hol.liquidoReceber.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between gap-2 text-xs">
                    <span className="text-[11px] text-slate-400 font-mono">
                      Emitido em {hol.dataEmissao}
                    </span>
                    <div className="flex items-center gap-2">
                      {hol.statusPublicacao !== 'retificado' && (
                        <button
                          type="button"
                          onClick={() => {
                            setRetificandoHol(hol);
                            setNovoSalarioRetif('');
                            setNovoExtrasRetif('');
                            setMotivoRetif('');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-[11px] font-semibold cursor-pointer"
                        >
                          Retificar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openHoleriteDetalhe(hol)}
                        className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Visualizar</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {holeriteEventos.length > 0 && (
            <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 space-y-1 text-[11px]">
              <span className="font-bold text-slate-400 uppercase block text-[10px]">
                Auditoria Recente de Holerites
              </span>
              {holeriteEventos.slice(0, 6).map((ev) => (
                <div key={ev.id} className="flex justify-between gap-2 text-slate-300">
                  <span>
                    <strong>{ev.acao}</strong> ({ev.atorNome || 'Sistema'}): {ev.detalhes}
                  </span>
                  <span className="text-slate-500 font-mono shrink-0">
                    {new Date(ev.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: DOCUMENTOS RH */}
      {activeSubTab === 'documentos' && (
        <div className="space-y-4 text-xs">
          {/* Formulário RH: Solicitar Documento ao Funcionário */}
          <form
            onSubmit={handleSolicitarDocRH}
            className="glass-panel rounded-2xl p-4 border border-purple-500/30 space-y-3"
          >
            <h3 className="font-bold text-white flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-purple-400" />
              <span>Solicitar Envio de Documento ao Colaborador</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] text-slate-300 mb-1">Colaborador</label>
                <select
                  value={docColabId}
                  onChange={(e) => setDocColabId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                >
                  {colaboradores.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} ({c.matricula})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-300 mb-1">Categoria</label>
                <select
                  value={docTipo}
                  onChange={(e) => setDocTipo(e.target.value as ColaboradorDocumento['tipo'])}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                >
                  <option value="ASO / Exame">ASO / Exame Ocupacional</option>
                  <option value="Comprovante Residência">Comprovante de Residência</option>
                  <option value="RG">RG / Documento de Identidade</option>
                  <option value="CPF">CPF</option>
                  <option value="Carteira de Trabalho">Carteira de Trabalho Digital</option>
                  <option value="Certificado">Certificado / Reciclagem</option>
                  <option value="Contrato">Contrato / Termo</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2">
                <label className="block text-[11px] text-slate-300 mb-1">Título da Solicitação *</label>
                <input
                  type="text"
                  required
                  value={docTitulo}
                  onChange={(e) => setDocTitulo(e.target.value)}
                  placeholder="Ex: ASO Periódico 2026 ou Comprovante Atualizado"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-300 mb-1">Prazo (opcional)</label>
                <input
                  type="date"
                  value={docPrazo}
                  onChange={(e) => setDocPrazo(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-slate-300 mb-1">Instruções</label>
              <input
                type="text"
                value={docInstrucoes}
                onChange={(e) => setDocInstrucoes(e.target.value)}
                placeholder="Ex: Enviar PDF ou foto legível frente e verso"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={docObrigatorio}
                  onChange={(e) => setDocObrigatorio(e.target.checked)}
                />
                <span>Envio obrigatório</span>
              </label>
              <button
                type="submit"
                disabled={enviandoSolDoc || colaboradores.length === 0}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{enviandoSolDoc ? 'Solicitando...' : 'Enviar Solicitação'}</span>
              </button>
            </div>
          </form>

          {/* Documentos Enviados pelos Colaboradores para Análise */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Documentos Recebidos para Análise & Prontuário ({colaboradorDocumentos.length})
            </h3>
            {colaboradorDocumentos.length === 0 ? (
              <div className="p-6 text-center glass-panel rounded-2xl text-slate-400">
                Nenhum documento enviado pelos colaboradores até o momento.
              </div>
            ) : (
              colaboradorDocumentos.map((doc) => {
                const colab = colaboradores.find((c) => c.id === doc.colaboradorId);
                const signed = signedLinks[doc.id];
                return (
                  <div key={doc.id} className="glass-panel rounded-2xl p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <strong className="text-white">{doc.titulo}</strong>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                            v{doc.versao || 1}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {colab?.nome || doc.colaboradorId} · {doc.tipo}
                          {doc.tamanhoKb ? ` · ${doc.tamanhoKb} KB` : ''}
                        </p>
                        {doc.observacaoRevisao && (
                          <p className="text-[11px] text-amber-300 mt-0.5">Obs. RH: {doc.observacaoRevisao}</p>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          doc.status === 'valido'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : doc.status === 'pendente'
                            ? 'bg-amber-500/15 text-amber-300'
                            : 'bg-red-500/15 text-red-400'
                        }`}
                      >
                        {doc.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleGerarSignedUrl(doc)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-300 text-[11px] font-semibold cursor-pointer"
                        >
                          Gerar Link Seguro (120s)
                        </button>
                        {signed && (
                          <a
                            href={signed}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Abrir Arquivo</span>
                          </a>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleRevisarDoc(doc, 'aprovar')}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/35 text-emerald-300 text-[11px] font-semibold cursor-pointer"
                        >
                          Aprovar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReviewDocId(reviewDocId === doc.id ? null : doc.id);
                            setReviewObs('');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-600/20 hover:bg-amber-600/35 text-amber-300 text-[11px] font-semibold cursor-pointer"
                        >
                          Recusar / Atualizar
                        </button>
                      </div>
                    </div>

                    {reviewDocId === doc.id && (
                      <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                        <input
                          type="text"
                          value={reviewObs}
                          onChange={(e) => setReviewObs(e.target.value)}
                          placeholder="Motivo da recusa ou instrução para nova versão..."
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleRevisarDoc(doc, 'solicitar_atualizacao')}
                            className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold text-[11px] cursor-pointer"
                          >
                            Solicitar Nova Versão
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRevisarDoc(doc, 'recusar')}
                            className="px-2.5 py-1 rounded-lg bg-red-600 text-white font-bold text-[11px] cursor-pointer"
                          >
                            Recusar Documento
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Solicitações Emitidas */}
          {documentoSolicitacoes.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Solicitações Abertas / Histórico ({documentoSolicitacoes.length})
              </span>
              {documentoSolicitacoes.map((s) => (
                <div
                  key={s.id}
                  className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800 flex items-center justify-between gap-2"
                >
                  <div>
                    <strong className="text-slate-200">{s.titulo}</strong>
                    <span className="text-[10px] text-slate-400 block">
                      {s.colaboradorNome || s.colaboradorId} · {s.tipoDocumento}
                    </span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-blue-300 font-semibold">
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          {documentoHistorico.length > 0 && (
            <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 space-y-1 text-[11px]">
              <span className="font-bold text-slate-400 uppercase block text-[10px]">
                Auditoria Documental ({documentoHistorico.length})
              </span>
              {documentoHistorico.slice(0, 6).map((h) => (
                <div key={h.id} className="text-slate-300 flex justify-between gap-2">
                  <span>
                    <strong>{h.acao}</strong> ({h.atorNome || 'Sistema'}): {h.detalhes}
                  </span>
                  <span className="text-slate-500 font-mono shrink-0">
                    {new Date(h.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: ESCALAS & COBERTURAS */}
      {activeSubTab === 'coberturas' && (
        <div className="space-y-4 text-xs">
          <form
            onSubmit={handleCriarCoberturaRH}
            className="glass-panel rounded-2xl p-4 border border-amber-500/30 space-y-3"
          >
            <h3 className="font-bold text-white flex items-center gap-1.5">
              <CalendarClock className="w-4 h-4 text-amber-400" />
              <span>Programar Extra / Cobertura (Sem Alterar Lotação Base)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[10px] text-slate-300 mb-1">Colaborador</label>
                <select
                  value={covColabId}
                  onChange={(e) => setCovColabId(e.target.value)}
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
                <label className="block text-[10px] text-slate-300 mb-1">Posto da Cobertura</label>
                <select
                  value={covPostoId}
                  onChange={(e) => setCovPostoId(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                >
                  {condominios.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-slate-300 mb-1">Tipo</label>
                <select
                  value={covTipo}
                  onChange={(e) => setCovTipo(e.target.value as TipoCobertura)}
                  className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                >
                  <option value="extra">Extra / FT</option>
                  <option value="cobertura">Cobertura Programada</option>
                  <option value="substituicao">Substituição Temporária</option>
                  <option value="alocacao_temporaria">Alocação Temporária</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <input
                type="date"
                value={covDataIni}
                onChange={(e) => setCovDataIni(e.target.value)}
                className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-[11px]"
              />
              <input
                type="date"
                value={covDataFim}
                min={covDataIni}
                onChange={(e) => setCovDataFim(e.target.value)}
                className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-[11px]"
              />
              <input
                type="time"
                value={covHoraIni}
                onChange={(e) => setCovHoraIni(e.target.value)}
                className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-[11px]"
              />
              <input
                type="time"
                value={covHoraFim}
                onChange={(e) => setCovHoraFim(e.target.value)}
                className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-[11px]"
              />
              <input
                type="number"
                step="10"
                value={covValor}
                onChange={(e) => setCovValor(e.target.value)}
                placeholder="Valor R$"
                className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-[11px]"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <input
                type="text"
                value={covMotivo}
                onChange={(e) => setCovMotivo(e.target.value)}
                placeholder="Motivo / observação operacional..."
                className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
              />
              <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={covAceite}
                  onChange={(e) => setCovAceite(e.target.checked)}
                />
                <span>Exigir aceite</span>
              </label>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer"
              >
                Programar Cobertura
              </button>
            </div>
          </form>

          <div className="space-y-2">
            {coberturasProgramadas.length === 0 ? (
              <div className="p-6 text-center glass-panel rounded-2xl text-slate-400">
                Nenhuma cobertura ou extra programado.
              </div>
            ) : (
              coberturasProgramadas.map((cov) => (
                <div key={cov.id} className="glass-panel rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <strong className="text-white">
                        {cov.colaboradorNome || cov.colaboradorId} → {cov.postoCoberturaNome || cov.postoCoberturaId}
                      </strong>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {cov.tipo.toUpperCase()} · {cov.dataInicio} a {cov.dataFim} ({cov.horaInicio}–{cov.horaFim})
                        {cov.valorExtraFT ? ` · R$ ${cov.valorExtraFT.toFixed(2)}` : ''}
                      </p>
                      {cov.motivo && <p className="text-[11px] text-slate-300">{cov.motivo}</p>}
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-amber-300">
                      {cov.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={async () => {
                        if (covHistId === cov.id) {
                          setCovHistId(null);
                          return;
                        }
                        const items = await fetchCoberturaHistorico(cov.id);
                        setCovHistItems(items);
                        setCovHistId(cov.id);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <History className="w-3 h-3" />
                      <span>Histórico</span>
                    </button>
                    {(cov.status === 'aprovada' || cov.status === 'aguardando_aceite') && (
                      <>
                        <button
                          type="button"
                          onClick={() => alterarStatusCobertura(cov, 'concluida')}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600/20 text-emerald-300 text-[11px] font-semibold cursor-pointer"
                        >
                          Concluir
                        </button>
                        <button
                          type="button"
                          onClick={() => alterarStatusCobertura(cov, 'cancelada')}
                          className="px-2.5 py-1 rounded-lg bg-red-600/20 text-red-300 text-[11px] font-semibold cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </>
                    )}
                  </div>
                  {covHistId === cov.id && (
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 space-y-1 text-[10px] text-slate-300">
                      {covHistItems.length === 0 ? (
                        <span>Sem eventos registrados.</span>
                      ) : (
                        covHistItems.map((h) => (
                          <div key={h.id}>
                            <strong>{h.acao}</strong> ({h.atorNome || 'Sistema'}): {h.detalhes}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 4: ESPELHO DE PONTO & SOLICITAÇÕES DE CORREÇÃO */}
      {activeSubTab === 'pontos' && (
        <div className="space-y-4 text-xs">
          {/* Solicitações de Correção de Ponto */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
              Solicitações de Correção de Ponto ({solicitacoesCorrecao.length})
            </h3>
            {solicitacoesCorrecao.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400">
                Nenhuma solicitação de ajuste pendente.
              </div>
            ) : (
              solicitacoesCorrecao.map((sc) => (
                <div key={sc.id} className="glass-panel rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <strong className="text-white">{sc.colaboradorNome}</strong>
                      <p className="text-[11px] text-slate-400">
                        Data: {sc.dataPonto} · Tipo: {sc.tipoCorrecao}
                      </p>
                      <p className="text-[11px] text-slate-200 mt-1">{sc.justificativa}</p>
                      {sc.respostaRH && (
                        <p className="text-[11px] text-blue-300 mt-1">Resposta RH: {sc.respostaRH}</p>
                      )}
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 font-bold">
                      {sc.status}
                    </span>
                  </div>
                  {sc.status === 'pendente' && (
                    <div className="space-y-2 pt-2 border-t border-slate-800">
                      {correcaoRespId === sc.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={correcaoObs}
                            onChange={(e) => setCorrecaoObs(e.target.value)}
                            placeholder="Descreva a decisão do RH..."
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setCorrecaoRespId(null)}
                              className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                revisarSolicitacaoCorrecao(sc.id, 'aprovado', correcaoObs || 'Ajuste aprovado pelo RH');
                                setCorrecaoRespId(null);
                              }}
                              className="px-2.5 py-1 rounded bg-emerald-600 text-white font-bold cursor-pointer"
                            >
                              Aprovar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                revisarSolicitacaoCorrecao(sc.id, 'rejeitado', correcaoObs || 'Indeferido pelo RH');
                                setCorrecaoRespId(null);
                              }}
                              className="px-2.5 py-1 rounded bg-red-600 text-white font-bold cursor-pointer"
                            >
                              Rejeitar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setCorrecaoRespId(sc.id);
                              setCorrecaoObs('');
                            }}
                            className="px-3 py-1 rounded-lg bg-blue-600/20 text-blue-300 font-semibold cursor-pointer"
                          >
                            Analisar Solicitação
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Batidas Recentes (ponto_eventos) */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Últimos Eventos Biométricos & GPS ({pontoEventos.length})
            </h3>
            {pontoEventos.slice(0, 30).map((ev) => (
              <div key={ev.id} className="glass-panel rounded-2xl p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <strong className="text-white block truncate">
                    {ev.colaboradorNome} · {ev.labelEvento}
                  </strong>
                  <span className="text-[11px] text-slate-400 block truncate">
                    {ev.condominioNome} · {ev.classificacaoPosto || 'posto_regular'} · GPS ±
                    {ev.accuracyRealM || ev.accuracyM || '?'}m
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(ev.serverTimestamp).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                  </span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                    ev.classificacaoPosto === 'divergencia_posto'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-emerald-500/15 text-emerald-400'
                  }`}
                >
                  {ev.classificacaoPosto || ev.verificationStatus}
                </span>
              </div>
            ))}
          </div>

          {/* Consolidação Diária (pontos) */}
          <div className="space-y-2">
            {pontos.length === 0 && pontoEventos.length === 0 ? (
              <div className="p-8 text-center glass-panel rounded-2xl text-slate-400 space-y-2">
                <Clock className="w-8 h-8 text-blue-400 mx-auto mb-1" />
                <p className="text-xs font-semibold text-slate-300">Nenhum registro de ponto encontrado</p>
              </div>
            ) : (
              pontos.map((pto) => (
                <div
                  key={pto.id}
                  className="glass-panel rounded-2xl p-3.5 flex flex-col justify-between gap-2.5 text-xs"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-white text-xs">{pto.colaboradorNome}</h4>
                      <p className="text-[11px] text-slate-400">{pto.data}</p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-200">
                      {pto.statusPonto}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 p-2 rounded-lg bg-slate-950/60 border border-slate-800 text-center font-mono text-[11px]">
                    <div>
                      <span className="text-[9px] text-slate-500 block">Entrada 1</span>
                      <strong className="text-white">{pto.entrada1}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 block">Saída 1</span>
                      <strong className="text-slate-300">{pto.saida1}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 block">Entrada 2</span>
                      <strong className="text-slate-300">{pto.entrada2}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 block">Saída 2</span>
                      <strong className="text-slate-300">{pto.saida2}</strong>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono truncate">GPS: {pto.localizacaoGPS}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 5: ATESTADOS MÉDICOS */}
      {activeSubTab === 'atestados' && (
        <div className="space-y-3">
          {atestados.length === 0 ? (
            <div className="p-8 text-center glass-panel rounded-2xl text-slate-400">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-xs">Nenhum atestado médico registrado.</p>
            </div>
          ) : (
            atestados.map((atest) => {
              const isPendente = atest.status === 'Pendente';
              const isAprovado = atest.status === 'Aprovado';

              return (
                <div key={atest.id} className="glass-panel rounded-2xl p-4 flex flex-col justify-between gap-3 text-xs">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-white text-sm">{atest.colaboradorNome}</h4>
                        <span className="text-[10px] text-slate-400 font-mono">{atest.matricula}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{atest.postoNome}</p>
                    </div>

                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                        isAprovado
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : isPendente
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}
                    >
                      {atest.status}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                    <p className="text-slate-200">
                      <strong>Diagnóstico:</strong> {atest.cid}
                    </p>
                    <p className="text-slate-400">
                      <strong>Médico Emissor:</strong> {atest.medico} ({atest.crm})
                    </p>
                    <p className="text-slate-400">
                      <strong>Período:</strong> {atest.diasAfastamento} dias a partir de {atest.dataInicio}
                    </p>
                  </div>

                  {isPendente && (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
                      <button
                        onClick={() => recusarAtestado(atest.id)}
                        className="px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 font-semibold text-xs active:scale-95 transition-all cursor-pointer"
                      >
                        Recusar
                      </button>
                      <button
                        onClick={() => aprovarAtestado(atest.id)}
                        className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs active:scale-95 transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
                      >
                        Aprovar e Abonar Falta
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
