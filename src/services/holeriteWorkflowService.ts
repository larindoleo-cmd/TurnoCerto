/**
 * TurnoCerto - Serviço de Lotes de Holerites, Publicação Agendada (America/Sao_Paulo),
 * Retificação Versionada e Confirmação de Recebimento e Ciência
 */

import {
  Colaborador,
  EmpresaInfo,
  HoleriteEvento,
  HoleriteLote,
  HoleriteRegistro,
  StatusPublicacaoHolerite,
} from '../types';
import { getSupabase } from '../lib/supabase';
import { generateHoleritePdfBytes } from './documentService';

export const HOLERITES_BUCKET = 'documentos-holerites';
export const CIENCIA_DECLARACAO_VERSAO = 'v1-recebimento-nao-concordancia';

/**
 * Converte data/hora local escolhida pelo RH no fuso America/Sao_Paulo (YYYY-MM-DDTHH:mm)
 * para ISO UTC consistente (considerando UTC-3 padrão de Brasília).
 */
export function saoPauloLocalInputToIsoUtc(localDateTime: string): string {
  if (!localDateTime) return new Date().toISOString();
  const normalized = localDateTime.length === 16 ? `${localDateTime}:00-03:00` : `${localDateTime}-03:00`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Data/hora de agendamento inválida.');
  }
  return parsed.toISOString();
}

export function mapHoleriteRow(r: Record<string, unknown>): HoleriteRegistro {
  return {
    id: String(r.id),
    empresaId: r.empresa_id ? String(r.empresa_id) : 'emp-matriz-principal',
    colaboradorId: String(r.colaborador_id),
    colaboradorNome: String(r.colaborador_nome || ''),
    matricula: String(r.matricula || ''),
    funcao: String(r.funcao || ''),
    postoNome: String(r.posto_nome || ''),
    mesReferencia: String(r.mes_referencia || ''),
    competencia: r.competencia ? String(r.competencia) : undefined,
    salarioBase: Number(r.salario_base || 0),
    adicionalPericulosidade: Number(r.adicional_periculosidade || 0),
    adicionalNoturno: Number(r.adicional_noturno || 0),
    horasExtras50: Number(r.horas_extras_50 || 0),
    valorHorasExtras: Number(r.valor_horas_extras || 0),
    plantoesFT: r.plantoes_ft !== undefined && r.plantoes_ft !== null ? Number(r.plantoes_ft) : undefined,
    valorFT: r.valor_ft !== undefined && r.valor_ft !== null ? Number(r.valor_ft) : undefined,
    descontoINSS: Number(r.desconto_inss || 0),
    descontoFGTS: Number(r.desconto_fgts || 0),
    descontoVT: Number(r.desconto_vt || 0),
    descontoVR: Number(r.desconto_vr || 0),
    bonusAssiduidade: r.bonus_assiduidade !== undefined ? Number(r.bonus_assiduidade) : 0,
    bonusAtivo: r.bonus_ativo !== false,
    motivoPerdaBonus: r.motivo_perda_bonus ? String(r.motivo_perda_bonus) : undefined,
    liquidoReceber: Number(r.liquido_receber ?? r.salario_liquido ?? 0),
    statusEnvio: (r.status_envio as HoleriteRegistro['statusEnvio']) || 'Pendente',
    dataEmissao: String(r.data_emissao || ''),
    loteId: r.lote_id ? String(r.lote_id) : undefined,
    versao: r.versao !== undefined ? Number(r.versao) : 1,
    statusPublicacao: (r.status_publicacao as StatusPublicacaoHolerite) || 'publicado',
    agendadoPara: r.agendado_para ? String(r.agendado_para) : undefined,
    publicadoEm: r.publicado_em ? String(r.publicado_em) : undefined,
    storagePath: r.storage_path ? String(r.storage_path) : undefined,
    pdfSha256: r.pdf_sha256 ? String(r.pdf_sha256) : undefined,
    retificadoDeId: r.retificado_de_id ? String(r.retificado_de_id) : undefined,
    motivoRetificacao: r.motivo_retificacao ? String(r.motivo_retificacao) : undefined,
    cienciaConfirmadaEm: r.ciencia_confirmada_em ? String(r.ciencia_confirmada_em) : undefined,
    cienciaUsuarioId: r.ciencia_usuario_id ? String(r.ciencia_usuario_id) : undefined,
    cienciaDeclaracaoVersao: r.ciencia_declaracao_versao ? String(r.ciencia_declaracao_versao) : undefined,
    ultimoErro: r.ultimo_erro ? String(r.ultimo_erro) : undefined,
  };
}

export function mapHoleriteLoteRow(r: Record<string, unknown>): HoleriteLote {
  return {
    id: String(r.id),
    empresaId: String(r.empresa_id || 'emp-matriz-principal'),
    competencia: String(r.competencia),
    competenciaLabel: String(r.competencia_label),
    titulo: String(r.titulo),
    status: (r.status as HoleriteLote['status']) || 'rascunho',
    agendadoPara: r.agendado_para ? String(r.agendado_para) : null,
    publicadoEm: r.publicado_em ? String(r.publicado_em) : null,
    totalItens: Number(r.total_itens || 0),
    totalErros: Number(r.total_erros || 0),
    ultimoErro: r.ultimo_erro ? String(r.ultimo_erro) : null,
    tentativas: Number(r.tentativas || 0),
    criadoPorNome: r.criado_por_nome ? String(r.criado_por_nome) : undefined,
    criadoEm: String(r.created_at || new Date().toISOString()),
  };
}

export async function fetchHoleriteLotes(): Promise<HoleriteLote[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('holerite_lotes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapHoleriteLoteRow);
}

export async function fetchHoleriteEventos(holeriteId?: string): Promise<HoleriteEvento[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  let q = supabase.from('holerite_eventos').select('*').order('created_at', { ascending: false });
  if (holeriteId) q = q.eq('holerite_id', holeriteId);
  const { data, error } = await q.limit(100);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    holeriteId: r.holerite_id ? String(r.holerite_id) : undefined,
    loteId: r.lote_id ? String(r.lote_id) : undefined,
    acao: String(r.acao),
    atorNome: r.ator_nome ? String(r.ator_nome) : undefined,
    detalhes: r.detalhes ? String(r.detalhes) : undefined,
    createdAt: String(r.created_at),
  }));
}

export function buildHoleriteFromColaborador(
  colab: Colaborador,
  competencia: string,
  mesReferenciaLabel: string,
  loteId: string,
  statusPublicacao: StatusPublicacaoHolerite,
  agendadoParaIso?: string
): HoleriteRegistro {
  const salarioBase = Number(colab.salarioBase || 2200);
  const periculosidade = colab.funcao === 'Vigilante Patrimonial' ? Number((salarioBase * 0.3).toFixed(2)) : 0;
  const adicionalNoturno = colab.turno === 'noturno' ? Number((salarioBase * 0.2).toFixed(2)) : 0;
  const plantoesFT = Number(colab.plantoesFT || 0);
  const valorFT = Number(((colab.valorExtraFT || 160) * plantoesFT).toFixed(2));
  const bonusAtivo = colab.status !== 'falta' && colab.status !== 'afastado' && (colab.valorBonus || 0) > 0;
  const bonusValor = bonusAtivo ? Number(colab.valorBonus || 0) : 0;

  const totalBruto = salarioBase + periculosidade + adicionalNoturno + valorFT + bonusValor;
  const descontoINSS = Number((totalBruto * 0.09).toFixed(2));
  const descontoFGTS = Number((totalBruto * 0.08).toFixed(2));
  const descontoVT = colab.recebeVT !== false ? Number((salarioBase * 0.06).toFixed(2)) : 0;
  const descontoVR = colab.recebeVR ? Number(((colab.valorVR || 25) * 0.1 * 15).toFixed(2)) : 0;
  const liquido = Number(Math.max(0, totalBruto - descontoINSS - descontoVT - descontoVR).toFixed(2));

  const now = new Date();
  const dataEmissao = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(now);

  return {
    id: `hol-${competencia}-${colab.id}-${Date.now().toString(36)}`,
    empresaId: 'emp-matriz-principal',
    colaboradorId: colab.id,
    colaboradorNome: colab.nome,
    matricula: colab.matricula,
    funcao: colab.funcao,
    postoNome: colab.postoNome || 'Matriz',
    mesReferencia: mesReferenciaLabel,
    competencia,
    salarioBase,
    adicionalPericulosidade: periculosidade,
    adicionalNoturno,
    horasExtras50: 0,
    valorHorasExtras: valorFT,
    plantoesFT,
    valorFT,
    descontoINSS,
    descontoFGTS,
    descontoVT,
    descontoVR,
    bonusAssiduidade: colab.valorBonus || 0,
    bonusAtivo,
    liquidoReceber: liquido,
    statusEnvio: statusPublicacao === 'publicado' ? 'Aguardando Assinatura' : 'Pendente',
    dataEmissao,
    loteId,
    versao: 1,
    statusPublicacao,
    agendadoPara: agendadoParaIso,
    publicadoEm: statusPublicacao === 'publicado' ? now.toISOString() : undefined,
  };
}

export async function emitirLoteHolerites(params: {
  empresa: EmpresaInfo;
  colaboradores: Colaborador[];
  competencia: string;      // YYYY-MM
  mesReferenciaLabel: string; // Ex: Abril/2026
  modo: 'rascunho' | 'agendar' | 'publicar_agora';
  agendadoLocalSaoPaulo?: string; // YYYY-MM-DDTHH:mm
  criadoPorNome: string;
}): Promise<{
  success: boolean;
  lote?: HoleriteLote;
  holerites: HoleriteRegistro[];
  message: string;
}> {
  if (params.colaboradores.length === 0) {
    return { success: false, holerites: [], message: 'Selecione ao menos um colaborador para gerar o lote.' };
  }

  let agendadoIso: string | undefined;
  if (params.modo === 'agendar') {
    if (!params.agendadoLocalSaoPaulo) {
      return { success: false, holerites: [], message: 'Informe data e horário no fuso de Brasília (America/Sao_Paulo).' };
    }
    agendadoIso = saoPauloLocalInputToIsoUtc(params.agendadoLocalSaoPaulo);
  }

  const empresaId = params.empresa.id || 'emp-matriz-principal';
  const loteId = `lote-${params.competencia}-${Date.now().toString(36)}`;
  const statusLote: HoleriteLote['status'] =
    params.modo === 'publicar_agora' ? 'publicado' : params.modo === 'agendar' ? 'agendado' : 'rascunho';
  const statusItem: StatusPublicacaoHolerite =
    params.modo === 'publicar_agora' ? 'publicado' : params.modo === 'agendar' ? 'agendado' : 'rascunho';

  const nowIso = new Date().toISOString();
  const itens: HoleriteRegistro[] = [];
  let errorCount = 0;
  let lastErr: string | undefined;

  const supabase = getSupabase();
  let uid: string | null = null;
  if (supabase) {
    const { data: uRes } = await supabase.auth.getUser();
    uid = uRes?.user?.id || null;

    const { error: loteErr } = await supabase.from('holerite_lotes').insert({
      id: loteId,
      empresa_id: empresaId,
      competencia: params.competencia,
      competencia_label: params.mesReferenciaLabel,
      titulo: `Folha ${params.mesReferenciaLabel} (${params.colaboradores.length} colaboradores)`,
      status: statusLote,
      agendado_para: agendadoIso || null,
      publicado_em: statusLote === 'publicado' ? nowIso : null,
      total_itens: params.colaboradores.length,
      total_erros: 0,
      criado_por: uid,
      criado_por_nome: params.criadoPorNome,
    });
    if (loteErr) {
      return { success: false, holerites: [], message: `Falha ao criar lote: ${loteErr.message}` };
    }
  }

  for (const colab of params.colaboradores) {
    const hol = buildHoleriteFromColaborador(
      colab,
      params.competencia,
      params.mesReferenciaLabel,
      loteId,
      statusItem,
      agendadoIso
    );
    hol.empresaId = empresaId;

    try {
      const pdfRes = await generateHoleritePdfBytes(hol, colab, params.empresa);
      hol.pdfSha256 = pdfRes.sha256;
      const storagePath = `${empresaId}/${colab.id}/${hol.id}.pdf`;
      hol.storagePath = storagePath;

      if (supabase) {
        const { error: upErr } = await supabase.storage
          .from(HOLERITES_BUCKET)
          .upload(storagePath, pdfRes.bytes, { contentType: 'application/pdf', upsert: true });

        if (upErr) {
          // Storage opcional em ambiente sem bucket criado — registra erro apenas se DB falhar
          console.warn('Upload PDF Storage aviso:', upErr.message);
        }

        const { error: holErr } = await supabase.from('holerites').insert({
          id: hol.id,
          empresa_id: empresaId,
          colaborador_id: hol.colaboradorId,
          colaborador_nome: hol.colaboradorNome,
          matricula: hol.matricula,
          funcao: hol.funcao,
          posto_nome: hol.postoNome,
          mes_referencia: hol.mesReferencia,
          competencia: hol.competencia,
          salario_base: hol.salarioBase,
          adicional_periculosidade: hol.adicionalPericulosidade,
          adicional_noturno: hol.adicionalNoturno,
          horas_extras_50: hol.horasExtras50,
          valor_horas_extras: hol.valorHorasExtras,
          plantoes_ft: hol.plantoesFT || 0,
          valor_ft: hol.valorFT || 0,
          desconto_inss: hol.descontoINSS,
          desconto_fgts: hol.descontoFGTS,
          desconto_vt: hol.descontoVT,
          desconto_vr: hol.descontoVR,
          bonus_assiduidade: hol.bonusAssiduidade || 0,
          bonus_ativo: hol.bonusAtivo !== false,
          liquido_receber: hol.liquidoReceber,
          salario_liquido: hol.liquidoReceber,
          status_envio: hol.statusEnvio,
          data_emissao: hol.dataEmissao,
          lote_id: loteId,
          versao: 1,
          status_publicacao: statusItem,
          agendado_para: agendadoIso || null,
          publicado_em: statusItem === 'publicado' ? nowIso : null,
          storage_bucket: HOLERITES_BUCKET,
          storage_path: storagePath,
          pdf_sha256: hol.pdfSha256,
        });

        if (holErr) throw new Error(holErr.message);

        await supabase.from('holerite_eventos').insert({
          empresa_id: empresaId,
          holerite_id: hol.id,
          lote_id: loteId,
          acao: statusItem === 'publicado' ? 'publicado' : statusItem === 'agendado' ? 'agendado' : 'rascunho_criado',
          ator_id: uid,
          ator_nome: params.criadoPorNome,
          detalhes: `Holerite ${hol.mesReferencia} v1 (${statusItem}) · SHA256 ${hol.pdfSha256.slice(0, 12)}.`,
        });

        if (statusItem === 'publicado') {
          await supabase.from('notificacoes_sistema').insert({
            empresa_id: empresaId,
            destinatario_colaborador_id: colab.id,
            categoria: 'holerite',
            titulo: `Holerite ${hol.mesReferencia} disponível`,
            mensagem: `Seu demonstrativo de pagamento (${hol.mesReferencia}) foi publicado. Confirme recebimento na aba Documentos.`,
            referencia_tipo: 'holerite',
            referencia_id: hol.id,
            link_destino: 'documentos',
          });
        }
      }
    } catch (err) {
      errorCount++;
      lastErr = err instanceof Error ? err.message : 'Erro ao emitir item';
      hol.statusPublicacao = 'erro';
      hol.ultimoErro = lastErr;
    }

    itens.push(hol);
  }

  if (supabase && errorCount > 0) {
    await supabase
      .from('holerite_lotes')
      .update({ status: 'erro', total_erros: errorCount, ultimo_erro: lastErr || 'Erro parcial no lote' })
      .eq('id', loteId);
  }

  const lote: HoleriteLote = {
    id: loteId,
    empresaId,
    competencia: params.competencia,
    competenciaLabel: params.mesReferenciaLabel,
    titulo: `Folha ${params.mesReferenciaLabel} (${params.colaboradores.length} colaboradores)`,
    status: errorCount > 0 ? 'erro' : statusLote,
    agendadoPara: agendadoIso || null,
    publicadoEm: statusLote === 'publicado' && errorCount === 0 ? nowIso : null,
    totalItens: params.colaboradores.length,
    totalErros: errorCount,
    ultimoErro: lastErr || null,
    tentativas: 1,
    criadoPorNome: params.criadoPorNome,
    criadoEm: nowIso,
  };

  return {
    success: errorCount === 0,
    lote,
    holerites: itens,
    message:
      errorCount > 0
        ? `Lote concluído com ${errorCount} erro(s): ${lastErr}`
        : statusLote === 'publicado'
        ? `${itens.length} holerite(s) publicados e notificados aos colaboradores.`
        : statusLote === 'agendado'
        ? `${itens.length} holerite(s) agendados para publicação automática em Brasília.`
        : `${itens.length} rascunho(s) de holerite salvos.`,
  };
}

export async function publicarLoteAgora(
  lote: HoleriteLote,
  itensLote: HoleriteRegistro[],
  atorNome: string
): Promise<{ success: boolean; message: string }> {
  const supabase = getSupabase();
  const nowIso = new Date().toISOString();

  if (supabase) {
    const { data: uRes } = await supabase.auth.getUser();
    const uid = uRes?.user?.id || null;

    const { error: upHolErr } = await supabase
      .from('holerites')
      .update({
        status_publicacao: 'publicado',
        publicado_em: nowIso,
        status_envio: 'Aguardando Assinatura',
        ultimo_erro: null,
      })
      .eq('lote_id', lote.id)
      .in('status_publicacao', ['rascunho', 'agendado', 'erro']);

    if (upHolErr) return { success: false, message: upHolErr.message };

    await supabase
      .from('holerite_lotes')
      .update({ status: 'publicado', publicado_em: nowIso, total_erros: 0, ultimo_erro: null })
      .eq('id', lote.id);

    for (const h of itensLote) {
      await supabase.from('notificacoes_sistema').insert({
        empresa_id: lote.empresaId,
        destinatario_colaborador_id: h.colaboradorId,
        categoria: 'holerite',
        titulo: `Holerite ${h.mesReferencia} disponível`,
        mensagem: `Seu holerite de ${h.mesReferencia} foi publicado para consulta e ciência.`,
        referencia_tipo: 'holerite',
        referencia_id: h.id,
        link_destino: 'documentos',
      });
    }

    await supabase.from('holerite_eventos').insert({
      empresa_id: lote.empresaId,
      lote_id: lote.id,
      acao: 'publicado',
      ator_id: uid,
      ator_nome: atorNome,
      detalhes: `Lote ${lote.competenciaLabel} publicado manualmente pelo RH.`,
    });
  }

  return { success: true, message: `Lote "${lote.competenciaLabel}" publicado com sucesso.` };
}

export async function retificarHolerite(params: {
  original: HoleriteRegistro;
  colaborador: Colaborador;
  empresa: EmpresaInfo;
  motivo: string;
  novoSalarioBase?: number;
  novoValorExtras?: number;
  novoDescontoINSS?: number;
  atorNome: string;
}): Promise<{ success: boolean; novoHolerite?: HoleriteRegistro; message: string }> {
  if (!params.motivo.trim()) {
    return { success: false, message: 'Informe o motivo da retificação.' };
  }

  const novaVersao = (params.original.versao || 1) + 1;
  const salarioBase = params.novoSalarioBase ?? params.original.salarioBase;
  const valorExtras = params.novoValorExtras ?? params.original.valorHorasExtras;
  const descontoINSS = params.novoDescontoINSS ?? params.original.descontoINSS;
  const totalBruto =
    salarioBase +
    params.original.adicionalPericulosidade +
    params.original.adicionalNoturno +
    valorExtras +
    (params.original.bonusAtivo !== false ? params.original.bonusAssiduidade || 0 : 0);
  const totalDesc = descontoINSS + params.original.descontoVT + params.original.descontoVR;
  const liquido = Number(Math.max(0, totalBruto - totalDesc).toFixed(2));
  const nowIso = new Date().toISOString();

  const novo: HoleriteRegistro = {
    ...params.original,
    id: `hol-ret-${params.original.colaboradorId}-v${novaVersao}-${Date.now().toString(36)}`,
    salarioBase,
    valorHorasExtras: valorExtras,
    valorFT: valorExtras,
    descontoINSS,
    liquidoReceber: liquido,
    versao: novaVersao,
    retificadoDeId: params.original.id,
    motivoRetificacao: params.motivo.trim(),
    statusPublicacao: 'publicado',
    publicadoEm: nowIso,
    statusEnvio: 'Aguardando Assinatura',
    cienciaConfirmadaEm: undefined,
    cienciaUsuarioId: undefined,
    cienciaDeclaracaoVersao: undefined,
  };

  const pdfRes = await generateHoleritePdfBytes(novo, params.colaborador, params.empresa);
  novo.pdfSha256 = pdfRes.sha256;
  novo.storagePath = `${params.empresa.id || 'emp-matriz-principal'}/${params.colaborador.id}/${novo.id}.pdf`;

  const supabase = getSupabase();
  if (supabase) {
    const { data: uRes } = await supabase.auth.getUser();
    const uid = uRes?.user?.id || null;

    // Marca versão anterior como 'retificado' preservando histórico completo
    await supabase
      .from('holerites')
      .update({ status_publicacao: 'retificado' })
      .eq('id', params.original.id);

    await supabase.storage
      .from(HOLERITES_BUCKET)
      .upload(novo.storagePath, pdfRes.bytes, { contentType: 'application/pdf', upsert: true });

    const { error } = await supabase.from('holerites').insert({
      id: novo.id,
      empresa_id: params.original.empresaId || 'emp-matriz-principal',
      colaborador_id: novo.colaboradorId,
      colaborador_nome: novo.colaboradorNome,
      matricula: novo.matricula,
      funcao: novo.funcao,
      posto_nome: novo.postoNome,
      mes_referencia: novo.mesReferencia,
      competencia: novo.competencia || null,
      salario_base: novo.salarioBase,
      adicional_periculosidade: novo.adicionalPericulosidade,
      adicional_noturno: novo.adicionalNoturno,
      horas_extras_50: novo.horasExtras50,
      valor_horas_extras: novo.valorHorasExtras,
      plantoes_ft: novo.plantoesFT || 0,
      valor_ft: novo.valorFT || 0,
      desconto_inss: novo.descontoINSS,
      desconto_fgts: novo.descontoFGTS,
      desconto_vt: novo.descontoVT,
      desconto_vr: novo.descontoVR,
      bonus_assiduidade: novo.bonusAssiduidade || 0,
      bonus_ativo: novo.bonusAtivo !== false,
      liquido_receber: novo.liquidoReceber,
      salario_liquido: novo.liquidoReceber,
      status_envio: 'Aguardando Assinatura',
      data_emissao: novo.dataEmissao,
      lote_id: novo.loteId || null,
      versao: novaVersao,
      status_publicacao: 'publicado',
      publicado_em: nowIso,
      storage_bucket: HOLERITES_BUCKET,
      storage_path: novo.storagePath,
      pdf_sha256: novo.pdfSha256,
      retificado_de_id: params.original.id,
      motivo_retificacao: novo.motivoRetificacao,
    });

    if (error) return { success: false, message: `Erro ao gravar retificação: ${error.message}` };

    await supabase.from('holerite_eventos').insert({
      empresa_id: params.original.empresaId || 'emp-matriz-principal',
      holerite_id: novo.id,
      lote_id: novo.loteId || null,
      acao: 'retificado',
      ator_id: uid,
      ator_nome: params.atorNome,
      detalhes: `Versão v${novaVersao} emitida retificando ${params.original.id}: ${params.motivo}`,
    });

    await supabase.from('notificacoes_sistema').insert({
      empresa_id: params.original.empresaId || 'emp-matriz-principal',
      destinatario_colaborador_id: novo.colaboradorId,
      categoria: 'holerite',
      titulo: `Holerite ${novo.mesReferencia} retificado (v${novaVersao})`,
      mensagem: `Motivo: ${novo.motivoRetificacao}. Nova ciência de recebimento necessária.`,
      referencia_tipo: 'holerite',
      referencia_id: novo.id,
      link_destino: 'documentos',
    });
  }

  return {
    success: true,
    novoHolerite: novo,
    message: `Holerite retificado (v${novaVersao}) publicado preservando o histórico da versão anterior.`,
  };
}

export async function confirmarCienciaHolerite(
  holerite: HoleriteRegistro,
  pdfSha256?: string
): Promise<{ success: boolean; confirmadoEm?: string; message: string }> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      success: false,
      message: 'Autenticação Supabase necessária para gravar confirmação de ciência no servidor.',
    };
  }

  const { data, error } = await supabase.rpc('confirmar_ciencia_holerite', {
    p_holerite_id: holerite.id,
    p_pdf_sha256: pdfSha256 || holerite.pdfSha256 || null,
    p_declaracao_versao: CIENCIA_DECLARACAO_VERSAO,
  });

  if (error) {
    return { success: false, message: `Erro ao confirmar recebimento: ${error.message}` };
  }

  const res = (data || {}) as Record<string, unknown>;
  return {
    success: true,
    confirmadoEm: res.ciencia_confirmada_em ? String(res.ciencia_confirmada_em) : new Date().toISOString(),
    message: 'Recebimento e ciência registrados com sucesso.',
  };
}
