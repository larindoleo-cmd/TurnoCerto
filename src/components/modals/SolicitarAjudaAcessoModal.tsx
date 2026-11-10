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
  Phone,
  Building,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Colaborador } from '../../types';

export const SolicitarAjudaAcessoModal: React.FC = () => {
  const {
    ajudaAcessoModalOpen,
    setAjudaAcessoModalOpen,
    solicitarAjudaSenha,
    colaboradores,
    showToast,
  } = useApp();

  const [identificador, setIdentificador] = useState('');
  const [telefone, setTelefone] = useState('');
  const [observacao, setObservacao] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [enviadoComSucesso, setEnviadoComSucesso] = useState(false);
  const [colaboradorEncontrado, setColaboradorEncontrado] = useState<Colaborador | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!ajudaAcessoModalOpen) return null;

  // Busca rápida de colaborador conforme digitação
  const handleIdentificadorChange = (val: string) => {
    setIdentificador(val);
    setError(null);
    const clean = val.trim().toLowerCase();
    const cleanDigits = val.replace(/\D/g, '');
    if (clean.length >= 3) {
      const match = colaboradores.find((c) => {
        const mEmail = c.email && c.email.toLowerCase() === clean;
        const mCpf = c.cpf && c.cpf.replace(/\D/g, '') === cleanDigits && cleanDigits.length >= 8;
        const mMat = c.matricula && c.matricula.toLowerCase() === clean;
        const mNome = c.nome && c.nome.toLowerCase().includes(clean);
        return mEmail || mCpf || mMat || mNome;
      });
      if (match) {
        setColaboradorEncontrado(match);
        if (!telefone && match.telefone) {
          setTelefone(match.telefone);
        }
      } else {
        setColaboradorEncontrado(null);
      }
    } else {
      setColaboradorEncontrado(null);
    }
  };

  const handleEnviarSolicitacao = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!identificador.trim()) {
      setError('Informe seu CPF, e-mail ou matrícula.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await solicitarAjudaSenha(identificador.trim(), telefone.trim(), observacao.trim());
      if (res.success) {
        setEnviadoComSucesso(true);
        if (res.colaboradorLocalizado) {
          setColaboradorEncontrado(res.colaboradorLocalizado);
        }
      } else {
        setError(res.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWhatsAppSupervisor = () => {
    const nomeColab = colaboradorEncontrado?.nome || identificador || 'Colaborador';
    const matColab = colaboradorEncontrado?.matricula ? ` (Matrícula: ${colaboradorEncontrado.matricula})` : '';
    const postoColab = colaboradorEncontrado?.postoNome ? ` do posto ${colaboradorEncontrado.postoNome}` : '';

    const mensagem = `Olá Supervisor, sou o colaborador *${nomeColab}*${matColab}${postoColab}.
Esqueci minha senha de acesso ao aplicativo TurnoCerto e preciso de uma nova senha provisória para bater meu ponto e acompanhar meus turnos.
Poderia me ajudar a redefinir?`;

    // Telefone da supervisora ou padrão
    const telSupervisor = '11999990000';
    const url = `https://wa.me/55${telSupervisor}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-3xl bg-[#080E22] border border-blue-500/40 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-3 duration-250">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Esqueceu sua Senha?</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Ajuda com acesso e liberação de senha provisória
              </p>
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
                <h3 className="text-sm font-bold text-white">Solicitação Enviada ao Supervisor!</h3>
                <p className="text-slate-400 text-[11px] max-w-xs mx-auto">
                  Um alerta de prioridade alta foi gerado no painel da Supervisão Operacional com seus dados.
                </p>
              </div>

              {colaboradorEncontrado && (
                <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-left flex items-center gap-3">
                  <img
                    src={colaboradorEncontrado.foto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                    alt={colaboradorEncontrado.nome}
                    className="w-10 h-10 rounded-xl object-cover border border-blue-500/30"
                  />
                  <div className="min-w-0">
                    <strong className="text-white block truncate">{colaboradorEncontrado.nome}</strong>
                    <span className="text-[10px] text-slate-400 block">
                      {colaboradorEncontrado.funcao} · {colaboradorEncontrado.postoNome}
                    </span>
                  </div>
                </div>
              )}

              <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-500/20 text-[11px] text-slate-300 text-left space-y-1">
                <span className="font-bold text-white block">Quer agilizar o atendimento?</span>
                <p className="text-slate-400">
                  Você também pode enviar uma mensagem direta para a supervisão no WhatsApp:
                </p>
                <button
                  type="button"
                  onClick={handleWhatsAppSupervisor}
                  className="w-full mt-2 py-2 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Chamar Supervisor no WhatsApp</span>
                </button>
              </div>

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
                  <strong className="text-white block">Como funciona a recuperação de senha?</strong>
                  <p className="text-slate-400">
                    O controle de senhas do TurnoCerto é gerenciado pela supervisão operacional para evitar fraudes em horários de ponto. Ao solicitar, seu supervisor gera uma nova senha provisória imediatamente.
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
                {/* Identificador */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Seu CPF, E-mail ou Matrícula <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={identificador}
                      onChange={(e) => handleIdentificadorChange(e.target.value)}
                      placeholder="Ex: 123.456.789-00 ou seu e-mail"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs font-mono"
                    />
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {colaboradorEncontrado && (
                  <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center gap-2.5 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-emerald-300 font-bold block truncate">
                        {colaboradorEncontrado.nome}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        Matrícula {colaboradorEncontrado.matricula || 'N/A'} · {colaboradorEncontrado.postoNome}
                      </span>
                    </div>
                  </div>
                )}

                {/* Telefone de Retorno */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    WhatsApp para receber a nova senha
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      placeholder="(11) 98765-4321"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs font-mono"
                    />
                    <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Observação */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Observação (opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    placeholder="Ex: Estou no condomínio Alvorada precisando bater a entrada..."
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs resize-none"
                  />
                </div>

                {/* Botões de Ação */}
                <div className="pt-2 space-y-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    <span>{isSubmitting ? 'Enviando...' : 'Notificar Supervisor Agora'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleWhatsAppSupervisor}
                    className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Falar no WhatsApp com a Supervisão</span>
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
