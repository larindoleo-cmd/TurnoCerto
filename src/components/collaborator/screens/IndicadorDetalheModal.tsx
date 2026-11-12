import React, { useMemo } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  Star,
  ArrowRight,
} from 'lucide-react';
import {
  Colaborador,
  PontoEvento,
  PontoRegistro,
  CoberturaProgramada,
  CollaboratorTabType,
} from '../../../types';

export type TipoIndicador = 'presenca' | 'faltas' | 'horas' | 'plantoes_ft';

interface IndicadorDetalheModalProps {
  isOpen: boolean;
  tipo: TipoIndicador;
  colaborador: Colaborador;
  pontos: PontoRegistro[];
  eventos: PontoEvento[];
  coberturas?: CoberturaProgramada[];
  onClose: () => void;
  onNavigateTab: (tab: CollaboratorTabType) => void;
}

export function parseHoursStringToMinutes(val?: string): number {
  if (!val) return 0;
  const colonMatch = val.match(/(\d+)\s*:\s*(\d+)/);
  if (colonMatch) {
    return Number(colonMatch[1]) * 60 + Number(colonMatch[2]);
  }
  const hMatch = val.match(/(\d+)\s*h(?:\s*(\d+))?/i);
  if (hMatch) {
    return Number(hMatch[1]) * 60 + Number(hMatch[2] || 0);
  }
  return 0;
}

export function computeColaboradorMetrics(
  colaborador: Colaborador,
  pontos: PontoRegistro[],
  eventos: PontoEvento[],
  coberturas: CoberturaProgramada[] = []
) {
  const now = new Date();
  const currentMonthPrefix = new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).format(now); // YYYY-MM

  const confirmedEvents = eventos.filter((e) => e.verificationStatus === 'confirmado');
  const monthEvents = confirmedEvents.filter((e) => {
    const dayBr = new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(e.serverTimestamp));
    return dayBr.startsWith(currentMonthPrefix);
  });

  const faltasCount = pontos.filter((p) => p.statusPonto === 'Falta').length;
  const atrasosCount = pontos.filter((p) => p.statusPonto === 'Atraso').length;
  const regularesOuCobertura = pontos.filter(
    (p) => p.statusPonto === 'Regular' || p.statusPonto === 'Hora Extra' || p.statusPonto === 'Cobertura'
  ).length;

  // Soma minutos dos espelhos consolidados
  let totalMinutes = pontos.reduce((acc, p) => acc + parseHoursStringToMinutes(p.totalHoras), 0);

  // Se ainda não há espelhos fechados, calcula a partir dos pares entrada -> saida nos eventos confirmados do mês
  if (totalMinutes === 0 && monthEvents.length > 0) {
    const asc = [...monthEvents].sort(
      (a, b) => new Date(a.serverTimestamp).getTime() - new Date(b.serverTimestamp).getTime()
    );
    let openEntryMs: number | null = null;
    for (const ev of asc) {
      if (ev.tipoEvento === 'entrada' && openEntryMs === null) {
        openEntryMs = new Date(ev.serverTimestamp).getTime();
      } else if (ev.tipoEvento === 'saida' && openEntryMs !== null) {
        const diffMin = Math.max(0, Math.round((new Date(ev.serverTimestamp).getTime() - openEntryMs) / 60000));
        totalMinutes += diffMin;
        openEntryMs = null;
      }
    }
  }

  const workedHours = Math.floor(totalMinutes / 60);
  const workedRemMin = totalMinutes % 60;
  const horasTrabalhadasLabel =
    totalMinutes > 0
      ? workedRemMin > 0
        ? `${workedHours}h${String(workedRemMin).padStart(2, '0')}`
        : `${workedHours}h`
      : '0h';

  const daysWithPunch = new Set(
    monthEvents.map((e) =>
      new Intl.DateTimeFormat('fr-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(e.serverTimestamp))
    )
  ).size;

  const totalBasePresenca = pontos.length > 0 ? pontos.length : daysWithPunch;
  const presencaPercent =
    totalBasePresenca > 0
      ? Math.max(0, Math.min(100, Math.round(((totalBasePresenca - faltasCount) / totalBasePresenca) * 100)))
      : colaborador.status === 'falta'
      ? 0
      : 100;

  const extraCoberturasConfirmadas = coberturas.filter(
    (c) =>
      c.tipo === 'extra' &&
      (c.status === 'aprovada' || c.status === 'em_andamento' || c.status === 'concluida')
  ).length;

  const plantoesFT = Math.max(colaborador.plantoesFT ?? 0, extraCoberturasConfirmadas);

  return {
    presencaPercent,
    presencaLabel: totalBasePresenca > 0 ? `${presencaPercent}%` : 'Sem faltas',
    faltasCount,
    atrasosCount,
    regularesOuCobertura,
    totalRegistrosEspelho: pontos.length,
    daysWithPunch,
    monthEventsCount: monthEvents.length,
    horasTrabalhadasLabel,
    workedHours,
    plantoesFT,
    hasLiveData: totalBasePresenca > 0 || monthEvents.length > 0,
  };
}

export const IndicadorDetalheModal: React.FC<IndicadorDetalheModalProps> = ({
  isOpen,
  tipo,
  colaborador,
  pontos,
  eventos,
  coberturas = [],
  onClose,
  onNavigateTab,
}) => {
  const metrics = useMemo(
    () => computeColaboradorMetrics(colaborador, pontos, eventos, coberturas),
    [colaborador, pontos, eventos, coberturas]
  );

  if (!isOpen) return null;

  const currentMonthName = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const expectedMonthlyHours = colaborador.tipoEscala === '12x36' ? 180 : 220;
  const valorDiariaFt = Number(colaborador.valorExtraFT || 0);

  const getDetails = () => {
    switch (tipo) {
      case 'presenca':
        return {
          title: 'Índice de Presença e Assiduidade',
          icon: CheckCircle2,
          color: 'text-emerald-400',
          bgColor: 'bg-emerald-500/15',
          borderColor: 'border-emerald-500/30',
          value: metrics.hasLiveData ? `${metrics.presencaPercent}%` : '0%',
          subtitle: `Competência atual · ${currentMonthName}`,
          description:
            'Calculado diretamente a partir dos espelhos consolidados e batidas confirmadas no servidor, sem valores fixos.',
          items: [
            { label: 'Jornadas registradas no espelho', val: `${metrics.totalRegistrosEspelho} dia(s)` },
            { label: 'Dias com batida confirmada no mês', val: `${metrics.daysWithPunch} dia(s)` },
            { label: 'Registros regulares / cobertura', val: `${metrics.regularesOuCobertura}` },
            {
              label: 'Status operacional atual',
              val: colaborador.status === 'no_posto' ? 'Ativo no posto' : colaborador.status,
            },
          ],
        };
      case 'faltas':
        return {
          title: 'Controle de Ausências e Faltas',
          icon: AlertCircle,
          color: metrics.faltasCount > 0 ? 'text-red-400' : 'text-emerald-400',
          bgColor: metrics.faltasCount > 0 ? 'bg-red-500/15' : 'bg-emerald-500/15',
          borderColor: metrics.faltasCount > 0 ? 'border-red-500/30' : 'border-emerald-500/30',
          value: String(metrics.faltasCount),
          subtitle:
            metrics.faltasCount === 0
              ? `Nenhuma falta registrada em ${currentMonthName}`
              : `${metrics.faltasCount} falta(s) apurada(s) no período`,
          description:
            'Apuração real de faltas e atrasos lançados no espelho de ponto. Ausências cobertas por atestado aprovado não contam como falta.',
          items: [
            { label: 'Faltas registradas no espelho', val: `${metrics.faltasCount}` },
            { label: 'Ocorrências de atraso', val: `${metrics.atrasosCount}` },
            { label: 'Batidas confirmadas no mês', val: `${metrics.monthEventsCount}` },
            {
              label: 'Bônus assiduidade cadastrado',
              val: colaborador.valorBonus ? `R$ ${colaborador.valorBonus.toFixed(2)}` : 'Não aplicável',
            },
          ],
        };
      case 'horas':
        return {
          title: 'Saldo de Horas Trabalhadas',
          icon: Clock,
          color: 'text-blue-400',
          bgColor: 'bg-blue-500/15',
          borderColor: 'border-blue-500/30',
          value: metrics.horasTrabalhadasLabel,
          subtitle: 'Total apurado no espelho e batidas do mês',
          description:
            'Soma real das horas efetivamente apuradas nos registros de ponto e batidas de entrada/saída confirmadas no servidor.',
          items: [
            { label: 'Referência da escala', val: `${expectedMonthlyHours}h / mês (${colaborador.tipoEscala})` },
            { label: 'Horas apuradas até o momento', val: metrics.horasTrabalhadasLabel },
            {
              label: 'Saldo de Banco de Horas',
              val: `${(colaborador.bancoHoras || 0) > 0 ? '+' : ''}${colaborador.bancoHoras || 0}h`,
            },
            { label: 'Batidas registradas no mês', val: `${metrics.monthEventsCount} evento(s)` },
          ],
        };
      case 'plantoes_ft':
        return {
          title: 'Plantões FT (Folga Trabalhada)',
          icon: Star,
          color: 'text-amber-400',
          bgColor: 'bg-amber-500/15',
          borderColor: 'border-amber-500/30',
          value: `${metrics.plantoesFT} FT`,
          subtitle: 'Folgas Trabalhadas e Extras Programadas',
          description:
            'Contabiliza os plantões extras (FT) confirmados em sua ficha ou programados pela supervisão na gestão de coberturas.',
          items: [
            { label: 'Plantões FT confirmados', val: `${metrics.plantoesFT} FT(s)` },
            {
              label: 'Valor unitário cadastrado',
              val: valorDiariaFt > 0 ? `R$ ${valorDiariaFt.toFixed(2)} / plantão` : 'Definido pela folha RH',
            },
            {
              label: 'Estimativa bruta em folha',
              val: valorDiariaFt > 0 ? `R$ ${(metrics.plantoesFT * valorDiariaFt).toFixed(2)}` : 'Conforme RH',
            },
            { label: 'Vínculo habitual', val: colaborador.postoNome || 'Sem posto fixo' },
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
            <div
              className={`w-8 h-8 rounded-xl ${details.bgColor} border ${details.borderColor} flex items-center justify-center ${details.color}`}
            >
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Detalhamento do Indicador
              </h3>
              <span className="text-[10px] text-slate-400 capitalize">{details.subtitle}</span>
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
          <p className="text-[11px] text-slate-300 leading-snug">{details.description}</p>
        </div>

        {/* Breakdown Items */}
        <div className="space-y-1.5 bg-slate-900/60 p-3 rounded-2xl border border-slate-800/80 text-xs">
          {details.items.map((it, idx) => (
            <div
              key={idx}
              className="flex justify-between items-center py-1 border-b border-slate-800/60 last:border-b-0"
            >
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
