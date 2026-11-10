import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Building,
  CheckCircle2,
  CalendarDays,
  Send,
  X,
  FileQuestion,
} from 'lucide-react';
import { Colaborador, CondominioPosto } from '../../../types';
import {
  CondominioBadge,
  getCondoIconComponent,
  getCondoColorDef,
} from '../../common/CondominioBadge';

interface MinhaEscalaScreenProps {
  colaborador: Colaborador;
  posto: CondominioPosto;
  onOpenSupport: () => void;
}

export const MinhaEscalaScreen: React.FC<MinhaEscalaScreenProps> = ({
  colaborador,
  posto,
  onOpenSupport,
}) => {
  const [selectedDay, setSelectedDay] = useState<number>(15);
  const [currentMonth, setCurrentMonth] = useState<string>('Abril 2026');
  const [ajusteModalOpen, setAjusteModalOpen] = useState(false);
  const [motivoAjuste, setMotivoAjuste] = useState('');
  const [ajusteEnviado, setAjusteEnviado] = useState(false);

  // Simulação de dias do mês de 30 dias (Abril) na escala 12x36
  // Dias ímpares de trabalho (1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29)
  const isWorkDay = (day: number) => day % 2 !== 0;

  const upcomingShifts = [
    {
      data: 'Terça-feira · 15/04/2026',
      horario: '07:00 às 19:00',
      tipo: 'trabalho',
      status: 'Turno Confirmado',
      posto: posto.nome,
    },
    {
      data: 'Quarta-feira · 16/04/2026',
      horario: 'Folga Escala 12x36',
      tipo: 'folga',
      status: 'Folga Programada',
      posto: 'Residência',
    },
    {
      data: 'Quinta-feira · 17/04/2026',
      horario: '07:00 às 19:00',
      tipo: 'trabalho',
      status: 'Turno Confirmado',
      posto: posto.nome,
    },
    {
      data: 'Sexta-feira · 18/04/2026',
      horario: 'Folga Escala 12x36',
      tipo: 'folga',
      status: 'Folga Programada',
      posto: 'Residência',
    },
    {
      data: 'Sábado · 19/04/2026',
      horario: '07:00 às 19:00',
      tipo: 'trabalho',
      status: 'Turno Confirmado',
      posto: posto.nome,
    },
  ];

  const handleEnviarAjuste = (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivoAjuste.trim()) return;
    setAjusteEnviado(true);
    setTimeout(() => {
      setAjusteEnviado(false);
      setAjusteModalOpen(false);
      setMotivoAjuste('');
    }, 2000);
  };

  const CondoIcon = getCondoIconComponent(posto.icone);
  const condoColor = getCondoColorDef(posto.cor);

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Header da Aba */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-blue-400" />
            <span>Minha Escala de Trabalho</span>
          </h2>
          <div className="flex items-center gap-2 mt-0.5">
            <CondominioBadge icone={posto.icone} cor={posto.cor} size="xs" showLabel={false} />
            <p className="text-xs text-slate-400">
              Escala oficial {colaborador.tipoEscala || '12x36'} · <strong>{posto.nome}</strong>
            </p>
          </div>
        </div>

        <button
          onClick={() => setAjusteModalOpen(true)}
          className="px-3 py-1.5 rounded-xl bg-blue-600/15 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
        >
          <FileQuestion className="w-3.5 h-3.5" />
          <span>Solicitar Ajuste</span>
        </button>
      </div>

      {/* Calendário Mensal Interativo marcado com o Ícone e Cor do Posto */}
      <div className="rounded-3xl bg-[#091029] border border-blue-500/30 p-4 sm:p-5 shadow-2xl space-y-4">
        {/* Controle do Mês */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <button
            onClick={() => setCurrentMonth('Março 2026')}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-white tracking-wide font-mono">
            {currentMonth}
          </span>
          <button
            onClick={() => setCurrentMonth('Maio 2026')}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Cabeçalho dos dias da semana */}
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 uppercase">
          <span>Dom</span>
          <span>Seg</span>
          <span>Ter</span>
          <span>Qua</span>
          <span>Qui</span>
          <span>Sex</span>
          <span>Sáb</span>
        </div>

        {/* Grade de Dias (30 dias de Abril iniciando numa Quarta) */}
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {/* Espaçadores vazios para iniciar na Quarta (3 dias) */}
          <div className="h-10" />
          <div className="h-10" />
          <div className="h-10" />

          {Array.from({ length: 30 }, (_, i) => i + 1).map((day) => {
            const isWork = isWorkDay(day);
            const isSelected = selectedDay === day;
            const isToday = day === 15;

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`h-10 rounded-xl flex flex-col items-center justify-center relative font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white font-bold ring-2 ring-blue-400 shadow-md shadow-blue-500/30 scale-105 z-10'
                    : isToday
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-400/50'
                    : isWork
                    ? 'bg-slate-900/90 text-slate-200 hover:bg-slate-800 border border-slate-800'
                    : 'bg-slate-950/40 text-slate-500 hover:bg-slate-900'
                }`}
              >
                <span className="text-[11px] leading-tight">{day}</span>
                {/* O ÍCONE DO CONDOMÍNIO MARCA A DATA NO CALENDÁRIO */}
                {isWork ? (
                  <span
                    className="w-3.5 h-3.5 rounded-full flex items-center justify-center mt-0.5 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : `${condoColor.hex}25`,
                      color: isSelected ? '#ffffff' : condoColor.hex,
                    }}
                    title={`Plantão escalado em ${posto.nome}`}
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

        {/* Legenda de Cores e Ícones */}
        <div className="flex flex-wrap items-center justify-center gap-3.5 text-[10px] text-slate-400 pt-2 border-t border-slate-800">
          <span className="flex items-center gap-1.5">
            <CondominioBadge icone={posto.icone} cor={posto.cor} size="xs" showLabel={false} />
            <span>Plantão: <strong>{posto.nome}</strong></span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-600" />
            <span>Folga Escala 12x36</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Feriado</span>
          </span>
        </div>
      </div>

      {/* Cartão de Detalhes do Dia Selecionado com Badge do Posto */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-950/40 via-slate-900 to-indigo-950/40 border border-blue-500/30 p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4 text-blue-400" />
            <span>Plantão de {selectedDay} de Abril de 2026</span>
          </span>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              isWorkDay(selectedDay)
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {isWorkDay(selectedDay) ? 'Turno Confirmado' : 'Folga de Escala'}
          </span>
        </div>

        {isWorkDay(selectedDay) ? (
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 pt-1">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400 shrink-0" />
              <span>
                Horário: <strong>07:00 às 19:00 (12h)</strong>
              </span>
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <CondominioBadge icone={posto.icone} cor={posto.cor} size="xs" showLabel={false} />
              <span className="truncate">
                Condomínio: <strong>{posto.nome}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="truncate">
                Posto: <strong>{colaborador.postoNome || 'Portaria Principal'}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Rendição com rendição programada</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400 pt-1">
            Dia de descanso remunerado conforme escala 12x36 homologada. Em caso de necessidade de cobertura extra, o supervisor entrará em contato.
          </p>
        )}
      </div>

      {/* Lista Cronológica de Próximos Turnos */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider px-1">
          Próximos Turnos Agendados
        </h3>

        <div className="space-y-2">
          {upcomingShifts.map((shift, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    shift.tipo === 'trabalho'
                      ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-white block truncate">
                    {shift.data}
                  </span>
                  <span className="text-[11px] text-slate-400 block truncate font-mono">
                    {shift.horario} · {shift.posto}
                  </span>
                </div>
              </div>

              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                  shift.tipo === 'trabalho'
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
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {ajusteEnviado ? (
              <div className="text-center py-6 space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <h4 className="text-sm font-bold text-white">Solicitação Encaminhada!</h4>
                <p className="text-xs text-slate-400">
                  Seu pedido foi registrado para análise da Supervisão Operacional.
                </p>
              </div>
            ) : (
              <form onSubmit={handleEnviarAjuste} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Turno Selecionado
                  </label>
                  <input
                    type="text"
                    disabled
                    value={`${selectedDay} de Abril de 2026 - ${posto.nome}`}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 font-mono text-xs"
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
                    placeholder="Descreva a razão (ex: consulta médica, permuta com colega de escala)..."
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>

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
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Enviar</span>
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
