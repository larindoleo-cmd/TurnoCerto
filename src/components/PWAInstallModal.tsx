import React from 'react';
import { X, Download, Share, PlusSquare, Smartphone, Check } from 'lucide-react';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInstall: () => void;
  hasNativePrompt: boolean;
  isIOS: boolean;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  isOpen,
  onClose,
  onInstall,
  hasNativePrompt,
  isIOS,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full sm:max-w-md flex flex-col rounded-t-3xl sm:rounded-2xl bg-[#0B132B] border border-blue-500/30 shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-250">
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Instalar TurnoCerto no Celular</h2>
              <p className="text-[11px] text-slate-400">Acesso rápido 60 FPS direto da tela de início</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-800/40 space-y-2 text-slate-200">
            <p className="font-semibold text-white">Vantagens do Aplicativo PWA Instalado:</p>
            <ul className="space-y-1.5 text-[11px] text-slate-300">
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                Funcionamento sem barras do navegador (Tela Cheia Nativa)
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                Notificações instantâneas de postos descobertos e faltas
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                Carregamento ultra-rápido mesmo em redes móveis instáveis
              </li>
            </ul>
          </div>

          {hasNativePrompt ? (
            <div className="text-center py-2">
              <button
                onClick={() => {
                  onInstall();
                  onClose();
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white font-bold text-sm shadow-lg shadow-blue-500/25 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Instalar Aplicativo Agora
              </button>
            </div>
          ) : isIOS ? (
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5 text-slate-300">
              <p className="font-semibold text-white">Como instalar no iPhone / iPad (Safari):</p>
              <div className="flex items-start gap-2.5 text-[11px]">
                <div className="w-5 h-5 rounded-full bg-slate-800 text-blue-400 flex items-center justify-center shrink-0 font-bold">
                  1
                </div>
                <span>
                  Toque no botão <strong className="text-white">Compartilhar</strong> (ícone do quadrado com seta para cima) na barra do Safari.
                </span>
              </div>
              <div className="flex items-start gap-2.5 text-[11px]">
                <div className="w-5 h-5 rounded-full bg-slate-800 text-blue-400 flex items-center justify-center shrink-0 font-bold">
                  2
                </div>
                <span>
                  Role para baixo e selecione <strong className="text-white">Adicionar à Tela de Início</strong>.
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-2 text-slate-400">
              <p>Abra o menu do seu navegador (três pontos ⋮) e selecione "Instalar aplicativo" ou "Adicionar à tela inicial".</p>
            </div>
          )}
        </div>

        <div className="p-3 bg-slate-900/80 border-t border-slate-800 shrink-0 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 rounded-xl"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
