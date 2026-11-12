import React, { useState, useMemo } from 'react';
import {
  MapPin,
  Clock,
  ChevronRight,
  Calendar,
  ClipboardList,
  FileText,
  FolderLock,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Star,
  Receipt,
  Camera,
  ArrowUpRight,
  ShieldCheck,
  CalendarClock,
} from 'lucide-react';
import {
  Colaborador,
  CondominioPosto,
  PontoEvento,
  CollaboratorTabType,
  PontoRegistro,
  TipoBatidaPonto,
  CoberturaProgramada,
} from '../../../types';
import { determineNextPunch } from '../../../services/pontoService';
import { CondominioBadge } from '../../common/CondominioBadge';
import {
  IndicadorDetalheModal,
  TipoIndicador,
  computeColaboradorMetrics,
} from './IndicadorDetalheModal';

interface MeuTurnoScreenProps {
  colaborador: Colaborador;
  posto: CondominioPosto;
  hojePunches: PontoEvento[];
  ultimoEvento?: PontoEvento;
  pontosHistoricos?: PontoRegistro[];
  allPunchEvents?: PontoEvento[];
  coberturas?: CoberturaProgramada[];
  onBaterPonto: (tipo?: TipoBatidaPonto) => void;
  onNavigateTab: (tab: CollaboratorTabType) => void;
  onOpenOcorrencia: () => void;
  onVerComprovante: (evento: PontoEvento) => void;
}

function getSaoPauloHourMinute(date: Date): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return { hour: h % 24, minute: m };
}

function getInitials(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');
}

export const MeuTurnoScreen: React.FC<MeuTurnoScreenProps> = ({
  colaborador,
  posto,
  hojePunches,
  ultimoEvento,
  pontosHistoricos = [],
  allPunchEvents,
  coberturas = [],
  onBaterPonto,
  onNavigateTab,
  onOpenOcorrencia,
  onVerComprovante,
}) => {
  const [indicadorModal, setIndicadorModal] = useState<TipoIndicador | null>(null);

  const eventsPool = allPunchEvents && allPunchEvents.length > 0 ? allPunchEvents : hojePunches;
  const nextPunch = determineNextPunch(eventsPool, colaborador);

  const metrics = useMemo(
    () => computeColaboradorMetrics(colaborador, pontosHistoricos, eventsPool, coberturas),
    [colaborador, pontosHistoricos, eventsPool, coberturas]
  );

  // Cobertura/extra vigente hoje no fuso de Brasília
  const hojeIso = new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const coberturaHoje = useMemo(
    () =>
      coberturas.find(
        (c) =>
          (c.status === 'aprovada' || c.status === 'em_andamento') &&
          c.dataInicio <= hojeIso &&
          c.dataFim >= hojeIso
      ),
    [coberturas, hojeIso]
  );

  const convitesPendentes = useMemo(
    () => coberturas.filter((c) => c.status === 'aguardando_aceite').length,
    [coberturas]
  );

  // =========================================================================
  // 1. CÁLCULO DA SITUAÇÃO PROFISSIONAL REAL DO COLABORADOR
  // =========================================================================
  const situacaoProfissional = useMemo(() => {
    if (!colaborador.condominioId && !coberturaHoje) {
      return {
        label: 'Sem posto atribuído',
        badgeClass: 'bg-slate-700/30 text-slate-300 border-slate-600/40',
        dotClass: 'bg-slate-400',
        statusKey: 'sem_posto',
      };
    }

    if (colaborador.status === 'afastado') {
      return {
        label: 'Afastado',
        badgeClass: 'bg-red-500/15 text-red-400 border-red-500/30',
        dotClass: 'bg-red-400',
        statusKey: 'afastado',
      };
    }

    if (colaborador.status === 'folga' && !coberturaHoje) {
      return {
        label: 'De folga',
        badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
        dotClass: 'bg-blue-400',
        statusKey: 'folga',
      };
    }

    const hasSaidaFinal = hojePunches.some((p) => p.tipoEvento === 'saida');
    if (hasSaidaFinal && nextPunch.tipo === 'entrada') {
      return {
        label: 'Jornada encerrada',
        badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
        dotClass: 'bg-purple-400',
        statusKey: 'encerrada',
      };
    }

    const hasSaidaIntervalo = hojePunches.some((p) => p.tipoEvento === 'saida_intervalo');
    const hasRetornoIntervalo = hojePunches.some((p) => p.tipoEvento === 'retorno_intervalo');
    if (hasSaidaIntervalo && !hasRetornoIntervalo) {
      return {
        label: 'Em intervalo',
        badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        dotClass: 'bg-amber-400',
        statusKey: 'intervalo',
      };
    }

    const hasEntrada = hojePunches.some((p) => p.tipoEvento === 'entrada') || nextPunch.isOvernightOpen;
    if (hasEntrada) {
      return {
        label: 'Em serviço',
        badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        dotClass: 'bg-emerald-400 animate-pulse',
        statusKey: 'em_servico',
      };
    }

    return {
      label: 'Aguardando início',
      badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
      dotClass: 'bg-cyan-400',
      statusKey: 'aguardando',
    };
  }, [colaborador, hojePunches, coberturaHoje, nextPunch]);

  // =========================================================================
  // 2. CÁLCULO DO PROGRESSO DA JORNADA (SUPORTE A MEIA-NOITE EM SP)
  // =========================================================================
  const { progress, shiftStatus } = useMemo(() => {
    if (!colaborador.condominioId && !coberturaHoje) {
      return { progress: 0, shiftStatus: 'Sem jornada programada' };
    }

    const hasSaidaFinal = hojePunches.some((p) => p.tipoEvento === 'saida');
    if (hasSaidaFinal && nextPunch.tipo === 'entrada') {
      return { progress: 100, shiftStatus: 'Jornada concluída' };
    }

    const isEmIntervalo = nextPunch.tipo === 'retorno_intervalo';
    const horaIni = coberturaHoje?.horaInicio || colaborador.turnoInicio || '07:00';
    const horaFim = coberturaHoje?.horaFim || colaborador.turnoFim || '19:00';
    const [startH, startM] = horaIni.split(':').map(Number);
    const [endH, endM] = horaFim.split(':').map(Number);

    const { hour: currentHour, minute: currentMin } = getSaoPauloHourMinute(new Date());
    const nowMinutes = currentHour * 60 + currentMin;

    const startMinutes = (startH || 0) * 60 + (startM || 0);
    let endMinutes = (endH || 0) * 60 + (endM || 0);

    const crossesMidnight = endMinutes <= startMinutes;
    if (crossesMidnight) {
      endMinutes += 24 * 60;
    }

    const totalDuration = Math.max(1, endMinutes - startMinutes);

    let adjustedNow = nowMinutes;
    if (crossesMidnight && nowMinutes < startMinutes) {
      adjustedNow += 24 * 60;
    }

    if (adjustedNow < startMinutes) {
      return { progress: 0, shiftStatus: 'Aguardando início' };
    }

    if (adjustedNow >= endMinutes) {
      return { progress: 100, shiftStatus: 'Horário limite atingido' };
    }

    const elapsed = adjustedNow - startMinutes;
    const calc = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));

    return {
      progress: calc,
      shiftStatus: isEmIntervalo ? 'Em intervalo de refeição' : 'Em andamento',
    };
  }, [colaborador, coberturaHoje, hojePunches, nextPunch.tipo]);

  // =========================================================================
  // 3. APURAÇÃO DE DIVERGÊNCIA DE HORÁRIO (ENTRADA PREVISTA X EFETIVA)
  // =========================================================================
  const divergenciaHorario = useMemo(() => {
    const entradaPunch = hojePunches.find((p) => p.tipoEvento === 'entrada');
    if (!entradaPunch) return null;

    const { hour: punchHour, minute: punchMin } = getSaoPauloHourMinute(
      new Date(entradaPunch.serverTimestamp)
    );
    const actualMinutes = punchHour * 60 + punchMin;

    const prevista = coberturaHoje?.horaInicio || colaborador.turnoInicio || '07:00';
    const [startH, startM] = prevista.split(':').map(Number);
    const scheduledMinutes = (startH || 0) * 60 + (startM || 0);

    const diffMinutes = actualMinutes - scheduledMinutes;

    if (Math.abs(diffMinutes) > 10) {
      const isLate = diffMinutes > 0;
      const absDiff = Math.abs(diffMinutes);
      const hours = Math.floor(absDiff / 60);
      const mins = absDiff % 60;
      const formattedDiff = hours > 0 ? `${hours}h ${mins}m` : `${mins}min`;

      return {
        isLate,
        diffText: isLate ? `Entrada com atraso de ${formattedDiff}` : `Entrada adiantada em ${formattedDiff}`,
        previsto: prevista,
        efetivo: `${String(punchHour).padStart(2, '0')}:${String(punchMin).padStart(2, '0')}`,
        evento: entradaPunch,
      };
    }

    return null;
  }, [hojePunches, colaborador.turnoInicio, coberturaHoje]);

  const dataOficialTurno = useMemo(() => {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date());
  }, []);

  const turnoTipoLabel = useMemo(() => {
    const isNoturno =
      colaborador.turno === 'noturno' ||
      (colaborador.turnoInicio && parseInt(colaborador.turnoInicio, 10) >= 18);
    const escala = colaborador.tipoEscala || '12x36';
    return `${escala} · ${isNoturno ? 'Noturno' : 'Diurno'}`;
  }, [colaborador.tipoEscala, colaborador.turno, colaborador.turnoInicio]);

  const punchEntrada = hojePunches.find((p) => p.tipoEvento === 'entrada');
  const punchSaidaIntervalo = hojePunches.find((p) => p.tipoEvento === 'saida_intervalo');
  const punchRetornoIntervalo = hojePunches.find((p) => p.tipoEvento === 'retorno_intervalo');
  const punchSaida = hojePunches.find((p) => p.tipoEvento === 'saida');

  const formatPunchTime = (p?: PontoEvento) => {
    if (!p) return null;
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(p.serverTimestamp));
  };

  const punchCards = useMemo(
    () => [
      {
        type: 'entrada' as TipoBatidaPonto,
        stepNum: 1,
        shortLabel: 'Entrada',
        horarioPrevisto: coberturaHoje?.horaInicio || colaborador.turnoInicio || '07:00',
        punch: punchEntrada,
        horaRegistrada: formatPunchTime(punchEntrada),
        isDone: Boolean(punchEntrada),
        isNext: nextPunch.tipo === 'entrada' && !punchEntrada,
      },
      {
        type: 'saida_intervalo' as TipoBatidaPonto,
        stepNum: 2,
        shortLabel: 'Pausa Almoço/Janta',
        horarioPrevisto: 'Saída Refeição',
        punch: punchSaidaIntervalo,
        horaRegistrada: formatPunchTime(punchSaidaIntervalo),
        isDone: Boolean(punchSaidaIntervalo),
        isNext: nextPunch.tipo === 'saida_intervalo' && !punchSaidaIntervalo,
      },
      {
        type: 'retorno_intervalo' as TipoBatidaPonto,
        stepNum: 3,
        shortLabel: 'Retorno Almoço/Janta',
        horarioPrevisto: 'Retorno Refeição',
        punch: punchRetornoIntervalo,
        horaRegistrada: formatPunchTime(punchRetornoIntervalo),
        isDone: Boolean(punchRetornoIntervalo),
        isNext: nextPunch.tipo === 'retorno_intervalo' && !punchRetornoIntervalo,
      },
      {
        type: 'saida' as TipoBatidaPonto,
        stepNum: 4,
        shortLabel: 'Saída',
        horarioPrevisto: coberturaHoje?.horaFim || colaborador.turnoFim || '19:00',
        punch: punchSaida,
        horaRegistrada: formatPunchTime(punchSaida),
        isDone: Boolean(punchSaida),
        isNext: nextPunch.tipo === 'saida' && !punchSaida,
      },
    ],
    [
      colaborador.turnoInicio,
      colaborador.turnoFim,
      coberturaHoje,
      punchEntrada,
      punchSaidaIntervalo,
      punchRetornoIntervalo,
      punchSaida,
      nextPunch.tipo,
    ]
  );

  const mainButtonText = useMemo(() => {
    if (nextPunch.isComplete) {
      return 'Jornada Concluída (4/4)';
    }
    switch (nextPunch.tipo) {
      case 'entrada':
        return nextPunch.label.includes('Novo Turno') ? 'Registrar Entrada (Novo Turno)' : 'Registrar Entrada';
      case 'saida_intervalo':
        return 'Registrar Pausa';
      case 'retorno_intervalo':
        return 'Registrar Retorno';
      case 'saida':
        return nextPunch.isOvernightOpen ? 'Registrar Saída (Turno Noturno)' : 'Registrar Saída';
      default:
        return 'Registrar Ponto';
    }
  }, [nextPunch.isComplete, nextPunch.tipo, nextPunch.label, nextPunch.isOvernightOpen]);

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* 1. CARTÃO DE IDENTIFICAÇÃO DO COLABORADOR */}
      <div
        onClick={() => onNavigateTab('meu_perfil')}
        className="rounded-3xl bg-gradient-to-b from-[#0A1333] via-[#09102A] to-[#070B1F] border border-blue-500/30 p-4 sm:p-5 shadow-2xl relative overflow-hidden cursor-pointer group hover:border-blue-400/50 transition-all"
        title="Toque para visualizar seu perfil completo"
      >
        <div className="absolute top-0 right-0 w-44 h-44 bg-blue-500/10 rounded-full blur-3xl -z-10" />

        <div className="flex items-start gap-3.5">
          <div className="relative shrink-0">
            {colaborador.foto ? (
              <img
                src={colaborador.foto}
                alt={colaborador.nome}
                className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl object-cover border-2 border-blue-500/40 shadow-lg group-hover:scale-105 transition-transform"
              />
            ) : (
              <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-gradient-to-br from-blue-600/30 to-indigo-700/40 border-2 border-blue-500/40 shadow-lg flex items-center justify-center font-black text-lg text-blue-200">
                {getInitials(colaborador.nome)}
              </div>
            )}
            <span
              className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-[#09102A] flex items-center justify-center text-white ${
                situacaoProfissional.statusKey === 'em_servico'
                  ? 'bg-emerald-500'
                  : situacaoProfissional.statusKey === 'intervalo'
                  ? 'bg-amber-500'
                  : situacaoProfissional.statusKey === 'encerrada'
                  ? 'bg-purple-500'
                  : 'bg-slate-600'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <h2 className="text-base font-extrabold text-white truncate group-hover:text-blue-300 transition-colors">
                {colaborador.nome}
              </h2>
              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 shrink-0 transition-colors" />
            </div>

            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-[11px] text-blue-300 font-mono font-medium">
                Matrícula: {colaborador.matricula}
              </span>
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${situacaoProfissional.badgeClass}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${situacaoProfissional.dotClass}`} />
                <span>{situacaoProfissional.label}</span>
              </span>
            </div>

            <div className="mt-2.5 space-y-1 text-xs text-slate-300">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-200">
                <CondominioBadge icone={posto.icone} cor={posto.cor} size="xs" showLabel={false} />
                <span className="truncate">
                  Lotação fixa: <strong>{posto.nome}</strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
                <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="truncate">
                  Função: <strong>{colaborador.funcao}</strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="truncate">
                  Jornada habitual: <strong>{colaborador.jornada || '12x36 · 07:00 às 19:00'}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Aviso de Cobertura / Extra Programada ou Convite Pendente */}
      {(coberturaHoje || convitesPendentes > 0) && (
        <button
          type="button"
          onClick={() => onNavigateTab('minha_escala')}
          className="w-full text-left p-3 rounded-2xl bg-amber-950/35 border border-amber-500/40 hover:border-amber-400/60 transition-all flex items-center justify-between gap-2.5 cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <CalendarClock className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="min-w-0 text-xs">
              {coberturaHoje ? (
                <>
                  <strong className="text-amber-200 block truncate">
                    Hoje: {coberturaHoje.tipo === 'extra' ? 'Extra/FT Programada' : 'Cobertura Programada'} em{' '}
                    {coberturaHoje.postoCoberturaNome || coberturaHoje.postoCoberturaId}
                  </strong>
                  <span className="text-[11px] text-slate-300 block">
                    {coberturaHoje.horaInicio} às {coberturaHoje.horaFim} · Sua lotação fixa permanece inalterada.
                  </span>
                </>
              ) : (
                <>
                  <strong className="text-amber-200 block">
                    Você possui {convitesPendentes} convite(s) de cobertura/extra pendente(s)
                  </strong>
                  <span className="text-[11px] text-slate-300 block">
                    Toque para aceitar ou recusar em Minha Escala.
                  </span>
                </>
              )}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-amber-300 shrink-0" />
        </button>
      )}

      {/* 2. REGISTRO DE PONTO DIGITAL */}
      <div className="rounded-2xl bg-gradient-to-b from-[#0A1332] via-[#080E24] to-[#060A1A] border border-blue-500/30 p-3.5 sm:p-4 shadow-xl space-y-3 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-blue-600/10 rounded-full blur-2xl -z-10" />

        <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
              <Camera className="w-3.5 h-3.5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs font-black text-white tracking-wide uppercase truncate">
                  Registro de Ponto Digital
                </h3>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
              </div>
              <span className="text-[10px] text-blue-300/80 truncate block">
                Base:{' '}
                <strong className="text-white font-medium">
                  {coberturaHoje?.postoCoberturaNome || posto.nome}
                </strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              <MapPin className="w-2.5 h-2.5" />
              <span>Multi-Posto GPS</span>
            </span>
          </div>
        </div>

        {/* Linha do Tempo Compacta */}
        <div className="relative pt-1 pb-1">
          <div className="absolute top-4 left-6 right-6 h-0.5 bg-slate-800 -z-0" />
          <div
            className="absolute top-4 left-6 h-0.5 bg-gradient-to-r from-emerald-500 to-blue-500 transition-all duration-500 -z-0"
            style={{
              width:
                hojePunches.length >= 4
                  ? 'calc(100% - 3rem)'
                  : hojePunches.length === 3
                  ? 'calc(75% - 2.25rem)'
                  : hojePunches.length === 2
                  ? 'calc(50% - 1.5rem)'
                  : hojePunches.length === 1
                  ? 'calc(25% - 0.75rem)'
                  : '0%',
            }}
          />

          <div className="grid grid-cols-4 gap-1.5 sm:gap-2 relative z-10">
            {punchCards.map((card) => {
              if (card.isDone) {
                return (
                  <button
                    key={card.type}
                    type="button"
                    onClick={() => card.punch && onVerComprovante(card.punch)}
                    title={`Batida registrada às ${card.horaRegistrada}. Toque para ver comprovante.`}
                    className="flex flex-col items-center text-center group cursor-pointer"
                  >
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 flex items-center justify-center shadow-md shadow-emerald-950/40 group-hover:scale-105 transition-transform">
                      <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                    <span className="text-[10px] font-bold text-emerald-300 mt-1 truncate max-w-full">
                      {card.shortLabel}
                    </span>
                    <span className="text-[9px] font-mono font-bold text-emerald-400 flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {card.horaRegistrada}
                    </span>
                  </button>
                );
              }

              if (card.isNext) {
                return (
                  <div key={card.type} className="flex flex-col items-center text-center animate-pulse">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-600 border-2 border-blue-400 text-white flex items-center justify-center font-black text-xs shadow-lg shadow-blue-500/40 ring-4 ring-blue-500/20">
                      {card.stepNum}
                    </div>
                    <span className="text-[10px] font-black text-white mt-1 truncate max-w-full">
                      {card.shortLabel}
                    </span>
                    <span className="text-[8px] font-extrabold uppercase tracking-tight text-blue-300 bg-blue-950/80 px-1 py-0.2 rounded border border-blue-400/40 mt-0.5 whitespace-nowrap">
                      PRÓXIMA AÇÃO
                    </span>
                  </div>
                );
              }

              return (
                <div key={card.type} className="flex flex-col items-center text-center opacity-60">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-900 border border-slate-700/80 text-slate-400 flex items-center justify-center font-bold text-xs">
                    {card.stepNum}
                  </div>
                  <span className="text-[10px] font-medium text-slate-400 mt-1 truncate max-w-full">
                    {card.shortLabel}
                  </span>
                  <span className="text-[9px] font-mono text-slate-500 mt-0.5">{card.horarioPrevisto}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Único Botão Principal */}
        <button
          type="button"
          onClick={() => {
            if (nextPunch.isComplete) {
              if (ultimoEvento) onVerComprovante(ultimoEvento);
            } else {
              onBaterPonto(nextPunch.tipo);
            }
          }}
          disabled={nextPunch.isComplete && !ultimoEvento}
          className={`w-full py-3 px-4 rounded-xl font-black text-xs sm:text-sm tracking-wide uppercase flex items-center justify-center gap-2 shadow-xl transition-all cursor-pointer active:scale-[0.98] ${
            nextPunch.isComplete
              ? 'bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700'
              : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-600/35 border border-blue-400/40'
          }`}
        >
          {nextPunch.isComplete ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Jornada Completa · Ver Comprovante</span>
            </>
          ) : (
            <>
              <Camera className="w-4 h-4 shrink-0 animate-pulse text-blue-200" />
              <span>{mainButtonText}</span>
              <ChevronRight className="w-4 h-4 shrink-0 text-blue-200" />
            </>
          )}
        </button>

        {/* Rodapé Informativo */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5 px-0.5 border-t border-slate-800/60">
          <span className="flex items-center gap-1 truncate text-slate-300">
            <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>Portaria MTE 671 · REP-P</span>
          </span>
          <span className="text-blue-300/90 font-medium shrink-0">
            {posto.nome.length > 22 ? `${posto.nome.slice(0, 20)}...` : posto.nome}
          </span>
        </div>
      </div>

      {/* 3. CARTÃO "MEU TURNO DE HOJE" */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Meu Turno de Hoje</h3>
          </div>
          <span className="text-[11px] text-slate-300 font-mono font-medium capitalize">{turnoTipoLabel}</span>
        </div>

        <div className="text-[11px] text-slate-400 capitalize pb-1 border-b border-slate-800/80">
          {dataOficialTurno}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center pt-1">
          <div className="bg-slate-950/60 rounded-xl p-2.5 border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block font-medium">Entrada prevista</span>
            <span className="text-sm font-bold text-white font-mono mt-0.5 block">
              {coberturaHoje?.horaInicio || colaborador.turnoInicio || '07:00'}
            </span>
          </div>
          <div className="bg-slate-950/60 rounded-xl p-2.5 border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block font-medium">Saída prevista</span>
            <span className="text-sm font-bold text-white font-mono mt-0.5 block">
              {coberturaHoje?.horaFim || colaborador.turnoFim || '19:00'}
            </span>
          </div>
          <div className="bg-slate-950/60 rounded-xl p-2.5 border border-slate-800/80 flex flex-col justify-center">
            <span className="text-[10px] text-slate-400 block font-medium">Status</span>
            <span
              className={`text-xs font-bold mt-0.5 block ${
                shiftStatus === 'Em andamento'
                  ? 'text-emerald-400'
                  : shiftStatus === 'Em intervalo de refeição'
                  ? 'text-amber-400'
                  : shiftStatus === 'Jornada concluída'
                  ? 'text-purple-300'
                  : 'text-slate-300'
              }`}
            >
              {shiftStatus}
            </span>
          </div>
        </div>

        {divergenciaHorario && (
          <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 text-xs text-amber-200 flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-[11px] font-bold text-amber-300">
                  Divergência de Horário Identificada
                </strong>
                <p className="text-[10px] text-slate-300 mt-0.5">
                  Entrada prevista: <strong>{divergenciaHorario.previsto}</strong> · Entrada efetiva:{' '}
                  <strong>{divergenciaHorario.efetivo}</strong> ({divergenciaHorario.diffText})
                </p>
              </div>
            </div>
            <button
              onClick={() => onVerComprovante(divergenciaHorario.evento)}
              className="text-[10px] text-amber-300 font-bold underline shrink-0 hover:text-white"
            >
              Ver registro
            </button>
          </div>
        )}

        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>Progresso da jornada</span>
            <span className="font-mono font-bold text-slate-200">{progress}% concluído</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-teal-400 to-emerald-400 rounded-full transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* 4. CARTÃO "ÚLTIMO REGISTRO" */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
              Último Registro
            </span>
            <span className="text-xs font-bold text-white truncate block">
              {ultimoEvento
                ? `${ultimoEvento.labelEvento} às ${new Intl.DateTimeFormat('pt-BR', {
                    timeZone: 'America/Sao_Paulo',
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(new Date(ultimoEvento.serverTimestamp))}`
                : 'Nenhum ponto registrado hoje'}
            </span>
            <span className="text-[10px] text-slate-400 block truncate">
              {ultimoEvento
                ? `${ultimoEvento.condominioNome} · ${
                    ultimoEvento.verificationStatus === 'confirmado'
                      ? 'Confirmado no Servidor'
                      : 'Pendente de Sincronização'
                  }`
                : 'Aguardando primeira batida'}
            </span>
          </div>
        </div>

        {ultimoEvento && (
          <button
            onClick={() => onVerComprovante(ultimoEvento)}
            className="px-3 py-2 rounded-xl bg-blue-600/15 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
            title="Visualizar e emitir comprovante em PDF"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Comprovante</span>
          </button>
        )}
      </div>

      {/* 5. INDICADORES DE DESEMPENHO REAIS (SEM HARDCODES) */}
      <div className="grid grid-cols-4 gap-2">
        <button
          onClick={() => setIndicadorModal('presenca')}
          className="rounded-2xl bg-slate-900/60 hover:bg-slate-850 border border-slate-800 p-2.5 text-center space-y-1 transition-all cursor-pointer active:scale-95 group"
          title="Ver cálculo real de assiduidade e presença"
        >
          <div className="w-6 h-6 rounded-lg bg-emerald-500/15 text-emerald-400 mx-auto flex items-center justify-center group-hover:scale-110 transition-transform">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <span className="text-sm font-extrabold text-white block font-mono">
            {metrics.hasLiveData ? `${metrics.presencaPercent}%` : '—'}
          </span>
          <span className="text-[10px] text-slate-400 block truncate">Presença</span>
        </button>

        <button
          onClick={() => setIndicadorModal('faltas')}
          className="rounded-2xl bg-slate-900/60 hover:bg-slate-850 border border-slate-800 p-2.5 text-center space-y-1 transition-all cursor-pointer active:scale-95 group"
          title="Ver registro de faltas e justificativas"
        >
          <div className="w-6 h-6 rounded-lg bg-red-500/15 text-red-400 mx-auto flex items-center justify-center group-hover:scale-110 transition-transform">
            <AlertCircle className="w-3.5 h-3.5" />
          </div>
          <span className="text-sm font-extrabold text-white block font-mono">{metrics.faltasCount}</span>
          <span className="text-[10px] text-slate-400 block truncate">Faltas</span>
        </button>

        <button
          onClick={() => setIndicadorModal('horas')}
          className="rounded-2xl bg-slate-900/60 hover:bg-slate-850 border border-slate-800 p-2.5 text-center space-y-1 transition-all cursor-pointer active:scale-95 group"
          title="Ver horas trabalhadas e banco de horas"
        >
          <div className="w-6 h-6 rounded-lg bg-blue-500/15 text-blue-400 mx-auto flex items-center justify-center group-hover:scale-110 transition-transform">
            <Clock className="w-3.5 h-3.5" />
          </div>
          <span className="text-sm font-extrabold text-white block font-mono">
            {metrics.horasTrabalhadasLabel}
          </span>
          <span className="text-[10px] text-slate-400 block truncate">Trabalhadas</span>
        </button>

        <button
          onClick={() => setIndicadorModal('plantoes_ft')}
          className="rounded-2xl bg-slate-900/60 hover:bg-slate-850 border border-slate-800 p-2.5 text-center space-y-1 transition-all cursor-pointer active:scale-95 group"
          title="Folga Trabalhada (Plantões de Cobertura FT)"
        >
          <div className="w-6 h-6 rounded-lg bg-amber-500/15 text-amber-400 mx-auto flex items-center justify-center group-hover:scale-110 transition-transform">
            <Star className="w-3.5 h-3.5" />
          </div>
          <span className="text-sm font-extrabold text-white block font-mono">{metrics.plantoesFT} FT</span>
          <span className="text-[10px] text-slate-400 block truncate">Plantões FT</span>
        </button>
      </div>

      {/* 6. ATALHOS RÁPIDOS */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Acesso Rápido</h4>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onNavigateTab('minha_escala')}
            className="p-3 rounded-2xl bg-gradient-to-b from-blue-900/20 to-blue-950/40 hover:from-blue-900/30 hover:to-blue-950/60 border border-blue-500/25 text-left transition-all group cursor-pointer"
          >
            <Calendar className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform mb-2" />
            <span className="text-xs font-bold text-white block leading-tight">Minha Escala</span>
            <span className="text-[10px] text-slate-400 block mt-0.5 truncate">Escala e extras</span>
          </button>

          <button
            onClick={() => onNavigateTab('meus_registros')}
            className="p-3 rounded-2xl bg-gradient-to-b from-emerald-900/20 to-emerald-950/40 hover:from-emerald-900/30 hover:to-emerald-950/60 border border-emerald-500/25 text-left transition-all group cursor-pointer"
          >
            <ClipboardList className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform mb-2" />
            <span className="text-xs font-bold text-white block leading-tight">Meus Registros</span>
            <span className="text-[10px] text-slate-400 block mt-0.5 truncate">Espelho de ponto</span>
          </button>

          <button
            onClick={() => onNavigateTab('documentos')}
            className="p-3 rounded-2xl bg-gradient-to-b from-amber-900/20 to-amber-950/40 hover:from-amber-900/30 hover:to-amber-950/60 border border-amber-500/25 text-left transition-all group cursor-pointer"
          >
            <FileText className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform mb-2" />
            <span className="text-xs font-bold text-white block leading-tight">Meus Holerites</span>
            <span className="text-[10px] text-slate-400 block mt-0.5 truncate">Recibos digitais</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onNavigateTab('documentos')}
            className="p-3 rounded-2xl bg-slate-900/60 hover:bg-slate-850 border border-slate-800 text-left transition-all group cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <FolderLock className="w-4 h-4 text-purple-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-200 block truncate">Meus Documentos</span>
                <span className="text-[10px] text-slate-400 block truncate">Envios e solicitações</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white shrink-0" />
          </button>

          <button
            onClick={onOpenOcorrencia}
            className="p-3 rounded-2xl bg-slate-900/60 hover:bg-slate-850 border border-slate-800 text-left transition-all group cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-200 block truncate">Comunicar Ocorrência</span>
                <span className="text-[10px] text-slate-400 block truncate">Aviso imediato ao posto</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white shrink-0" />
          </button>
        </div>
      </div>

      {indicadorModal && (
        <IndicadorDetalheModal
          isOpen={Boolean(indicadorModal)}
          tipo={indicadorModal}
          colaborador={colaborador}
          pontos={pontosHistoricos}
          eventos={eventsPool}
          coberturas={coberturas}
          onClose={() => setIndicadorModal(null)}
          onNavigateTab={onNavigateTab}
        />
      )}
    </div>
  );
};
