import React, { useState } from 'react';
import { X, Key, Lock, Eye, EyeOff, CheckCircle2, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const ChangePasswordModal: React.FC = () => {
  const {
    currentUser,
    trocarSenhaModalOpen,
    setTrocarSenhaModalOpen,
    trocarSenha,
  } = useApp();

  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showAtual, setShowAtual] = useState(false);
  const [showNova, setShowNova] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!trocarSenhaModalOpen) return null;

  const handleSuggestPassword = () => {
    const num = Math.floor(1000 + Math.random() * 9000);
    const suggested = `Turno@${num}!`;
    setNovaSenha(suggested);
    setConfirmarSenha(suggested);
    setShowNova(true);
    setShowConfirm(true);
    setError(null);
  };

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pass.length >= 6) score++;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    if (score <= 2) return { score: 1, label: 'Fraca', color: 'bg-red-500 text-red-400' };
    if (score <= 4) return { score: 2, label: 'Média', color: 'bg-amber-500 text-amber-400' };
    return { score: 3, label: 'Forte', color: 'bg-emerald-500 text-emerald-400' };
  };

  const strength = getPasswordStrength(novaSenha);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!novaSenha || novaSenha.trim().length < 6) {
      setError('A nova senha deve possuir no mínimo 6 caracteres.');
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setError('A confirmação da nova senha não confere.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await trocarSenha(senhaAtual, novaSenha);
      if (!result.success) {
        setError(result.message);
      } else {
        setSenhaAtual('');
        setNovaSenha('');
        setConfirmarSenha('');
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
      <div className="w-full max-w-md rounded-3xl bg-[#080E22] border border-blue-500/30 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-3 duration-250">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Trocar Senha de Acesso</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Atualize sua credencial de segurança do TurnoCerto
              </p>
            </div>
          </div>

          <button
            onClick={() => setTrocarSenhaModalOpen(false)}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User identification badge */}
        {currentUser && (
          <div className="px-5 pt-4">
            <div className="p-3 rounded-2xl bg-blue-950/20 border border-blue-500/25 flex items-center gap-3">
              <img
                src={
                  currentUser.avatarUrl ||
                  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80'
                }
                alt={currentUser.nome}
                className="w-10 h-10 rounded-xl object-cover border border-blue-500/30 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold text-white block truncate">
                  {currentUser.nome}
                </span>
                <span className="text-[11px] text-blue-300 font-mono block truncate">
                  {currentUser.email}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5 capitalize">
                  Perfil: {currentUser.role === 'admin' ? 'Administrador' : currentUser.role === 'supervisor' ? 'Supervisor Operacional' : 'Funcionário / Colaborador'}
                </span>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Senha Atual */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Senha Atual
            </label>
            <div className="relative">
              <input
                type={showAtual ? 'text' : 'password'}
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                placeholder="Digite sua senha atual ou temporária"
                className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs font-mono"
              />
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <button
                type="button"
                onClick={() => setShowAtual(!showAtual)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                title={showAtual ? 'Ocultar' : 'Ver'}
              >
                {showAtual ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Nova Senha */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-300 font-semibold">
                Nova Senha <span className="text-red-400">*</span>
              </label>
              <button
                type="button"
                onClick={handleSuggestPassword}
                className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium transition-colors hover:underline"
              >
                <Sparkles className="w-3 h-3" />
                <span>Gerar Senha Forte</span>
              </button>
            </div>
            <div className="relative">
              <input
                type={showNova ? 'text' : 'password'}
                required
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs font-mono"
              />
              <Key className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <button
                type="button"
                onClick={() => setShowNova(!showNova)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                title={showNova ? 'Ocultar' : 'Ver'}
              >
                {showNova ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Password strength indicator */}
            {novaSenha && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">Força da senha:</span>
                  <span className={`font-semibold ${strength.color}`}>
                    {strength.label}
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden flex gap-1">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      strength.score >= 1 ? (strength.score === 1 ? 'bg-red-500 w-1/3' : strength.score === 2 ? 'bg-amber-500 w-2/3' : 'bg-emerald-500 w-full') : 'w-0'
                    }`}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Confirmar Nova Senha */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Confirmar Nova Senha <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                required
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                placeholder="Repita a nova senha"
                className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs font-mono"
              />
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                title={showConfirm ? 'Ocultar' : 'Ver'}
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-2 text-[11px] text-slate-400 bg-slate-900/40 border border-slate-800/80 p-2.5 rounded-xl flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <span>
              Ao alterar a senha, as novas credenciais são salvas no banco de dados e passam a valer para todos os acessos web e aplicativo móvel.
            </span>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setTrocarSenhaModalOpen(false)}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs transition-colors"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Salvando...' : 'Salvar Nova Senha'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
