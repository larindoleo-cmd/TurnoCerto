import React from 'react';
import { ShieldAlert, PhoneCall, LogOut, Lock } from 'lucide-react';
import { useApp } from '../../../context/AppContext';

interface AcessoBloqueadoScreenProps {
  onFaleComRH?: () => void;
}

export const AcessoBloqueadoScreen: React.FC<AcessoBloqueadoScreenProps> = ({ onFaleComRH }) => {
  const { logout, currentUser, empresaInfo } = useApp();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#050814] via-[#080E24] to-[#0A122E] flex flex-col justify-center items-center px-4 py-8 text-slate-100 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="w-full max-w-md space-y-6 text-center animate-in fade-in duration-300">
        {/* Shield Alert Icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/30 p-1 shadow-2xl shadow-red-500/20">
          <div className="w-full h-full bg-[#0E1530] rounded-[22px] flex items-center justify-center">
            <ShieldAlert className="w-10 h-10 text-red-400" />
          </div>
        </div>

        {/* Title & Explanation */}
        <div className="space-y-2">
          <span className="text-[10px] font-bold tracking-widest text-red-400 uppercase bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-full inline-block">
            Acesso Individual Bloqueado
          </span>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Vínculo de Colaborador Não Localizado
          </h1>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            Sua conta de acesso (<span className="text-slate-200 font-mono">{currentUser?.email}</span>) não possui um cadastro ativo de colaborador ou posto de trabalho vinculado no sistema.
          </p>
        </div>

        {/* Security Notice Card */}
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 text-left text-xs space-y-2.5">
          <div className="flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-slate-300 space-y-1">
              <strong className="text-white block">Política Estrita de Segurança e LGPD:</strong>
              <p className="text-slate-400">
                Por motivos de conformidade legal e proteção de dados, o TurnoCerto proíbe fallbacks genéricos. Para liberar o registro de ponto biométrico, escala e holerites, seu vínculo deve ser regularizado pela Supervisão ou Recursos Humanos.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-2">
          {onFaleComRH ? (
            <button
              onClick={onFaleComRH}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <PhoneCall className="w-4 h-4" />
              <span>Contatar Recursos Humanos</span>
            </button>
          ) : (
            <a
              href={`https://wa.me/55${(empresaInfo?.whatsapp || '11988421190').replace(/\D/g, '')}?text=Olá,%20meu%20acesso%20ao%20TurnoCerto%20está%20bloqueado%20por%20falta%20de%20vínculo%20funcional.`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <PhoneCall className="w-4 h-4" />
              <span>Falar com o RH via WhatsApp</span>
            </a>
          )}

          <button
            onClick={() => logout()}
            className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-slate-400" />
            <span>Sair do Aplicativo</span>
          </button>
        </div>

        <p className="text-[10px] text-slate-500">
          TurnoCerto · Suporte Operacional: {empresaInfo?.telefone || '(11) 3221-4000'}
        </p>
      </div>
    </div>
  );
};
