import React, { useState, useEffect } from 'react';
import {
  X,
  KeyRound,
  CheckCircle2,
  Copy,
  Check,
  MessageSquare,
  ShieldCheck,
  AlertCircle,
  Smartphone,
  Mail,
  Send,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const RedefinirSenhaColaboradorModal: React.FC = () => {
  const {
    redefinirSenhaModalOpen,
    setRedefinirSenhaModalOpen,
    colaboradorParaRedefinirSenha,
    redefinirSenhaColaborador,
    showToast,
  } = useApp();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [enviadoComSucesso, setEnviadoComSucesso] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (redefinirSenhaModalOpen && colaboradorParaRedefinirSenha) {
      setEnviadoComSucesso(false);
      setStatusMessage(null);
      setError(null);
      setCopied(false);
    }
  }, [redefinirSenhaModalOpen, colaboradorParaRedefinirSenha]);

  if (!redefinirSenhaModalOpen || !colaboradorParaRedefinirSenha) return null;

  const colab = colaboradorParaRedefinirSenha;
  const emailDestino = colab.email || '';
  const numLimpo = (colab.telefone || '').replace(/\D/g, '');

  const mensagemOrientacao = `TurnoCerto - Recuperação de Acesso

Olá ${colab.nome},
Um link oficial de redefinição de senha foi enviado via Supabase Auth para o seu e-mail corporativo: ${emailDestino || '(sem e-mail cadastrado)'}.

Acesse sua caixa de entrada para definir sua nova senha com segurança.`;

  const whatsappUrl = numLimpo
    ? `https://wa.me/55${numLimpo}?text=${encodeURIComponent(mensagemOrientacao)}`
    : null;

  const handleCopiar = async () => {
    try {
      await navigator.clipboard.writeText(mensagemOrientacao);
      setCopied(true);
      showToast('Orientações de recuperação copiadas.');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      showToast('Não foi possível copiar automaticamente.');
    }
  };

  const handleEnviarReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await redefinirSenhaColaborador(colab.id, '');
      if (res.success) {
        setEnviadoComSucesso(true);
        setStatusMessage(res.message);
      } else {
        setError(res.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded-3xl bg-[#080E22] border border-blue-500/40 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-3 duration-250">
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Redefinir Acesso do Colaborador</h2>
              <p className="text-[11px] text-slate-400">
                Envio seguro de link oficial de recuperação via Supabase Auth
              </p>
            </div>
          </div>

          <button
            onClick={() => setRedefinirSenhaModalOpen(false)}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center gap-3">
            {colab.foto ? (
              <img
                src={colab.foto}
                alt={colab.nome}
                className="w-12 h-12 rounded-xl object-cover border border-blue-500/30 shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-slate-800 border border-blue-500/30 text-blue-200 font-bold flex items-center justify-center shrink-0">
                {colab.nome.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <strong className="text-sm font-bold text-white truncate block">{colab.nome}</strong>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                  {colab.matricula || 'SEM MATRÍCULA'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {colab.funcao} · {colab.postoNome}
              </p>
              <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3 text-blue-400" />
                  <span className="font-mono text-slate-300 truncate max-w-[190px]">
                    {emailDestino || 'Sem e-mail cadastrado'}
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <Smartphone className="w-3 h-3 text-emerald-400" />
                  <span className="text-slate-300">{colab.telefone || 'Sem telefone'}</span>
                </span>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {enviadoComSucesso && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs space-y-1 animate-in fade-in">
              <div className="flex items-center gap-2 font-bold text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Link oficial disparado com sucesso!</span>
              </div>
              <p className="text-[11px] text-emerald-300/80">{statusMessage}</p>
            </div>
          )}

          <form onSubmit={handleEnviarReset} className="space-y-4">
            <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-500/20 text-[11px] text-slate-300 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-white">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                <span>Segurança Zero-Trust:</span>
              </div>
              <p className="text-slate-400">
                Por segurança, senhas nunca são exibidas ou gravadas em texto simples no banco de dados. Ao confirmar abaixo, o Supabase Auth envia um link temporário exclusivo para o e-mail cadastrado do colaborador.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
              <button
                type="button"
                onClick={handleCopiar}
                className="w-full sm:flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-300">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-400" />
                    <span>Copiar Aviso</span>
                  </>
                )}
              </button>

              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:flex-1 py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs border border-emerald-600 flex items-center justify-center gap-1.5 transition-all"
                  title="Avisar colaborador pelo WhatsApp"
                >
                  <MessageSquare className="w-4 h-4 text-white" />
                  <span>Avisar no WhatsApp</span>
                </a>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !emailDestino}
                className="w-full sm:flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-blue-600/30 active:scale-95 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'Enviando...' : 'Enviar Link por E-mail'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
