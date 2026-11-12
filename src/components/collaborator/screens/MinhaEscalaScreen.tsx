import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  CheckCircle2,
  CalendarDays,
  Send,
  X,
  FileQuestion,
  CalendarClock,
  Check,
  XCircle,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { Colaborador, CondominioPosto, CoberturaProgramada } from '../../../types';
import {
  CondominioBadge,
  getCondoIconComponent,
  getCondoColorDef,
} from '../../common/CondominioBadge';

interface MinhaEscalaScreenProps {
  colaborador: Colaborador;
  posto: CondominioPosto;
  condominios: CondominioPosto[];
  coberturas: CoberturaProgramada[];
  onResponderCobertura: (
    cobertura: CoberturaProgramada,
    aceitar: boolean,
    motivoRecusa?: string
  ) => Promise<{ success: boolean; message: string }>;
  onSolicitarAjuste: (
    dataPonto: string,
    motivo: string
  ) => Promise<{ success: boolean; message: string }>;
  onOpenSupport: () => void;
}

function getTodayPartsSP(): { year: number; month: number; day: number; iso: string } {
  const iso = new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const [y, m, d] = iso.split('-').map(Number);
  return { year: y, month: m - 1, day: d, iso };
}

function formatDateIso(year: number, monthZeroIdx: number, day: number): string {
  return `${year}-${String(monthZeroIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isHabitualWorkDay(
  colaborador: Colaborador,
  year: number,
  monthZeroIdx: number,
  day: number
): boolean {
  if (!colaborador.condominioId) return false;
  const dateObj = new Date(Date.UTC(year, monthZeroIdx, day));
  const weekday = dateObj.getUTCDay(); // 0=Dom..6=Sab

  if (colaborador.tipoEscala === '5x2') {
    return weekday >= 1 && weekday <= 5;
  }
  if (colaborador.tipoEscala === '6x1') {
    return weekday !== 0;
  }

  // Escala 12x36: alternância determinística por diferença de dias desde admissão ou época fixa
  let anchorMs = Date.UTC(2026, 0, 1);
  if (colaborador.dataAdmissao && /^\d{4}-\d{2}-\d{2}/.test(colaborador.dataAdmissao)) {
    const [ay, am, ad] = colaborador.dataAdmissao.slice(0, 10).split('-').map(Number);
    anchorMs = Date.UTC(ay, am - 1, ad);
  } else if (colaborador.dataAdmissao && /^\d{2}\/\d{2}\/\d{4}/.test(colaborador.dataAdmissao)) {
    const [ad, am, ay] = colaborador.dataAdmissao.split('/').map(Number);
    anchorMs = Date.UTC(ay, am - 1, ad);
  }
  const diffDays = Math.round((dateObj.getTime() - anchorMs) / 86400000);
  return Math.abs(diffDays) % 2 === 0;
}

export const MinhaEscalaScreen: React.FC<MinhaEscalaScreenProps> = ({
  colaborador,
  posto,
  condominios,
  coberturas,
  onResponderCobertura,
  onSolicitarAjuste,
  onOpenSupport,
}) => {
  const todaySP = useMemo(() => getTodayPartsSP(), []);
  const [viewYear, setViewYear] = useState<number>(todaySP.year);
  const [viewMonth, setViewMonth] = useState<number>(todaySP.month);
  const [selectedDay, setSelectedDay] = useState<number>(todaySP.day);

  const [ajusteModalOpen, setAjusteModalOpen] = useState(false);
  const [motivoAjuste, setMotivoAjuste] = useState('');
  const [ajusteEnviando, setAjusteEnviando] = useState(false);
  const [ajusteErro, setAjusteErro] = useState<string | null>(null);
  const [ajusteEnviado, setAjusteEnviado] = useState(false);

  const [recusaTargetId, setRecusaTargetId] = useState<string | null>(null);
  const [recusaMotivo, setRecusaMotivo] = useState('');
  const [respondendoId, setRespondendoId] = useState<string | null>(null);
  const [respostaFeedback, setRespostaFeedback] = useState<string | null>(null);

  const monthLabel = useMemo(() => {
    const label = new Intl.DateTimeFormat('pt-BR', {
      month: 'long',
      year: 'numeric',
    }).format(new Date(Date.UTC(viewYear, viewMonth, 15)));
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [viewYear, viewMonth]);

  const daysInMonth = useMemo(
    () => new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate(),
    [viewYear, viewMonth]
  );

  const firstWeekday = useMemo(
    () => new Date(Date.UTC(viewYear, viewMonth, 1)).getUTCDay(),
    [viewYear, viewMonth]
  );

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
    setSelectedDay(1);
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
    setSelectedDay(1);
  };

  const coberturasAtivas = useMemo(
    () =>
      coberturas.filter(
        (c) => c.status !== 'cancelada' && c.status !== 'recusada'
      ),
    [coberturas]
  );

  const convitesPendentes = useMemo(
    () => coberturas.filter((c) => c.status === 'aguardando_aceite'),
    [coberturas]
  );

  const getCoberturaForDay = (day: number): CoberturaProgramada | undefined => {
    const iso = formatDateIso(viewYear, viewMonth, day);
    return coberturasAtivas.find((c) => c.dataInicio <= iso && c.dataFim >= iso);
  };

  const selectedDateIso = formatDateIso(viewYear, viewMonth, Math.min(selectedDay, daysInMonth));
  const selectedCobertura = getCoberturaForDay(Math.min(selectedDay, daysInMonth));
  const selectedIsHabitualWork = isHabitualWorkDay(
    colaborador,
    viewYear,
    viewMonth,
    Math.min(selectedDay, daysInMonth)
  );

  const selectedDateFormatted = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(viewYear, viewMonth, Math.min(selectedDay, daysInMonth))));

  // Próximos 7 dias a partir de hoje (separando habitual e extras/coberturas)
  const upcomingShifts = useMemo(() => {
    const list: Array<{
      iso: string;
      data: string;
      horario: string;
      tipo: 'trabalho' | 'folga' | 'cobertura';
      status: string;
      posto: string;
    }> = [];

    const baseDate = new Date(Date.UTC(todaySP.year, todaySP.month, todaySP.day));
    for (let i = 0; i < 7; i++) {
      const dt = new Date(baseDate.getTime() + i * 86400000);
      const y = dt.getUTCFullYear();
      const m = dt.getUTCMonth();
      const d = dt.getUTCDate();
      const iso = formatDateIso(y, m, d);
      const cov = coberturasAtivas.find((c) => c.dataInicio <= iso && c.dataFim >= iso);
      const workHabitual = isHabitualWorkDay(colaborador, y, m, d);

      const dateLabel = new Intl.DateTimeFormat('pt-BR', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(dt);

      if (cov) {
        const covPosto =
          condominios.find((p) => p.id === cov.postoCoberturaId)?.nome ||
          cov.postoCoberturaNome ||
          'Posto de Cobertura';
        list.push({
          iso,
          data: dateLabel,
          horario: `${cov.horaInicio} às ${cov.horaFim}`,
          tipo: 'cobertura',
          status:
            cov.status === 'aguardando_aceite'
              ? 'Aguardando Aceite'
              : cov.tipo === 'extra'
              ? 'Extra/FT Confirmada'
              : 'Cobertura Confirmada',
          posto: covPosto,
        });
      } else if (workHabitual) {
        list.push({
          iso,
          data: dateLabel,
          horario: `${colaborador.turnoInicio || '07:00'} às ${colaborador.turnoFim || '19:00'}`,
          tipo: 'trabalho',
          status: 'Escala Habitual',
          posto: posto.nome,
        });
      } else {
        list.push({
          iso,
          data: dateLabel,
          horario: `Folga Escala ${colaborador.tipoEscala || '12x36'}`,
          tipo: 'folga',
          status: 'Folga Programada',
          posto: 'Descanso',
        });
      }
    }
    return list;
  }, [todaySP, coberturasAtivas, colaborador, condominios, posto.nome]);

  const handleEnviarAjuste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivoAjuste.trim()) return;
    setAjusteEnviando(true);
    setAjusteErro(null);
    const res = await onSolicitarAjuste(selectedDateIso, motivoAjuste.trim());
    setAjusteEnviando(false);
    if (!res.success) {
      setAjusteErro(res.message);
      return;
    }
    setAjusteEnviado(true);
    setMotivoAjuste('');
  };

  const handleAceitar = async (cov: CoberturaProgramada) => {
    setRespondendoId(cov.id);
    const res = await onResponderCobertura(cov, true);
    setRespondendoId(null);
    setRespostaFeedback(res.message);
  };

  const handleConfirmarRecusa = async (cov: CoberturaProgramada) => {
    setRespondendoId(cov.id);
    const res = await onResponderCobertura(
      cov,
      false,
      recusaMotivo.trim() || 'Indisponibilidade informada pelo colaborador'
    );
    setRespondendoId(null);
    setRecusaTargetId(null);
    setRecusaMotivo('');
    setRespostaFeedback(res.message);
  };

  const CondoIcon = getCondoIconComponent(posto.icone);
  const condoColor = getCondoColorDef(posto.cor);

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-blue-400" />
            <span>Minha Escala de Trabalho</span>
          </h2>
          <div className="flex items-center gap-2 mt-0.5">
            <CondominioBadge icone={posto.icone} cor={posto.cor} size="xs" showLabel={false} />
            <p className="text-xs text-slate-400">
              Lotação habitual {colaborador.tipoEscala || '12x36'} · <strong>{posto.nome}</strong>
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setAjusteEnviado(false);
            setAjusteErro(null);
            setAjusteModalOpen(true);
          }}
          className="px-3 py-1.5 rounded-xl bg-blue-600/15 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 shrink-0"
        >
          <FileQuestion className="w-3.5 h-3.5" />
          <span>Solicitar Ajuste</span>
        </button>
      </div>

      {/* Garantia de lotação permanente */}
      <div className="p-3 rounded-2xl bg-blue-950/30 border border-blue-500/25 flex items-center gap-2.5 text-[11px] text-slate-300">
        <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
        <span>
          Seu posto habitual (<strong className="text-white">{posto.nome}</strong>) e escala fixa são permanentes. Coberturas e extras aparecem separadamente sem alterar sua lotação.
        </span>
      </div>

      {/* Convites de Extra/Cobertura Pendentes de Aceite */}
      {convitesPendentes.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider px-1 flex items-center gap-1.5">
            <CalendarClock className="w-4 h-4" />
            <span>Convites de Extra / Cobertura Pendentes ({convitesPendentes.length})</span>
          </h3>

          {convitesPendentes.map((cov) => {
            const covPostoNome =
              condominios.find((p) => p.id === cov.postoCoberturaId)?.nome ||
              cov.postoCoberturaNome ||
              cov.postoCoberturaId;
            return (
              <div
                key={cov.id}
                className="p-3.5 rounded-2xl bg-amber-950/25 border border-amber-500/40 space-y-2.5 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <strong className="text-white block">
                      {cov.tipo.toUpperCase()} · {covPostoNome}
                    </strong>
                    <span className="text-[11px] text-amber-200 font-mono">
                      {cov.dataInicio}
                      {cov.dataFim !== cov.dataInicio ? ` até ${cov.dataFim}` : ''} · {cov.horaInicio}–{cov.horaFim}
                    </span>
                    {cov.motivo && (
                      <p className="text-[11px] text-slate-300 mt-1">{cov.motivo}</p>
                    )}
                  </div>
                </div>

                {recusaTargetId === cov.id ? (
                  <div className="space-y-2 pt-1">
                    <input
                      type="text"
                      value={recusaMotivo}
                      onChange={(e) => setRecusaMotivo(e.target.value)}
                      placeholder="Motivo da recusa (opcional)..."
                      className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRecusaTargetId(null);
                          setRecusaMotivo('');
                        }}
                        className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold cursor-pointer"
                      >
                        Voltar
                      </button>
                      <button
                        type="button"
                        disabled={respondendoId === cov.id}
                        onClick={() => handleConfirmarRecusa(cov)}
                        className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold cursor-pointer"
                      >
                        Confirmar Recusa
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={respondendoId === cov.id}
                      onClick={() => handleAceitar(cov)}
                      className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Aceitar</span>
                    </button>
                    <button
                      type="button"
                      disabled={respondendoId === cov.id}
                      onClick={() => setRecusaTargetId(cov.id)}
                      className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-red-600/30 border border-slate-700 text-slate-200 font-bold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5 text-red-400" />
                      <span>Recusar</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {respostaFeedback && (
        <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
          <span>{respostaFeedback}</span>
          <button onClick={() => setRespostaFeedback(null)} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Calendário Mensal Real */}
      <div className="rounded-3xl bg-[#091029] border border-blue-500/30 p-4 sm:p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <button
            onClick={goPrevMonth}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-white tracking-wide font-mono">{monthLabel}</span>
          <button
            onClick={goNextMonth}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 uppercase">
          <span>Dom</span>
          <span>Seg</span>
          <span>Ter</span>
          <span>Qua</span>
          <span>Qui</span>
          <span>Sex</span>
          <span>Sáb</span>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {Array.from({ length: firstWeekday }).map((_, idx) => (
            <div key={`empty-${idx}`} className="h-10" />
          ))}

          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const cov = getCoberturaForDay(day);
            const isWork = isHabitualWorkDay(colaborador, viewYear, viewMonth, day);
            const isSelected = Math.min(selectedDay, daysInMonth) === day;
            const isToday =
              viewYear === todaySP.year && viewMonth === todaySP.month && day === todaySP.day;

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`h-10 rounded-xl flex flex-col items-center justify-center relative font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white font-bold ring-2 ring-blue-400 shadow-md shadow-blue-500/30 scale-105 z-10'
                    : isToday
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-400/50'
                    : cov
                    ? 'bg-amber-950/35 text-amber-200 border border-amber-500/40 hover:bg-amber-900/40'
                    : isWork
                    ? 'bg-slate-900/90 text-slate-200 hover:bg-slate-800 border border-slate-800'
                    : 'bg-slate-950/40 text-slate-500 hover:bg-slate-900'
                }`}
              >
                <span className="text-[11px] leading-tight">{day}</span>
                {cov ? (
                  <span
                    className="w-2 h-2 rounded-full mt-1 bg-amber-400"
                    title={`Programação: ${cov.tipo} em ${cov.postoCoberturaNome || cov.postoCoberturaId}`}
                  />
                ) : isWork ? (
                  <span
                    className="w-3.5 h-3.5 rounded-full flex items-center justify-center mt-0.5"
                    style={{
                      backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : `${condoColor.hex}25`,
                      color: isSelected ? '#ffffff' : condoColor.hex,
                    }}
                    title={`Plantão habitual em ${posto.nome}`}
                  >
                    <CondoIcon className="w-2.5 h-2.5" />
                  </span>
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full mt-1.5 bg-slate-700" />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3.5 text-[10px] text-slate-400 pt-2 border-t border-slate-800">
          <span className="flex items-center gap-1.5">
            <CondominioBadge icone={posto.icone} cor={posto.cor} size="xs" showLabel={false} />
            <span>Habitual: <strong>{posto.nome}</strong></span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>Extra / Cobertura</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-600" />
            <span>Folga</span>
          </span>
        </div>
      </div>

      {/* Detalhes do Dia Selecionado */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-950/40 via-slate-900 to-indigo-950/40 border border-blue-500/30 p-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-white flex items-center gap-1.5 capitalize">
            <CalendarDays className="w-4 h-4 text-blue-400 shrink-0" />
            <span>{selectedDateFormatted}</span>
          </span>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
              selectedCobertura
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : selectedIsHabitualWork
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {selectedCobertura
              ? `${selectedCobertura.tipo.toUpperCase()} (${selectedCobertura.status})`
              : selectedIsHabitualWork
              ? 'Turno Habitual'
              : 'Folga de Escala'}
          </span>
        </div>

        {selectedCobertura ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300 pt-1">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Horário: <strong>{selectedCobertura.horaInicio} às {selectedCobertura.horaFim}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="truncate">
                Posto cobertura:{' '}
                <strong>
                  {condominios.find((p) => p.id === selectedCobertura.postoCoberturaId)?.nome ||
                    selectedCobertura.postoCoberturaNome ||
                    selectedCobertura.postoCoberturaId}
                </strong>
              </span>
            </div>
          </div>
        ) : selectedIsHabitualWork ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300 pt-1">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400 shrink-0" />
              <span>
                Horário:{' '}
                <strong>
                  {colaborador.turnoInicio || '07:00'} às {colaborador.turnoFim || '19:00'}
                </strong>
              </span>
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <CondominioBadge icone={posto.icone} cor={posto.cor} size="xs" showLabel={false} />
              <span className="truncate">
                Posto habitual: <strong>{posto.nome}</strong>
              </span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400 pt-1">
            Dia de descanso programado conforme escala {colaborador.tipoEscala || '12x36'}.
          </p>
        )}
      </div>

      {/* Próximos 7 dias */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Agenda dos Próximos 7 Dias
          </h3>
          <button
            type="button"
            onClick={onOpenSupport}
            className="text-[11px] text-blue-400 hover:text-blue-300 font-bold cursor-pointer"
          >
            Falar com RH
          </button>
        </div>

        <div className="space-y-2">
          {upcomingShifts.map((shift) => (
            <div
              key={shift.iso}
              className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    shift.tipo === 'cobertura'
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      : shift.tipo === 'trabalho'
                      ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-white block truncate capitalize">{shift.data}</span>
                  <span className="text-[11px] text-slate-400 block truncate font-mono">
                    {shift.horario} · {shift.posto}
                  </span>
                </div>
              </div>

              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                  shift.tipo === 'cobertura'
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    : shift.tipo === 'trabalho'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {shift.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: Solicitar Ajuste de Escala */}
      {ajusteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-[#091029] border border-blue-500/30 p-5 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 className="text-sm font-bold text-white">Solicitar Ajuste de Escala</h3>
              <button
                onClick={() => setAjusteModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {ajusteEnviado ? (
              <div className="text-center py-6 space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <h4 className="text-sm font-bold text-white">Solicitação Encaminhada!</h4>
                <p className="text-xs text-slate-400">
                  Seu pedido foi gravado no servidor para análise da Supervisão / RH.
                </p>
                <button
                  onClick={() => setAjusteModalOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <form onSubmit={handleEnviarAjuste} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Data Selecionada</label>
                  <input
                    type="text"
                    disabled
                    value={`${selectedDateIso} · ${posto.nome}`}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Motivo do Pedido de Troca ou Ajuste
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={motivoAjuste}
                    onChange={(e) => setMotivoAjuste(e.target.value)}
                    placeholder="Descreva a razão (ex: consulta médica, permuta autorizada)..."
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                {ajusteErro && (
                  <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-[11px]">
                    {ajusteErro}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setAjusteModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={ajusteEnviando || !motivoAjuste.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-bold shadow-lg shadow-blue-600/30 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {ajusteEnviando ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>{ajusteEnviando ? 'Enviando...' : 'Enviar'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
