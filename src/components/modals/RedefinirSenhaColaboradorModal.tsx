import React, { useState, useEffect } from 'react';
import {
  X,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  Sparkles,
  Copy,
  Check,
  MessageSquare,
  ShieldCheck,
  AlertCircle,
  Smartphone,
  Mail,
  User,
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

  const [novaSenha, setNovaSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [salvoComSucesso, setSalvoComSucesso] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Gera uma senha temporária inicial ao abrir o modal
  useEffect(() => {
    if (redefinirSenhaModalOpen && colaboradorParaRedefinirSenha) {
      gerarSenhaAleatoria();
      setSalvoComSucesso(false);
      setError(null);
      setCopied(false);
    }
  }, [redefinirSenhaModalOpen, colaboradorParaRedefinirSenha]);

  if (!redefinirSenhaModalOpen || !colaboradorParaRedefinirSenha) return null;

  const colab = colaboradorParaRedefinirSenha;

  const gerarSenhaAleatoria = () => {
    const num = Math.floor(1000 + Math.random() * 9000);
    const pass = `Turno@${num}`;
    setNovaSenha(pass);
    setShowSenha(true);
    setError(null);
  };

  const aplicarSenhaPadrao = () => {
    setNovaSenha('Turno@2026');
    setShowSenha(true);
    setError(null);
  };

  // Texto formatado para envio ao colaborador
  const mensagemWhatsApp = `*🔐 TurnoCerto - Novas Credenciais de Acesso*

Olá *${colab.nome}*,
Sua senha de acesso ao aplicativo foi atualizada pela Supervisão:

👤 *Login:* ${colab.email || colab.cpf || colab.matricula}
🔑 *Nova Senha:* ${novaSenha}
📍 *Posto:* ${colab.postoNome}

Você já pode entrar no aplicativo para registrar seu ponto e acompanhar seus turnos.
Caso deseje, altere esta senha em _Meu Perfil > Segurança e Senha_.`;

  const handleCopiar = async () => {
    try {
      await navigator.clipboard.writeText(mensagemWhatsApp);
      setCopied(true);
      showToast('Credenciais copiadas para a área de transferência!');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      showToast('Falha ao copiar automaticamente.');
    }
  };

  const handleEnviarWhatsApp = () => {
    const numLimpo = (colab.telefone || '').replace(/\D/g, '');
    const url = numLimpo
      ? `https://wa.me/55${numLimpo}?text=${encodeURIComponent(mensagemWhatsApp)}`
      : `https://wa.me/?text=${encodeURIComponent(mensagemWhatsApp)}`;
    window.open(url, '_blank');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!novaSenha || novaSenha.trim().length < 6) {
      setError('A senha deve possuir no mínimo 6 caracteres.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await redefinirSenhaColaborador(colab.id, novaSenha.trim());
      if (res.success) {
        setSalvoComSucesso(true);
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
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Redefinir Senha do Colaborador</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Liberação de nova credencial pelo supervisor imediato
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

        {/* Informações do Colaborador */}
        <div className="p-5 space-y-4 text-xs">
          <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center gap-3">
            <img
              src={colab.foto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
              alt={colab.nome}
              className="w-12 h-12 rounded-xl object-cover border border-blue-500/30 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <strong className="text-sm font-bold text-white truncate block">
                  {colab.nome}
                </strong>
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
                  <span className="font-mono text-slate-300 truncate max-w-[160px]">
                    {colab.email || `${colab.nome.toLowerCase().replace(/\s+/g, '.')}@turnocerto.com.br`}
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

          {salvoComSucesso && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2 font-bold text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Senha atualizada com sucesso no banco de dados!</span>
              </div>
              <p className="text-[11px] text-emerald-300/80">
                Envie as novas credenciais para o colaborador pelo WhatsApp ou copie o texto abaixo para informá-lo.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Campo da Nova Senha */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-300 font-semibold">
                  Nova Senha Provisória <span className="text-red-400">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={gerarSenhaAleatoria}
                    className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium transition-colors hover:underline cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-blue-400" />
                    <span>Gerar Nova</span>
                  </button>
                  <span className="text-slate-600">·</span>
                  <button
                    type="button"
                    onClick={aplicarSenhaPadrao}
                    className="text-[10px] text-amber-400 hover:text-amber-300 font-medium transition-colors hover:underline cursor-pointer"
                  >
                    Turno@2026
                  </button>
                </div>
              </div>

              <div className="relative">
                <input
                  type={showSenha ? 'text' : 'password'}
                  required
                  value={novaSenha}
                  onChange={(e) => {
                    setNovaSenha(e.target.value);
                    setSalvoComSucesso(false);
                  }}
                  placeholder="Digite a nova senha provisória"
                  className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs font-mono font-bold tracking-wide"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <button
                  type="button"
                  onClick={() => setShowSenha(!showSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  title={showSenha ? 'Ocultar' : 'Ver'}
                >
                  {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Como o funcionário deve logar */}
            <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-500/20 text-[11px] text-slate-300 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-white">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                <span>Credenciais de Acesso deste Colaborador:</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-slate-300">
                <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Identificador / Login:</span>
                  <span className="font-mono font-semibold text-blue-300 truncate block">
                    {colab.email || colab.cpf || colab.matricula}
                  </span>
                </div>
                <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Nova Senha:</span>
                  <span className="font-mono font-bold text-emerald-300 truncate block">
                    {novaSenha || '---'}
                  </span>
                </div>
              </div>
            </div>

            {/* Ações de Envio e Salvamento */}
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
                    <span>Copiar Acesso</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleEnviarWhatsApp}
                className="w-full sm:flex-1 py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs border border-emerald-600 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-lg shadow-emerald-700/20"
                title="Abrir WhatsApp com credenciais pré-preenchidas"
              >
                <MessageSquare className="w-4 h-4 text-white" />
                <span>Enviar no WhatsApp</span>
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-blue-600/30 active:scale-95 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? 'Salvando...' : 'Salvar no Banco'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
