import React, { useState } from 'react';
import {
  X,
  KeyRound,
  ShieldAlert,
  MessageSquare,
  Send,
  CheckCircle2,
  AlertCircle,
  User,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const SolicitarAjudaAcessoModal: React.FC = () => {
  const {
    ajudaAcessoModalOpen,
    setAjudaAcessoModalOpen,
    solicitarAjudaSenha,
    empresaInfo,
  } = useApp();

  const [identificador, setIdentificador] = useState('');
  const [telefone, setTelefone] = useState('');
  const [observacao, setObservacao] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [enviadoComSucesso, setEnviadoComSucesso] = useState(false);
  const [respostaServidor, setRespostaServidor] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  if (!ajudaAcessoModalOpen) return null;

  const whatsappDigits = (empresaInfo.whatsapp || empresaInfo.telefone || '').replace(/\D/g, '');
  const whatsappMessage = `Olá Supervisão, sou colaborador (${identificador || 'não informado'}) e solicito ajuda para recuperação de acesso no TurnoCerto.`;
  const whatsappHref = whatsappDigits
    ? `https://wa.me/55${whatsappDigits}?text=${encodeURIComponent(whatsappMessage)}`
    : null;

  const handleEnviarSolicitacao = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!identificador.trim()) {
      setError('Informe seu e-mail corporativo cadastrado.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await solicitarAjudaSenha(identificador.trim(), telefone.trim(), observacao.trim());
      if (res.success) {
        setEnviadoComSucesso(true);
        setRespostaServidor(res.message);
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
      <div className="w-full max-w-md rounded-3xl bg-[#080E22] border border-blue-500/40 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-3 duration-250">
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Esqueceu sua Senha?</h2>
              <p className="text-[11px] text-slate-400">Recuperação segura via Supabase Auth</p>
            </div>
          </div>

          <button
            onClick={() => setAjudaAcessoModalOpen(false)}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {enviadoComSucesso ? (
            <div className="space-y-4 text-center py-3 animate-in fade-in">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">Solicitação Processada</h3>
                <p className="text-slate-300 text-[11px] max-w-xs mx-auto">{respostaServidor}</p>
              </div>

              {whatsappHref && (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-semibold flex items-center justify-center gap-1.5 transition-all"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Contatar Suporte Operacional (WhatsApp)</span>
                </a>
              )}

              <button
                type="button"
                onClick={() => setAjudaAcessoModalOpen(false)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
              >
                Voltar para a Tela de Login
              </button>
            </div>
          ) : (
            <>
              <div className="p-3 rounded-2xl bg-blue-950/20 border border-blue-500/20 text-[11px] text-slate-300 flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <strong className="text-white block">Recuperação Oficial por E-mail</strong>
                  <p className="text-slate-400">
                    Informe seu e-mail corporativo para receber o link oficial de redefinição de senha do Supabase Auth. Caso não tenha acesso ao e-mail, procure seu supervisor ou o RH.
                  </p>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleEnviarSolicitacao} className="space-y-3.5">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    E-mail Corporativo Cadastrado <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={identificador}
                      onChange={(e) => {
                        setIdentificador(e.target.value);
                        setError(null);
                      }}
                      placeholder="nome@suaempresa.com.br"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs font-mono"
                    />
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Telefone de Contato (opcional)
                  </label>
                  <input
                    type="text"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Observação (opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    placeholder="Ex: Preciso recuperar acesso antes do turno..."
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs resize-none"
                  />
                </div>

                <div className="pt-2 space-y-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    <span>{isSubmitting ? 'Enviando...' : 'Solicitar Link de Redefinição'}</span>
                  </button>

                  {whatsappHref && (
                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>Falar com Suporte da Empresa</span>
                    </a>
                  )}
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
