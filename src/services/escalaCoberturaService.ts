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

function toMinutes(hhmm: string): number {
  const [h, m] = (hhmm || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Detecta sobreposição de agendas ativas/aguardando aceite do mesmo colaborador.
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
  const cStartMin = toMinutes(candidate.horaInicio);
  const cEndMin = toMinutes(candidate.horaFim);
  const cOvernight = cEndMin <= cStartMin;

  for (const cov of existing) {
    if (cov.id === candidate.id) continue;
    if (cov.colaboradorId !== candidate.colaboradorId) continue;
    if (!activeStatuses.has(cov.status)) continue;

    // Intervalos de data se cruzam?
    if (cov.dataFim < candidate.dataInicio || cov.dataInicio > candidate.dataFim) {
      continue;
    }

    const eStartMin = toMinutes(cov.horaInicio);
    const eEndMin = toMinutes(cov.horaFim);
    const eOvernight = eEndMin <= eStartMin;

    if (cOvernight || eOvernight) {
      return cov;
    }
    if (cStartMin < eEndMin && cEndMin > eStartMin) {
      return cov;
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
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes?.user?.id || null;

    const { error } = await supabase.from('coberturas_programadas').insert({
      id: nova.id,
      empresa_id: nova.empresaId,
      colaborador_id: nova.colaboradorId,
      colaborador_nome: nova.colaboradorNome,
      posto_principal_id: nova.postoPrincipalId,
      posto_cobertura_id: nova.postoCoberturaId,
      posto_cobertura_nome: nova.postoCoberturaNome,
      tipo: nova.tipo,
      data_inicio: nova.dataInicio,
      data_fim: nova.dataFim,
      hora_inicio: nova.horaInicio,
      hora_fim: nova.horaFim,
      motivo: nova.motivo || null,
      substituido_colaborador_id: nova.substituidoColaboradorId,
      alerta_origem_id: nova.alertaOrigemId,
      valor_extra_ft: nova.valorExtraFT,
      status: nova.status,
      aceite_colaborador: nova.aceiteColaborador,
      criado_por: uid,
      criado_por_nome: input.criadoPorNome || null,
      aprovado_por: statusInicial === 'aprovada' ? uid : null,
    });

    if (error) {
      return { success: false, message: `Erro ao salvar escala/cobertura no banco: ${error.message}` };
    }

    await supabase.from('coberturas_historico').insert({
      empresa_id: nova.empresaId,
      cobertura_id: nova.id,
      acao: 'criada',
      ator_id: uid,
      ator_nome: input.criadoPorNome || 'Gestão',
      detalhes: `${nova.tipo} em ${nova.postoCoberturaNome} (${nova.dataInicio} a ${nova.dataFim}, ${nova.horaInicio}-${nova.horaFim})`,
    });

    await supabase.from('notificacoes_sistema').insert({
      empresa_id: nova.empresaId,
      destinatario_colaborador_id: nova.colaboradorId,
      categoria: 'cobertura',
      titulo: input.exigeAceiteColaborador
        ? `Convite de ${nova.tipo === 'extra' ? 'Extra/FT' : 'Cobertura'} em ${nova.postoCoberturaNome}`
        : `Nova ${nova.tipo} programada em ${nova.postoCoberturaNome}`,
      mensagem: `${nova.dataInicio} a ${nova.dataFim} (${nova.horaInicio}–${nova.horaFim}). Seu posto habitual permanece preservado.`,
      referencia_tipo: 'cobertura',
      referencia_id: nova.id,
      link_destino: 'minha_escala',
    });
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
  atorNome?: string
): Promise<{ success: boolean; status: CoberturaProgramada['status']; message: string }> {
  const novoStatus: CoberturaProgramada['status'] = aceitar ? 'aprovada' : 'recusada';
  const nowIso = new Date().toISOString();
  const supabase = getSupabase();

  if (supabase) {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes?.user?.id || null;

    const { error } = await supabase
      .from('coberturas_programadas')
      .update({
        status: novoStatus,
        aceite_colaborador: aceitar,
        aceite_em: nowIso,
        recusa_motivo: aceitar ? null : motivoRecusa || 'Recusado pelo colaborador',
        updated_at: nowIso,
      })
      .eq('id', cobertura.id);

    if (error) {
      return { success: false, status: cobertura.status, message: `Falha ao registrar resposta: ${error.message}` };
    }

    await supabase.from('coberturas_historico').insert({
      empresa_id: cobertura.empresaId,
      cobertura_id: cobertura.id,
      acao: aceitar ? 'aceita' : 'recusada',
      ator_id: uid,
      ator_nome: atorNome || cobertura.colaboradorNome || 'Colaborador',
      detalhes: aceitar ? 'Colaborador aceitou a escala programada.' : motivoRecusa || 'Recusada pelo colaborador.',
    });

    await supabase.from('notificacoes_sistema').insert({
      empresa_id: cobertura.empresaId,
      destinatario_role: 'supervisor',
      categoria: 'cobertura',
      titulo: aceitar
        ? `Cobertura aceita por ${cobertura.colaboradorNome || 'Colaborador'}`
        : `Cobertura recusada por ${cobertura.colaboradorNome || 'Colaborador'}`,
      mensagem: `${cobertura.postoCoberturaNome || cobertura.postoCoberturaId} (${cobertura.dataInicio}): ${
        aceitar ? 'Confirmada' : motivoRecusa || 'Recusada'
      }.`,
      referencia_tipo: 'cobertura',
      referencia_id: cobertura.id,
    });
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
  atorNome?: string,
  detalhes?: string
): Promise<{ success: boolean; message: string }> {
  const supabase = getSupabase();
  if (supabase) {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes?.user?.id || null;
    const { error } = await supabase
      .from('coberturas_programadas')
      .update({ status: novoStatus, updated_at: new Date().toISOString() })
      .eq('id', cobertura.id);

    if (error) return { success: false, message: error.message };

    await supabase.from('coberturas_historico').insert({
      empresa_id: cobertura.empresaId,
      cobertura_id: cobertura.id,
      acao: novoStatus === 'cancelada' ? 'cancelada' : novoStatus === 'concluida' ? 'concluida' : 'aprovada',
      ator_id: uid,
      ator_nome: atorNome || 'Gestão',
      detalhes: detalhes || `Status alterado para ${novoStatus}`,
    });
  }
  return { success: true, message: `Status atualizado para ${novoStatus}.` };
}
