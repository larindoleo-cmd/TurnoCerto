/**
 * TurnoCerto - Serviço de Escalas, Extras, Coberturas e Substituições Temporárias
 * Regras:
 * - Nunca altera colaboradores.condominio_id ou escala habitual ao programar cobertura/extra.
 * - Valida conflito de datas/horários no mesmo período (incluindo turnos noturnos).
 * - Registra histórico completo e envia notificações ao colaborador e à gestão.
 */

import {
  CoberturaProgramada,
  CoberturaHistorico,
  Colaborador,
  CondominioPosto,
  TipoCobertura,
} from '../types';
import { getSupabase } from '../lib/supabase';

export interface CriarCoberturaInput {
  empresaId: string;
  colaborador: Colaborador;
  postoCobertura: CondominioPosto;
  tipo: TipoCobertura;
  dataInicio: string; // YYYY-MM-DD
  dataFim: string;    // YYYY-MM-DD
  horaInicio: string; // HH:MM
  horaFim: string;    // HH:MM
  motivo?: string;
  substituidoColaboradorId?: string;
  alertaOrigemId?: string;
  valorExtraFT?: number;
  exigeAceiteColaborador?: boolean;
  criadoPorNome?: string;
}

function addDaysIso(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + delta));
  return dt.toISOString().slice(0, 10);
}

function normalizeTimeHhMm(hhmm: string): string {
  const [h, m] = (hhmm || '00:00').split(':').map(Number);
  const hh = String(Math.min(23, Math.max(0, h || 0))).padStart(2, '0');
  const mm = String(Math.min(59, Math.max(0, m || 0))).padStart(2, '0');
  return `${hh}:${mm}`;
}

function expandShiftIntervalsMs(cov: {
  dataInicio: string;
  dataFim: string;
  horaInicio: string;
  horaFim: string;
}): Array<[number, number]> {
  const intervals: Array<[number, number]> = [];
  if (!cov.dataInicio || !cov.dataFim || cov.dataFim < cov.dataInicio) return intervals;
  const hIni = normalizeTimeHhMm(cov.horaInicio);
  const hFim = normalizeTimeHhMm(cov.horaFim);
  const overnight = hFim <= hIni;

  let day = cov.dataInicio;
  let guard = 0;
  while (day <= cov.dataFim && guard < 366) {
    const startMs = Date.parse(`${day}T${hIni}:00-03:00`);
    const endDay = overnight ? addDaysIso(day, 1) : day;
    const endMs = Date.parse(`${endDay}T${hFim}:00-03:00`);
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
      intervals.push([startMs, endMs]);
    }
    day = addDaysIso(day, 1);
    guard++;
  }
  return intervals;
}

/**
 * Detecta sobreposição real de agendas ativas/aguardando aceite do mesmo colaborador
 * considerando timestamps absolutos em America/Sao_Paulo (suporta turnos noturnos e fronteiras adjacentes).
 */
export function hasCoverageConflict(
  existing: CoberturaProgramada[],
  candidate: {
    id?: string;
    colaboradorId: string;
    dataInicio: string;
    dataFim: string;
    horaInicio: string;
    horaFim: string;
  }
): CoberturaProgramada | null {
  const activeStatuses = new Set(['aguardando_aceite', 'aprovada', 'em_andamento']);
  const candIntervals = expandShiftIntervalsMs(candidate);
  if (candIntervals.length === 0) return null;

  for (const cov of existing) {
    if (cov.id === candidate.id) continue;
    if (cov.colaboradorId !== candidate.colaboradorId) continue;
    if (!activeStatuses.has(cov.status)) continue;

    // Margem de 1 dia para turnos noturnos que cruzam a meia-noite
    const covNextDay = addDaysIso(cov.dataFim, 1);
    const candNextDay = addDaysIso(candidate.dataFim, 1);
    if (covNextDay < candidate.dataInicio || cov.dataInicio > candNextDay) {
      continue;
    }

    const covIntervals = expandShiftIntervalsMs(cov);
    for (const [cStart, cEnd] of candIntervals) {
      for (const [eStart, eEnd] of covIntervals) {
        // Semi-aberto [inicio, fim): turnos exatamente adjacentes (07:00-19:00 vs 19:00-07:00) NÃO conflitam
        if (cStart < eEnd && cEnd > eStart) {
          return cov;
        }
      }
    }
  }
  return null;
}

export function mapCoberturaRow(r: Record<string, unknown>): CoberturaProgramada {
  return {
    id: String(r.id),
    empresaId: String(r.empresa_id || 'emp-matriz-principal'),
    colaboradorId: String(r.colaborador_id),
    colaboradorNome: r.colaborador_nome ? String(r.colaborador_nome) : undefined,
    postoPrincipalId: r.posto_principal_id ? String(r.posto_principal_id) : null,
    postoCoberturaId: String(r.posto_cobertura_id),
    postoCoberturaNome: r.posto_cobertura_nome ? String(r.posto_cobertura_nome) : undefined,
    tipo: (r.tipo as TipoCobertura) || 'cobertura',
    dataInicio: String(r.data_inicio).slice(0, 10),
    dataFim: String(r.data_fim).slice(0, 10),
    horaInicio: String(r.hora_inicio || '07:00').slice(0, 5),
    horaFim: String(r.hora_fim || '19:00').slice(0, 5),
    motivo: r.motivo ? String(r.motivo) : undefined,
    substituidoColaboradorId: r.substituido_colaborador_id ? String(r.substituido_colaborador_id) : null,
    alertaOrigemId: r.alerta_origem_id ? String(r.alerta_origem_id) : null,
    valorExtraFT: r.valor_extra_ft !== undefined && r.valor_extra_ft !== null ? Number(r.valor_extra_ft) : 0,
    status: (r.status as CoberturaProgramada['status']) || 'aprovada',
    aceiteColaborador: r.aceite_colaborador === null || r.aceite_colaborador === undefined ? null : Boolean(r.aceite_colaborador),
    aceiteEm: r.aceite_em ? String(r.aceite_em) : null,
    recusaMotivo: r.recusa_motivo ? String(r.recusa_motivo) : null,
    criadoPorNome: r.criado_por_nome ? String(r.criado_por_nome) : undefined,
    criadoEm: String(r.created_at || new Date().toISOString()),
    atualizadoEm: r.updated_at ? String(r.updated_at) : undefined,
  };
}

export async function fetchCoberturas(colaboradorId?: string): Promise<CoberturaProgramada[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  let q = supabase.from('coberturas_programadas').select('*').order('data_inicio', { ascending: false });
  if (colaboradorId) q = q.eq('colaborador_id', colaboradorId);
  const { data, error } = await q;
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapCoberturaRow);
}

export async function fetchCoberturaHistorico(coberturaId: string): Promise<CoberturaHistorico[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('coberturas_historico')
    .select('*')
    .eq('cobertura_id', coberturaId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    coberturaId: String(r.cobertura_id),
    acao: r.acao as CoberturaHistorico['acao'],
    atorNome: r.ator_nome ? String(r.ator_nome) : undefined,
    detalhes: r.detalhes ? String(r.detalhes) : undefined,
    createdAt: String(r.created_at),
  }));
}

export async function criarCoberturaProgramada(
  input: CriarCoberturaInput,
  existingCoberturas: CoberturaProgramada[]
): Promise<{ success: boolean; cobertura?: CoberturaProgramada; message: string }> {
  if (!input.dataInicio || !input.dataFim || input.dataFim < input.dataInicio) {
    return { success: false, message: 'Data final não pode ser anterior à data inicial.' };
  }

  const conflict = hasCoverageConflict(existingCoberturas, {
    colaboradorId: input.colaborador.id,
    dataInicio: input.dataInicio,
    dataFim: input.dataFim,
    horaInicio: input.horaInicio,
    horaFim: input.horaFim,
  });

  if (conflict) {
    return {
      success: false,
      message: `Conflito de horário com cobertura existente (${conflict.postoCoberturaNome || conflict.postoCoberturaId} em ${conflict.dataInicio}).`,
    };
  }

  const statusInicial: CoberturaProgramada['status'] = input.exigeAceiteColaborador
    ? 'aguardando_aceite'
    : 'aprovada';
  const id = `cov-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const nowIso = new Date().toISOString();

  const nova: CoberturaProgramada = {
    id,
    empresaId: input.empresaId || 'emp-matriz-principal',
    colaboradorId: input.colaborador.id,
    colaboradorNome: input.colaborador.nome,
    postoPrincipalId: input.colaborador.condominioId || null,
    postoCoberturaId: input.postoCobertura.id,
    postoCoberturaNome: input.postoCobertura.nome,
    tipo: input.tipo,
    dataInicio: input.dataInicio,
    dataFim: input.dataFim,
    horaInicio: input.horaInicio,
    horaFim: input.horaFim,
    motivo: input.motivo,
    substituidoColaboradorId: input.substituidoColaboradorId || null,
    alertaOrigemId: input.alertaOrigemId || null,
    valorExtraFT: input.valorExtraFT ?? input.colaborador.valorExtraFT ?? 0,
    status: statusInicial,
    aceiteColaborador: input.exigeAceiteColaborador ? null : true,
    criadoPorNome: input.criadoPorNome,
    criadoEm: nowIso,
    atualizadoEm: nowIso,
  };

  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase.rpc('criar_cobertura_programada_transacional', {
      p_colaborador_id: nova.colaboradorId,
      p_posto_cobertura_id: nova.postoCoberturaId,
      p_tipo: nova.tipo,
      p_data_inicio: nova.dataInicio,
      p_data_fim: nova.dataFim,
      p_hora_inicio: nova.horaInicio,
      p_hora_fim: nova.horaFim,
      p_motivo: nova.motivo || null,
      p_substituido_colaborador_id: nova.substituidoColaboradorId,
      p_alerta_origem_id: nova.alertaOrigemId,
      p_valor_extra_ft: nova.valorExtraFT ?? null,
      p_exige_aceite: Boolean(input.exigeAceiteColaborador),
    });

    if (error) {
      return { success: false, message: `Erro ao salvar escala/cobertura no banco: ${error.message}` };
    }

    if (data && typeof data === 'object' && 'cobertura_id' in data) {
      nova.id = String((data as Record<string, unknown>).cobertura_id);
    }
  }

  return {
    success: true,
    cobertura: nova,
    message: input.exigeAceiteColaborador
      ? 'Programação criada e enviada para aceite do colaborador.'
      : 'Cobertura/extra programada e aprovada com sucesso.',
  };
}

export async function responderAceiteCobertura(
  cobertura: CoberturaProgramada,
  aceitar: boolean,
  motivoRecusa?: string,
  _atorNome?: string
): Promise<{ success: boolean; status: CoberturaProgramada['status']; message: string }> {
  const novoStatus: CoberturaProgramada['status'] = aceitar ? 'aprovada' : 'recusada';
  const supabase = getSupabase();

  if (supabase) {
    const { error } = await supabase.rpc('responder_aceite_cobertura', {
      p_cobertura_id: cobertura.id,
      p_aceitar: aceitar,
      p_motivo_recusa: aceitar ? null : motivoRecusa || 'Recusado pelo colaborador',
    });

    if (error) {
      return { success: false, status: cobertura.status, message: `Falha ao registrar resposta: ${error.message}` };
    }
  }

  return {
    success: true,
    status: novoStatus,
    message: aceitar ? 'Cobertura aceita e confirmada na sua escala!' : 'Recusa registrada e supervisão notificada.',
  };
}

export async function atualizarStatusCobertura(
  cobertura: CoberturaProgramada,
  novoStatus: 'cancelada' | 'concluida' | 'aprovada',
  _atorNome?: string,
  detalhes?: string
): Promise<{ success: boolean; message: string }> {
  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase.rpc('atualizar_status_cobertura_transacional', {
      p_cobertura_id: cobertura.id,
      p_novo_status: novoStatus,
      p_detalhes: detalhes || null,
    });

    if (error) return { success: false, message: error.message };
  }
  return { success: true, message: `Status atualizado para ${novoStatus}.` };
}

