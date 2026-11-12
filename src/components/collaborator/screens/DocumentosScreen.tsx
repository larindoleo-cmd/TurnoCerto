import React, { useState, useRef } from 'react';
import {
  FileText,
  FolderLock,
  Download,
  Eye,
  EyeOff,
  CheckCircle2,
  Lock,
  ArrowDownToLine,
  PhoneCall,
  Upload,
  PlusCircle,
  FileCheck,
  X,
  Send,
  AlertTriangle,
  ExternalLink,
  History,
  Loader2,
} from 'lucide-react';
import {
  Colaborador,
  HoleriteRegistro,
  ColaboradorDocumento,
  DocumentoSolicitacao,
  DocumentoHistorico,
  EmpresaInfo,
} from '../../../types';
import { downloadHoleritePDF } from '../../../services/documentService';
import {
  enviarDocumentoColaborador,
  getDocumentoSignedUrl,
} from '../../../services/documentWorkflowService';
import { useApp } from '../../../context/AppContext';
import { getSupabase } from '../../../lib/supabase';

interface DocumentosScreenProps {
  colaborador: Colaborador;
  holerites: HoleriteRegistro[];
  documentos: ColaboradorDocumento[];
  solicitacoes?: DocumentoSolicitacao[];
  historico?: DocumentoHistorico[];
  empresa: EmpresaInfo;
  onOpenHoleriteDetalhe: (holerite: HoleriteRegistro) => void;
  onOpenFaleRH: () => void;
}

export const DocumentosScreen: React.FC<DocumentosScreenProps> = ({
  colaborador,
  holerites,
  documentos,
  solicitacoes = [],
  historico = [],
  empresa,
  onOpenHoleriteDetalhe,
  onOpenFaleRH,
}) => {
  const { setColaboradorDocumentos, setDocumentoSolicitacoes, showToast, syncWithSupabase } = useApp();

  const [subTab, setSubTab] = useState<'holerites' | 'documentos'>('holerites');
  const [showValores, setShowValores] = useState<boolean>(false);

  // Solicitação de declaração/2ª via ao RH
  const [solicitarDocModalOpen, setSolicitarDocModalOpen] = useState(false);
  const [tipoDocSolicitado, setTipoDocSolicitado] = useState('Declaração de Trabalho');
  const [motivoSolicitacao, setMotivoSolicitacao] = useState('');
  const [enviandoSolicitacao, setEnviandoSolicitacao] = useState(false);
  const [solicitacaoSucesso, setSolicitacaoSucesso] = useState(false);

  // Upload de documento (avulso ou respondendo solicitação / reenvio)
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadTargetSolicitacao, setUploadTargetSolicitacao] =
    useState<DocumentoSolicitacao | null>(null);
  const [uploadAnteriorDoc, setUploadAnteriorDoc] = useState<ColaboradorDocumento | null>(null);
  const [uploadTitulo, setUploadTitulo] = useState('');
  const [uploadTipo, setUploadTipo] = useState<ColaboradorDocumento['tipo']>('RG');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Visualização segura com Signed URL (120s)
  const [signedViewer, setSignedViewer] = useState<{
    titulo: string;
    url: string;
  } | null>(null);
  const [docFeedbackError, setDocFeedbackError] = useState<string | null>(null);
  const [downloadingHoleriteId, setDownloadingHoleriteId] = useState<string | null>(null);

  // Filtra holerites publicados estritamente do próprio colaborador
  const meusHolerites = holerites.filter(
    (h) =>
      (h.colaboradorId === colaborador.id || h.matricula === colaborador.matricula) &&
      (h.statusPublicacao === 'publicado' || h.statusPublicacao === 'retificado' || !h.statusPublicacao)
  );

  const pendentesCiencia = meusHolerites.filter(
    (h) => !h.cienciaConfirmadaEm && h.statusEnvio !== 'Assinado'
  ).length;

  const openUploadForSolicitacao = (sol: DocumentoSolicitacao) => {
    const existingDoc = documentos.find((d) => d.solicitacaoId === sol.id) || null;
    setUploadTargetSolicitacao(sol);
    setUploadAnteriorDoc(existingDoc);
    setUploadTitulo(sol.titulo);
    setUploadTipo((sol.tipoDocumento as ColaboradorDocumento['tipo']) || 'Outro');
    setSelectedFile(null);
    setUploadError(null);
    setUploadModalOpen(true);
  };

  const openUploadAvulso = () => {
    setUploadTargetSolicitacao(null);
    setUploadAnteriorDoc(null);
    setUploadTitulo('');
    setUploadTipo('RG');
    setSelectedFile(null);
    setUploadError(null);
    setUploadModalOpen(true);
  };

  const openReenvioDocumento = (doc: ColaboradorDocumento) => {
    setUploadTargetSolicitacao(null);
    setUploadAnteriorDoc(doc);
    setUploadTitulo(doc.titulo);
    setUploadTipo(doc.tipo);
    setSelectedFile(null);
    setUploadError(null);
    setUploadModalOpen(true);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !uploadTitulo.trim()) {
      setUploadError('Selecione um arquivo válido (PDF, JPG ou PNG) e informe o título.');
      return;
    }

    setUploading(true);
    setUploadError(null);

    const res = await enviarDocumentoColaborador({
      empresaId: empresa.id || 'emp-matriz-principal',
      colaboradorId: colaborador.id,
      colaboradorNome: colaborador.nome,
      file: selectedFile,
      titulo: uploadTitulo.trim(),
      tipo: uploadTipo,
      solicitacaoId: uploadTargetSolicitacao?.id,
      documentoAnteriorId: uploadAnteriorDoc?.id,
      versaoAtual: uploadAnteriorDoc?.versao,
    });

    setUploading(false);

    if (!res.success || !res.documento) {
      setUploadError(res.message);
      return;
    }

    setColaboradorDocumentos((prev) => [res.documento!, ...prev]);
    if (uploadTargetSolicitacao) {
      setDocumentoSolicitacoes((prev) =>
        prev.map((s) =>
          s.id === uploadTargetSolicitacao.id ? { ...s, status: 'enviado_analise' } : s
        )
      );
    }
    showToast(res.message);
    setUploadModalOpen(false);
    void syncWithSupabase();
  };

  const handleVisualizarDocumento = async (doc: ColaboradorDocumento) => {
    setDocFeedbackError(null);
    const res = await getDocumentoSignedUrl(doc, colaborador.nome);
    if (!res.url) {
      setDocFeedbackError(res.message || 'Não foi possível gerar link seguro para este documento.');
      return;
    }
    setSignedViewer({ titulo: doc.titulo, url: res.url });
  };

  const handleDownloadHolerite = async (holerite: HoleriteRegistro) => {
    setDownloadingHoleriteId(holerite.id);
    try {
      await downloadHoleritePDF(holerite, colaborador, empresa);
      showToast(`PDF oficial gerado: ${holerite.mesReferencia}`);
    } finally {
      setDownloadingHoleriteId(null);
    }
  };

  const handleSolicitarDocumentoRH = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivoSolicitacao.trim()) return;
    setEnviandoSolicitacao(true);

    const client = getSupabase();
    if (client) {
      await client.from('notificacoes_sistema').insert({
        empresa_id: empresa.id || 'emp-matriz-principal',
        destinatario_role: 'rh',
        categoria: 'documento',
        titulo: `Pedido de documento: ${colaborador.nome} (${tipoDocSolicitado})`,
        mensagem: motivoSolicitacao.trim(),
        link_destino: 'rh',
      });
    }

    setEnviandoSolicitacao(false);
    setSolicitacaoSucesso(true);
    setMotivoSolicitacao('');
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Header & Segmented Tabs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <FolderLock className="w-5 h-5 text-blue-400" />
              <span>Documentos e Holerites</span>
            </h2>
            <p className="text-xs text-slate-400">
              Acesso seguro a comprovantes de pagamento e prontuário funcional
            </p>
          </div>

          <button
            onClick={() => setShowValores(!showValores)}
            className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title={showValores ? 'Ocultar valores' : 'Mostrar valores'}
          >
            {showValores ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-blue-400" />}
          </button>
        </div>

        <div className="flex bg-slate-900/90 p-1 rounded-2xl border border-slate-800">
          <button
            onClick={() => setSubTab('holerites')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              subTab === 'holerites'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Meus Holerites ({meusHolerites.length})</span>
          </button>

          <button
            onClick={() => setSubTab('documentos')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              subTab === 'documentos'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FolderLock className="w-4 h-4" />
            <span>Meus Documentos ({documentos.length})</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-ABA 1: MEUS HOLERITES */}
      {/* ========================================================================= */}
      {subTab === 'holerites' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl bg-gradient-to-br from-emerald-950/30 to-slate-900 border border-emerald-500/30 p-3.5 text-center">
              <span className="text-2xl font-black text-emerald-400 block font-mono">
                {meusHolerites.length}
              </span>
              <span className="text-xs font-semibold text-slate-300 block mt-0.5">
                Disponíveis para Download
              </span>
            </div>

            <div
              className={`rounded-2xl p-3.5 text-center border ${
                pendentesCiencia > 0
                  ? 'bg-gradient-to-br from-amber-950/30 to-slate-900 border-amber-500/40'
                  : 'bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800'
              }`}
            >
              <span
                className={`text-2xl font-black block font-mono ${
                  pendentesCiencia > 0 ? 'text-amber-400' : 'text-slate-400'
                }`}
              >
                {pendentesCiencia}
              </span>
              <span className="text-xs font-semibold text-slate-300 block mt-0.5">
                Pendentes de Ciência
              </span>
            </div>
          </div>

          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider px-1">
              Holerites Publicados
            </h3>

            {meusHolerites.length === 0 && (
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-400">
                Nenhum holerite publicado até o momento.
              </div>
            )}

            {meusHolerites.map((holerite) => {
              const confirmado = Boolean(holerite.cienciaConfirmadaEm) || holerite.statusEnvio === 'Assinado';
              return (
                <div
                  key={holerite.id}
                  className="p-4 rounded-2xl bg-[#091029] border border-blue-500/25 hover:border-blue-400/50 transition-all shadow-lg space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-white">
                          {holerite.mesReferencia}{' '}
                          {holerite.versao && holerite.versao > 1 ? `(v${holerite.versao} Retificado)` : ''}
                        </h4>
                        <span className="text-[11px] text-slate-400 block">
                          Emitido em {holerite.dataEmissao}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        confirmado
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {confirmado ? 'Recebimento confirmado' : 'Aguardando ciência'}
                    </span>
                  </div>

                  <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 flex items-center justify-between">
                    <span className="text-xs text-slate-400">Valor Líquido a Receber:</span>
                    <span className="text-sm font-extrabold font-mono text-emerald-400">
                      {showValores ? `R$ ${holerite.liquidoReceber.toFixed(2)}` : '••••••••'}
                    </span>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => onOpenHoleriteDetalhe(holerite)}
                      className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-400" />
                      <span>{confirmado ? 'Visualizar' : 'Visualizar e Confirmar'}</span>
                    </button>

                    <button
                      disabled={downloadingHoleriteId === holerite.id}
                      onClick={() => handleDownloadHolerite(holerite)}
                      className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-bold shadow-md shadow-blue-600/30 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {downloadingHoleriteId === holerite.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ArrowDownToLine className="w-3.5 h-3.5" />
                      )}
                      <span>Baixar PDF</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl bg-blue-950/30 border border-blue-500/25 p-3.5 flex items-center gap-3">
            <Lock className="w-5 h-5 text-blue-400 shrink-0" />
            <div className="text-[11px] text-slate-300">
              <strong className="text-white block">Acesso Pessoal Protegido:</strong>
              Seus demonstrativos são confidenciais, gerados em PDF oficial com integridade SHA-256. Confirmar o recebimento atesta apenas ciência do documento, não implicando concordância com os valores.
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-ABA 2: MEUS DOCUMENTOS & SOLICITAÇÕES DO RH */}
      {/* ========================================================================= */}
      {subTab === 'documentos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1 gap-2">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Documentos e Pendências RH
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={openUploadAvulso}
                className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1.5 rounded-xl font-bold flex items-center gap-1 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Enviar PDF/Foto</span>
              </button>
              <button
                onClick={() => {
                  setSolicitacaoSucesso(false);
                  setSolicitarDocModalOpen(true);
                }}
                className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Pedir 2ª via</span>
              </button>
            </div>
          </div>

          {/* Solicitações abertas pelo RH */}
          {solicitacoes.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[11px] font-bold text-amber-300 uppercase tracking-wider px-1">
                Solicitações Enviadas pelo RH
              </h4>
              {solicitacoes.map((sol) => {
                const needsAction =
                  sol.status === 'pendente_envio' ||
                  sol.status === 'recusado' ||
                  sol.status === 'atualizacao_solicitada';
                return (
                  <div
                    key={sol.id}
                    className={`p-3.5 rounded-2xl border text-xs space-y-2 ${
                      needsAction
                        ? 'bg-amber-950/25 border-amber-500/40'
                        : 'bg-slate-900/70 border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <strong className="text-white block">{sol.titulo}</strong>
                        <span className="text-[11px] text-slate-400 block">
                          Tipo: {sol.tipoDocumento}
                          {sol.prazoEntrega ? ` · Prazo: ${sol.prazoEntrega}` : ''}
                        </span>
                        {sol.instrucoes && (
                          <p className="text-[11px] text-slate-300 mt-1">{sol.instrucoes}</p>
                        )}
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 uppercase shrink-0">
                        {sol.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    {needsAction && (
                      <button
                        type="button"
                        onClick={() => openUploadForSolicitacao(sol)}
                        className="w-full py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>
                          {sol.status === 'pendente_envio'
                            ? 'Enviar Documento Solicitado'
                            : 'Reenviar Nova Versão'}
                        </span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {docFeedbackError && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{docFeedbackError}</span>
              </div>
              <button onClick={() => setDocFeedbackError(null)} className="cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {signedViewer && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 text-xs flex items-center justify-between gap-2">
              <div className="min-w-0">
                <strong className="text-emerald-300 block truncate">
                  Link Seguro (expira em 120s): {signedViewer.titulo}
                </strong>
                <span className="text-[11px] text-slate-300 block">
                  Toque em abrir para visualizar ou baixar com segurança.
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={signedViewer.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir</span>
                </a>
                <button
                  onClick={() => setSignedViewer(null)}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-300 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Lista de Documentos Enviados */}
          <div className="space-y-2">
            {documentos.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-400">
                Nenhum documento anexado até o momento. Use "Enviar PDF/Foto" para encaminhar documentos ao RH.
              </div>
            ) : (
              documentos.map((doc) => {
                const canResubmit = doc.status === 'recusado' || doc.status === 'solicitado' || doc.status === 'expirado';
                return (
                  <div
                    key={doc.id}
                    className="p-3.5 rounded-2xl bg-[#091029] border border-slate-800 hover:border-blue-500/40 transition-all space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0">
                          <FileCheck className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-white block truncate">
                            {doc.titulo} (v{doc.versao || 1})
                          </span>
                          <span className="text-[11px] text-slate-400 block truncate">
                            {doc.tipo}
                            {doc.tamanhoKb ? ` · ${doc.tamanhoKb} KB` : ''}
                            {doc.dataEmissao ? ` · ${doc.dataEmissao}` : ''}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            doc.status === 'valido'
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                              : doc.status === 'recusado'
                              ? 'bg-red-500/15 text-red-400 border-red-500/25'
                              : 'bg-amber-500/15 text-amber-300 border-amber-500/25'
                          }`}
                        >
                          {doc.status === 'valido' ? 'Aprovado' : doc.status}
                        </span>
                        <button
                          onClick={() => handleVisualizarDocumento(doc)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                          title="Gerar link seguro (120s)"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {doc.observacaoRevisao && (
                      <p className="text-[11px] text-amber-300 bg-amber-950/30 border border-amber-500/25 rounded-xl px-2.5 py-1.5">
                        Observação RH: {doc.observacaoRevisao}
                      </p>
                    )}

                    {canResubmit && (
                      <button
                        type="button"
                        onClick={() => openReenvioDocumento(doc)}
                        className="w-full py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/35 border border-blue-500/30 text-blue-300 font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Enviar Nova Versão (v{(doc.versao || 1) + 1})</span>
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Histórico de Documentos */}
          {historico.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" />
                <span>Histórico Recente</span>
              </h4>
              <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-3 space-y-1.5 text-[11px]">
                {historico.slice(0, 6).map((h) => (
                  <div key={h.id} className="flex justify-between gap-2 border-b border-slate-800/60 pb-1 last:border-b-0 last:pb-0">
                    <span className="text-slate-300 truncate">
                      <strong className="text-white uppercase">{h.acao}</strong> · {h.detalhes || 'Evento registrado'}
                    </span>
                    <span className="text-slate-500 font-mono shrink-0">
                      {new Intl.DateTimeFormat('pt-BR', {
                        timeZone: 'America/Sao_Paulo',
                        day: '2-digit',
                        month: '2-digit',
                      }).format(new Date(h.createdAt))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suporte com RH */}
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
                <PhoneCall className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <strong className="text-white block">Precisa de 2ª via ou declaração?</strong>
                <span className="text-slate-400 text-[11px]">
                  Fale com a equipe de Recursos Humanos da empresa
                </span>
              </div>
            </div>

            <button
              onClick={onOpenFaleRH}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-300 hover:text-white font-bold text-xs transition-colors shrink-0 cursor-pointer"
            >
              Falar com RH
            </button>
          </div>
        </div>
      )}

      {/* Modal: Upload Seguro de Documento */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-[#091029] border border-blue-500/30 p-5 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-blue-400" />
                <span>
                  {uploadAnteriorDoc
                    ? `Enviar Nova Versão (v${(uploadAnteriorDoc.versao || 1) + 1})`
                    : 'Enviar Documento ao RH'}
                </span>
              </h3>
              <button
                onClick={() => setUploadModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Título do Documento</label>
                <input
                  type="text"
                  required
                  value={uploadTitulo}
                  onChange={(e) => setUploadTitulo(e.target.value)}
                  placeholder="Ex: RG Frente e Verso / ASO Admissional"
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Categoria</label>
                <select
                  value={uploadTipo}
                  onChange={(e) => setUploadTipo(e.target.value as ColaboradorDocumento['tipo'])}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                >
                  <option value="RG">RG</option>
                  <option value="CPF">CPF</option>
                  <option value="Comprovante Residência">Comprovante Residência</option>
                  <option value="Carteira de Trabalho">Carteira de Trabalho</option>
                  <option value="ASO / Exame">ASO / Exame</option>
                  <option value="Certificado">Certificado</option>
                  <option value="Contrato">Contrato</option>
                  <option value="Declaração">Declaração</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Arquivo (PDF, JPG ou PNG até 10 MB)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  onChange={(e) => {
                    setUploadError(null);
                    setSelectedFile(e.target.files?.[0] || null);
                  }}
                  className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-600/25 file:text-blue-300 hover:file:bg-blue-600/40"
                />
              </div>

              {uploadError && (
                <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-[11px]">
                  {uploadError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  <span>{uploading ? 'Validando...' : 'Enviar'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Solicitar 2ª Via ao RH */}
      {solicitarDocModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-[#091029] border border-blue-500/30 p-5 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <PlusCircle className="w-4 h-4 text-blue-400" />
                <span>Solicitar Documento ao RH</span>
              </h3>
              <button
                onClick={() => setSolicitarDocModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {solicitacaoSucesso ? (
              <div className="text-center py-6 space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <h4 className="text-sm font-bold text-white">Pedido Registrado!</h4>
                <p className="text-xs text-slate-400">
                  O setor de RH foi notificado e responderá pelo aplicativo.
                </p>
                <button
                  onClick={() => setSolicitarDocModalOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <form onSubmit={handleSolicitarDocumentoRH} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Tipo de Documento Desejado</label>
                  <select
                    value={tipoDocSolicitado}
                    onChange={(e) => setTipoDocSolicitado(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="Declaração de Trabalho">Declaração de Trabalho com Horários</option>
                    <option value="Comprovante de Rendimentos">Comprovante de Rendimentos (IRPF)</option>
                    <option value="Carta de Apresentação">Carta de Apresentação / Vínculo</option>
                    <option value="2ª Via de Contrato">2ª Via do Contrato de Trabalho</option>
                    <option value="Outro">Outro Documento</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Finalidade / Observações</label>
                  <textarea
                    required
                    rows={3}
                    value={motivoSolicitacao}
                    onChange={(e) => setMotivoSolicitacao(e.target.value)}
                    placeholder="Ex: Para abertura de conta bancária, faculdade, locação..."
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSolicitarDocModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={enviandoSolicitacao}
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-bold shadow-lg shadow-blue-600/30 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {enviandoSolicitacao ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>{enviandoSolicitacao ? 'Enviando...' : 'Solicitar'}</span>
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
