import React, { useState } from 'react';
import { ShieldAlert, Lock, CheckCircle2, Send, Clock, X, AlertCircle } from 'lucide-react';
import { Colaborador } from '../../../types';
import { useApp } from '../../../context/AppContext';
import { FacialCaptureEnrollment } from '../../facial/FacialCaptureEnrollment';

interface FacialEnrollmentModalProps {
  isOpen: boolean;
  colaborador: Colaborador;
  onClose: () => void;
  onSuccess: () => void;
}

export const FacialEnrollmentModal: React.FC<FacialEnrollmentModalProps> = ({
  isOpen,
  colaborador,
  onClose,
  onSuccess,
}) => {
  const { obterAutorizacaoAtiva, obterUltimaSolicitacao, solicitarCadastroFacial, showToast } = useApp();

  const [motivo, setMotivo] = useState('Primeiro cadastro de biometria facial para controle de ponto digital.');
  const [isSending, setIsSending] = useState(false);

  if (!isOpen) return null;

  const authAtiva = obterAutorizacaoAtiva(colaborador.id);
  const ultimaSol = obterUltimaSolicitacao(colaborador.id);
  const isPendente = ultimaSol?.status === 'pendente';

  const handleSolicitar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivo.trim()) {
      showToast('Por favor, informe a justificativa da solicitação.');
      return;
    }

    setIsSending(true);
    try {
      const res = await solicitarCadastroFacial(colaborador, motivo.trim(), 'primeiro_cadastro');
      if (res.success) {
        // Solicitado com sucesso
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md">
        {authAtiva ? (
          // Colaborador possui autorização ativa: abre a câmera com token
          <FacialCaptureEnrollment
            colaboradorId={colaborador.id}
            colaboradorNome={colaborador.nome}
            cargo={colaborador.funcao}
            cpf={colaborador.cpf}
            authorizationToken={authAtiva.tokenAutorizacao}
            authorizationId={authAtiva.id}
            onSuccess={() => {
              onSuccess();
              onClose();
            }}
            onCancel={onClose}
          />
        ) : (
          // Colaborador NÃO possui autorização ativa: modal de solicitação obrigatória
          <div className="bg-[#09102A] text-slate-100 rounded-3xl p-5 border border-blue-500/35 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Autorização de Biometria Necessária</h3>
                  <p className="text-[11px] text-slate-400">Controle Operacional & Segurança LGPD</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-amber-300 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Liberação da Câmera pelo Supervisor</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Por determinação de segurança e conformidade com a Portaria 671 MTE, o cadastro ou recadastro biométrico exige aprovação e token de liberação emitido pelo supervisor de operações.
              </p>
            </div>

            {isPendente ? (
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-2.5">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mx-auto">
                  <Clock className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <strong className="text-white text-xs block">Solicitação em Análise</strong>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Sua solicitação foi enviada ao supervisor em{' '}
                    <span className="text-blue-300 font-mono font-semibold">
                      {new Date(ultimaSol.criadoEm).toLocaleDateString('pt-BR')} às{' '}
                      {new Date(ultimaSol.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    .
                  </p>
                </div>
                <div className="text-[10px] text-slate-500 bg-slate-950 p-2 rounded-xl border border-slate-800 font-mono text-left">
                  Motivo: &quot;{ultimaSol.motivo}&quot;
                </div>
                <button
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  Entendido, aguardar supervisor
                </button>
              </div>
            ) : (
              <form onSubmit={handleSolicitar} className="space-y-3">
                <div>
                  <label className="block text-slate-400 text-xs font-medium mb-1">
                    Motivo do Cadastro / Recadastro
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Ex: Primeiro cadastro no posto, alteração de óculos, etc."
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSending}
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/30 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSending ? 'Enviando...' : 'Solicitar Liberação'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
