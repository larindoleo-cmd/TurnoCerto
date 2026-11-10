import React from 'react';
import {
  X,
  Receipt,
  Download,
  Printer,
  CheckCircle2,
  MapPin,
  Clock,
  Camera,
  ShieldCheck,
  Building2,
  User,
  Share2,
} from 'lucide-react';
import { PontoEvento, Colaborador, EmpresaInfo } from '../../../types';
import { downloadComprovantePontoPDF } from '../../../services/documentService';
import { CondominioBadge } from '../../common/CondominioBadge';

interface ComprovanteDetalheModalProps {
  isOpen: boolean;
  evento: PontoEvento | null;
  colaborador: Colaborador;
  empresa: EmpresaInfo;
  onClose: () => void;
}

export const ComprovanteDetalheModal: React.FC<ComprovanteDetalheModalProps> = ({
  isOpen,
  evento,
  colaborador,
  empresa,
  onClose,
}) => {
  if (!isOpen || !evento) return null;

  const dataFormatada = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'full',
  }).format(new Date(evento.serverTimestamp));

  const horaFormatada = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(evento.serverTimestamp));

  const handleDownloadPDF = () => {
    downloadComprovantePontoPDF(evento, colaborador, empresa);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-3xl bg-[#080E24] border border-blue-500/35 p-5 sm:p-6 shadow-2xl relative text-slate-100 flex flex-col max-h-[92vh] overflow-y-auto">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">Comprovante de Ponto</h3>
              <p className="text-[10px] text-slate-400 font-mono">Portaria MTE nº 671/2021</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Big Status Badge */}
        <div className="text-center pb-3">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 mx-auto mb-2 shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            {evento.labelEvento}
          </div>
          <div className="text-2xl font-black font-mono text-white tracking-tight mt-0.5">
            {horaFormatada}
          </div>
          <div className="text-[11px] text-slate-400 capitalize">
            {dataFormatada} (Horário Oficial de Brasília)
          </div>
        </div>

        {/* Ticket Details */}
        <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-4 space-y-3 font-mono text-xs">
          {/* Identificação */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-sans font-bold">
              Nº Comprovante (NSR)
            </span>
            <span className="text-blue-400 font-bold tracking-wider">{evento.comprovanteNumero}</span>
          </div>

          {/* Dados do Colaborador */}
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-400">Colaborador:</span>
              <strong className="text-white truncate max-w-[200px]">{colaborador.nome}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Matrícula:</span>
              <span className="text-slate-200">{colaborador.matricula}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Cargo / Função:</span>
              <span className="text-slate-200">{colaborador.funcao}</span>
            </div>
          </div>

          {/* Local / Posto */}
          <div className="pt-2 border-t border-slate-800/80 space-y-1 text-[11px]">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Condomínio:</span>
              <div className="flex items-center gap-1.5 min-w-0">
                <CondominioBadge
                  icone={evento.condominioIcone}
                  cor={evento.condominioCor}
                  size="xs"
                  showLabel={false}
                />
                <strong className="text-white truncate max-w-[190px]">{evento.condominioNome}</strong>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Posto:</span>
              <span className="text-slate-200">{evento.postoNome}</span>
            </div>
            {evento.isCobertura && (
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-300">
                <strong>Plantão de Cobertura (FT):</strong> Posto habitual: {evento.postoOriginalNome || colaborador.postoNome}
              </div>
            )}
          </div>

          {/* Auditoria & GPS */}
          <div className="pt-2 border-t border-slate-800/80 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-400">Autenticação:</span>
              <span className="text-emerald-400 font-bold">
                {evento.metodoAutenticacao === 'biometria_facial' ? 'Biometria Facial (128D)' : 'Biometria Digital'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Situação:</span>
              <span className="text-emerald-400 font-bold">Confirmado no Servidor</span>
            </div>
            {evento.latitude && (
              <div className="flex justify-between">
                <span className="text-slate-400">Geolocalização:</span>
                <span className="text-slate-300">
                  {evento.latitude.toFixed(5)}, {evento.longitude?.toFixed(5)}
                </span>
              </div>
            )}
            {evento.distanceM !== undefined && (
              <div className="flex justify-between">
                <span className="text-slate-400">Distância Geodésica:</span>
                <span className="text-slate-300">{evento.distanceM}m do posto</span>
              </div>
            )}
          </div>

          {/* Foto Facial anexada */}
          {evento.fotoBiometriaUrl && (
            <div className="pt-2 border-t border-slate-800/80 text-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-2 font-sans font-bold">
                Evidência Facial Capturada
              </span>
              <img
                src={evento.fotoBiometriaUrl}
                alt="Foto Facial"
                className="w-24 h-24 rounded-2xl object-cover border-2 border-emerald-500/50 mx-auto shadow-md"
              />
            </div>
          )}

          {/* Hash de Validade */}
          <div className="pt-2 border-t border-slate-800/80 text-[9px] text-slate-500 break-all leading-tight">
            Hash: {evento.idempotencyKey || `TC-VAL-${evento.id}`}
          </div>
        </div>

        {/* Ações */}
        <div className="space-y-2 mt-4">
          <button
            onClick={handleDownloadPDF}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Baixar / Imprimir Comprovante Oficial (PDF)</span>
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-medium text-xs transition-colors cursor-pointer border border-slate-800"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
