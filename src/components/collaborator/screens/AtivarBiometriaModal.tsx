import React, { useState } from 'react';
import {
  X,
  Fingerprint,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Smartphone,
  Lock,
} from 'lucide-react';
import { Colaborador } from '../../../types';
import { registerDevicePasskey, getDeviceLabel } from '../../../services/webauthnService';

interface AtivarBiometriaModalProps {
  isOpen: boolean;
  colaborador: Colaborador;
  onClose: () => void;
  onSuccess: () => void;
}

export const AtivarBiometriaModal: React.FC<AtivarBiometriaModalProps> = ({
  isOpen,
  colaborador,
  onClose,
  onSuccess,
}) => {
  const [deviceLabel, setDeviceLabel] = useState(getDeviceLabel());
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  if (!isOpen) return null;

  const handleRegister = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await registerDevicePasskey(
        colaborador.id,
        colaborador.nome,
        deviceLabel
      );
      if (res.success) {
        setIsDone(true);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1800);
      } else {
        setErrorMessage(res.errorMessage || 'Falha ao registrar credencial biométrica.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-3xl bg-[#091029] border border-blue-500/35 p-5 sm:p-6 shadow-2xl text-slate-100 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Fingerprint className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-bold text-white">Ativar Biometria no Aparelho</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isDone ? (
          <div className="text-center py-6 space-y-2">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-base font-bold text-white">Biometria Ativada!</h4>
            <p className="text-xs text-slate-400">
              Seu aparelho está pronto para registrar pontos rápidos e seguros.
            </p>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-blue-950/30 border border-blue-500/25 space-y-2">
              <div className="flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-[11px] text-slate-300 space-y-1">
                  <strong className="text-white block">Privacidade Garantida:</strong>
                  <p className="text-slate-400">
                    Sua impressão digital ou imagem facial permanece protegida no hardware do seu smartphone. Nenhuma imagem é transmitida para os servidores.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Nome / Identificação deste Aparelho
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={deviceLabel}
                  onChange={(e) => setDeviceLabel(e.target.value)}
                  placeholder="Ex: Meu iPhone, Samsung Galaxy..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-blue-500"
                />
                <Smartphone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/50 text-red-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              onClick={handleRegister}
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white font-bold text-xs shadow-xl shadow-blue-600/30 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Aguardando leitura biométrica no aparelho...</span>
                </>
              ) : (
                <>
                  <Fingerprint className="w-4 h-4" />
                  <span>Ativar Biometria (Passkey)</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
