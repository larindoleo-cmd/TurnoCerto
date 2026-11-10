import React, { useState } from 'react';
import {
  FileText,
  FolderLock,
  Download,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowDownToLine,
  PhoneCall,
  Upload,
  PlusCircle,
  FileCheck,
  X,
  Send,
} from 'lucide-react';
import {
  Colaborador,
  HoleriteRegistro,
  ColaboradorDocumento,
  EmpresaInfo,
} from '../../../types';
import { downloadHoleritePDF } from '../../../services/documentService';

interface DocumentosScreenProps {
  colaborador: Colaborador;
  holerites: HoleriteRegistro[];
  documentos: ColaboradorDocumento[];
  empresa: EmpresaInfo;
  onOpenHoleriteDetalhe: (holerite: HoleriteRegistro) => void;
  onOpenFaleRH: () => void;
}

export const DocumentosScreen: React.FC<DocumentosScreenProps> = ({
  colaborador,
  holerites,
  documentos,
  empresa,
  onOpenHoleriteDetalhe,
  onOpenFaleRH,
}) => {
  const [subTab, setSubTab] = useState<'holerites' | 'documentos'>('holerites');
  const [showValores, setShowValores] = useState<boolean>(false);
  const [solicitarDocModalOpen, setSolicitarDocModalOpen] = useState(false);
  const [tipoDocSolicitado, setTipoDocSolicitado] = useState('Declaração de Trabalho');
  const [motivoSolicitacao, setMotivoSolicitacao] = useState('');
  const [solicitacaoSucesso, setSolicitacaoSucesso] = useState(false);

  // Filtra holerites estritamente do próprio colaborador (Segurança)
  const meusHolerites = holerites.filter(
    (h) => h.colaboradorId === colaborador.id || h.matricula === colaborador.matricula
  );

  const handleSolicitarDocumento = (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivoSolicitacao.trim()) return;
    setSolicitacaoSucesso(true);
    setTimeout(() => {
      setSolicitacaoSucesso(false);
      setSolicitarDocModalOpen(false);
      setMotivoSolicitacao('');
    }, 2000);
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
              Acesso seguro a comprovantes de rendimento e registros funcionais
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

        {/* Seletor Segmentado */}
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
          {/* Métricas de Holerite (Design Mockup #4) */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl bg-gradient-to-br from-emerald-950/30 to-slate-900 border border-emerald-500/30 p-3.5 text-center">
              <span className="text-2xl font-black text-emerald-400 block font-mono">
                {meusHolerites.length}
              </span>
              <span className="text-xs font-semibold text-slate-300 block mt-0.5">
                Disponíveis para Download
              </span>
            </div>

            <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-3.5 text-center">
              <span className="text-2xl font-black text-slate-400 block font-mono">0</span>
              <span className="text-xs font-semibold text-slate-400 block mt-0.5">
                Pendentes de Assinatura
              </span>
            </div>
          </div>

          {/* Lista de Holerites */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider px-1">
              Holerites Recentes
            </h3>

            {meusHolerites.map((holerite) => (
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
                        {holerite.mesReferencia}
                      </h4>
                      <span className="text-[11px] text-slate-400 block">
                        Disponível em {holerite.dataEmissao}
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    {holerite.statusEnvio}
                  </span>
                </div>

                {/* Valor Líquido com Proteção de Visibilidade */}
                <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Valor Líquido a Receber:</span>
                  <span className="text-sm font-extrabold font-mono text-emerald-400">
                    {showValores ? `R$ ${holerite.liquidoReceber.toFixed(2)}` : '••••••••'}
                  </span>
                </div>

                {/* Ações: Visualizar e Baixar PDF */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => onOpenHoleriteDetalhe(holerite)}
                    className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5 text-blue-400" />
                    <span>Visualizar</span>
                  </button>

                  <button
                    onClick={() => downloadHoleritePDF(holerite, colaborador, empresa)}
                    className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <ArrowDownToLine className="w-3.5 h-3.5" />
                    <span>Baixar PDF</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Aviso de Segurança */}
          <div className="rounded-2xl bg-blue-950/30 border border-blue-500/25 p-3.5 flex items-center gap-3">
            <Lock className="w-5 h-5 text-blue-400 shrink-0" />
            <div className="text-[11px] text-slate-300">
              <strong className="text-white block">Acesso Pessoal Protegido:</strong>
              Seus demonstrativos são confidenciais e assinados digitalmente conforme normas do eSocial.
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-ABA 2: MEUS DOCUMENTOS */}
      {/* ========================================================================= */}
      {subTab === 'documentos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Documentos Pessoais e Funcionais
            </h3>
            <button
              onClick={() => setSolicitarDocModalOpen(true)}
              className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Solicitar Documento</span>
            </button>
          </div>

          {/* Grade de Documentos Pessoais (Design Mockup #5) */}
          <div className="space-y-2">
            {documentos.map((doc) => (
              <div
                key={doc.id}
                className="p-3.5 rounded-2xl bg-[#091029] border border-slate-800 hover:border-blue-500/40 transition-all flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0">
                    <FileCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-white block truncate">
                      {doc.titulo}
                    </span>
                    <span className="text-[11px] text-slate-400 block truncate">
                      {doc.tipo} · {doc.dataEmissao ? `Emitido em ${doc.dataEmissao}` : 'Em dia'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                    {doc.status === 'valido' ? 'Válido' : doc.status}
                  </span>
                  <button
                    onClick={() => {
                      alert(`Visualização segura de documento: ${doc.titulo}`);
                    }}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="Baixar ou visualizar"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Botão de Solicitação em Destaque */}
          <button
            onClick={() => setSolicitarDocModalOpen(true)}
            className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Solicitar Novo Documento ao RH</span>
          </button>

          {/* Cartão de Dúvidas / Suporte com RH */}
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

      {/* Modal: Solicitar Documento ao RH */}
      {solicitarDocModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-[#091029] border border-blue-500/30 p-5 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <PlusCircle className="w-4 h-4 text-blue-400" />
                <span>Solicitar Documento Funcional</span>
              </h3>
              <button
                onClick={() => setSolicitarDocModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {solicitacaoSucesso ? (
              <div className="text-center py-6 space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <h4 className="text-sm font-bold text-white">Solicitação Enviada!</h4>
                <p className="text-xs text-slate-400">
                  O setor de RH emitirá o documento e notificará você pelo aplicativo.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSolicitarDocumento} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Tipo de Documento Desejado
                  </label>
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
                  <label className="block text-slate-300 font-semibold mb-1">
                    Finalidade / Observações
                  </label>
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
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Solicitar</span>
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
