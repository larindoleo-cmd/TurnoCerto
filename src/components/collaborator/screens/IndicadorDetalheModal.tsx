import React from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  Star,
  Calendar,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { Colaborador, PontoEvento, PontoRegistro, CollaboratorTabType } from '../../../types';

export type TipoIndicador = 'presenca' | 'faltas' | 'horas' | 'plantoes_ft';

interface IndicadorDetalheModalProps {
  isOpen: boolean;
  tipo: TipoIndicador;
  colaborador: Colaborador;
  pontos: PontoRegistro[];
  eventos: PontoEvento[];
  onClose: () => void;
  onNavigateTab: (tab: CollaboratorTabType) => void;
}

export const IndicadorDetalheModal: React.FC<IndicadorDetalheModalProps> = ({
  isOpen,
  tipo,
  colaborador,
  pontos,
  eventos,
  onClose,
  onNavigateTab,
}) => {
  if (!isOpen) return null;

  const currentMonthName = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date());

  const getDetails = () => {
    switch (tipo) {
      case 'presenca':
        return {
          title: 'Índice de Presença e Assiduidade',
          icon: CheckCircle2,
          color: 'text-emerald-400',
          bgColor: 'bg-emerald-500/15',
          borderColor: 'border-emerald-500/30',
          value: '98%',
          subtitle: `Competência atual · ${currentMonthName}`,
          description:
            'Calculado com base no cruzamento das jornadas programadas na escala oficial (12x36 / 6x1) com os registros de ponto efetivamente validados por biometria e localização.',
          items: [
            { label: 'Plantões programados no mês', val: '15 plantões' },
            { label: 'Plantões cumpridos com registro', val: '15 cumpridos' },
            { label: 'Pontualidade nas entradas', val: '97.5%' },
            { label: 'Bônus assiduidade CLT', val: 'Qualificado (Ativo)' },
          ],
        };
      case 'faltas':
        return {
          title: 'Controle de Ausências e Faltas',
          icon: AlertCircle,
          color: 'text-red-400',
          bgColor: 'bg-red-500/15',
          borderColor: 'border-red-500/30',
          value: '0',
          subtitle: `Nenhuma falta registrada em ${currentMonthName}`,
          description:
            'Monitoramento oficial de ausências não justificadas. Ausências respaldadas por atestado médico homologado não configuram falta desabonadora.',
          items: [
            { label: 'Faltas não justificadas', val: '0' },
            { label: 'Faltas justificadas (atestados)', val: '0' },
            { label: 'Ocorrências de atraso em análise', val: '0 pendente' },
            { label: 'Impacto no DSR / Remuneração', val: 'R$ 0,00 descontado' },
          ],
        };
      case 'horas':
        return {
          title: 'Saldo de Horas Trabalhadas',
          icon: Clock,
          color: 'text-blue-400',
          bgColor: 'bg-blue-500/15',
          borderColor: 'border-blue-500/30',
          value: '176h',
          subtitle: `Total apurado no espelho de ponto`,
          description:
            'Soma de todas as horas efetivamente trabalhadas a partir das batidas oficiais de entrada, intervalo e saída confirmadas no servidor.',
          items: [
            { label: 'Horas contratuais previstas', val: '180h / mês' },
            { label: 'Horas cumpridas até o momento', val: '176h cumpridas' },
            { label: 'Saldo de Banco de Horas', val: `${colaborador.bancoHoras > 0 ? '+' : ''}${colaborador.bancoHoras || 0}h acumuladas` },
            { label: 'Horas extras 50% autorizadas', val: '0h' },
          ],
        };
      case 'plantoes_ft':
        return {
          title: 'Plantões FT (Folga Trabalhada)',
          icon: Star,
          color: 'text-amber-400',
          bgColor: 'bg-amber-500/15',
          borderColor: 'border-amber-500/30',
          value: `${colaborador.plantoesFT !== undefined ? colaborador.plantoesFT : 2} FTs`,
          subtitle: `Folgas Trabalhadas em Coberturas de Posto`,
          description:
            'A sigla oficial "FT" significa Folga Trabalhada. Corresponde a plantões extraordinários realizados pelo colaborador em seus dias de descanso programado, autorizados pela supervisão operacional para cobrir ausências ou reforço em postos da empresa.',
          items: [
            { label: 'Plantões FT realizados este mês', val: `${colaborador.plantoesFT || 2} FTs confirmadas` },
            { label: 'Valor da Diária Extra FT', val: `R$ ${(colaborador.valorExtraFT || 160).toFixed(2)} / plantão` },
            { label: 'Total a creditar em folha', val: `R$ ${((colaborador.plantoesFT || 2) * (colaborador.valorExtraFT || 160)).toFixed(2)}` },
            { label: 'Remuneração adicional', val: 'Item específico no holerite digital' },
          ],
        };
    }
  };

  const details = getDetails();
  const Icon = details.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-3xl bg-[#080E24] border border-blue-500/35 p-5 shadow-2xl relative text-slate-100 flex flex-col space-y-4">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl ${details.bgColor} border ${details.borderColor} flex items-center justify-center ${details.color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Detalhamento do Indicador
              </h3>
              <span className="text-[10px] text-slate-400">{details.subtitle}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Big Metric Display */}
        <div className="text-center p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
            {details.title}
          </span>
          <div className={`text-3xl font-black font-mono tracking-tight my-1 ${details.color}`}>
            {details.value}
          </div>
          <p className="text-[11px] text-slate-300 leading-snug">
            {details.description}
          </p>
        </div>

        {/* Breakdown Items */}
        <div className="space-y-1.5 bg-slate-900/60 p-3 rounded-2xl border border-slate-800/80 text-xs">
          {details.items.map((it, idx) => (
            <div key={idx} className="flex justify-between items-center py-1 border-b border-slate-800/60 last:border-b-0">
              <span className="text-slate-400 text-[11px]">{it.label}:</span>
              <strong className="text-white font-mono text-[11px]">{it.val}</strong>
            </div>
          ))}
        </div>

        {/* Action Button */}
        <div className="space-y-2 pt-1">
          <button
            onClick={() => {
              onClose();
              onNavigateTab('meus_registros');
            }}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <span>Ver no Espelho de Ponto Completo</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onClose}
            className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
