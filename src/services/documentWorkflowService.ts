/**
 * TurnoCerto - Serviço Bidirecional de Documentos (RH <-> Funcionário)
 * - Valida extensão, MIME type, magic bytes reais (%PDF, JPEG, PNG), tamanho <= 10MB e SHA-256.
 * - Armazena em bucket privado ('documentos-funcionarios') sob caminho empresaId/colaboradorId/arquivo.
 * - Gera URL assinada de curta duração (120s) para visualização/download seguro.
 * - Persiste solicitações, versões de envio, aprovações/recusas/solicitações de atualização e histórico.
 */

import {
  ColaboradorDocumento,
  DocumentoSolicitacao,
  DocumentoHistorico,
  StatusSolicitacaoDocumento,
} from '../types';
import { getSupabase } from '../lib/supabase';
import { computeSha256Hex } from './documentService';

export const DOCUMENTOS_BUCKET = 'documentos-funcionarios';
export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

export const ALLOWED_DOCUMENT_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png']);

export interface DocumentValidationResult {
  valid: boolean;
  reason?: string;
  extension?: string;
  detectedMime?: 'application/pdf' | 'image/jpeg' | 'image/png';
}

/**
 * Validação real por assinatura binária (magic bytes) + extensão + MIME + limite de tamanho.
 */
export function validateDocumentBytes(
  fileName: string,
  declaredMime: string,
  bytes: Uint8Array
): DocumentValidationResult {
  if (!bytes || bytes.byteLength === 0) {
    return { valid: false, reason: 'Arquivo vazio ou corrompido.' };
  }
  if (bytes.byteLength > MAX_DOCUMENT_SIZE_BYTES) {
    return { valid: false, reason: 'Arquivo excede o limite máximo de 10 MB.' };
  }

  const ext = (fileName.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_DOCUMENT_EXTENSIONS.has(ext)) {
    return { valid: false, reason: `Extensão .${ext || '?'} não permitida. Envie PDF, JPG ou PNG.` };
  }

  if (declaredMime && !ALLOWED_DOCUMENT_MIME_TYPES.has(declaredMime.toLowerCase())) {
    return { valid: false, reason: `Tipo MIME "${declaredMime}" não autorizado. Envie PDF, JPG ou PNG.` };
  }

  // Magic bytes check
  const isPdf =
    bytes.length >= 4 &&
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46;   // F

  const isJpeg =
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff;

  const isPng =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;

  if (ext === 'pdf' && !isPdf) {
    return { valid: false, reason: 'Conteúdo do arquivo não corresponde a um PDF válido (%PDF).' };
  }
  if ((ext === 'jpg' || ext === 'jpeg') && !isJpeg) {
    return { valid: false, reason: 'Conteúdo do arquivo não corresponde a uma imagem JPEG válida.' };
  }
  if (ext === 'png' && !isPng) {
    return { valid: false, reason: 'Conteúdo do arquivo não corresponde a uma imagem PNG válida.' };
  }
  if (!isPdf && !isJpeg && !isPng) {
    return { valid: false, reason: 'Assinatura de arquivo não reconhecida (aceito apenas PDF, JPG ou PNG).' };
  }

  const detectedMime = isPdf ? 'application/pdf' : isJpeg ? 'image/jpeg' : 'image/png';
  return { valid: true, extension: ext, detectedMime };
}

export async function validateDocumentFile(file: File): Promise<{
  validation: DocumentValidationResult;
  bytes?: Uint8Array;
  sha256?: string;
}> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const validation = validateDocumentBytes(file.name, file.type, bytes);
  if (!validation.valid) {
    return { validation };
  }
  const sha256 = await computeSha256Hex(bytes);
  return { validation, bytes, sha256 };
}

export function mapDocumentoSolicitacao(r: Record<string, unknown>): DocumentoSolicitacao {
  return {
    id: String(r.id),
    empresaId: String(r.empresa_id || 'emp-matriz-principal'),
    colaboradorId: String(r.colaborador_id),
    colaboradorNome: r.colaborador_nome ? String(r.colaborador_nome) : undefined,
    tipoDocumento: String(r.tipo_documento),
    titulo: String(r.titulo),
    instrucoes: r.instrucoes ? String(r.instrucoes) : undefined,
    prazoEntrega: r.prazo_entrega ? String(r.prazo_entrega) : undefined,
    obrigatorio: r.obrigatorio !== false,
    status: (r.status as StatusSolicitacaoDocumento) || 'pendente_envio',
    solicitadoPorNome: r.solicitado_por_nome ? String(r.solicitado_por_nome) : undefined,
    criadoEm: String(r.created_at || new Date().toISOString()),
    atualizadoEm: r.updated_at ? String(r.updated_at) : undefined,
  };
}

export function mapColaboradorDocumento(r: Record<string, unknown>): ColaboradorDocumento {
  return {
    id: String(r.id),
    empresaId: r.empresa_id ? String(r.empresa_id) : 'emp-matriz-principal',
    colaboradorId: String(r.colaborador_id),
    solicitacaoId: r.solicitacao_id ? String(r.solicitacao_id) : undefined,
    titulo: String(r.titulo),
    tipo: (r.tipo as ColaboradorDocumento['tipo']) || 'Outro',
    status: (r.status as ColaboradorDocumento['status']) || 'pendente',
    versao: r.versao !== undefined ? Number(r.versao) : 1,
    documentoAnteriorId: r.documento_anterior_id ? String(r.documento_anterior_id) : undefined,
    dataEmissao: r.data_emissao ? String(r.data_emissao) : undefined,
    dataValidade: r.data_validade ? String(r.data_validade) : undefined,
    arquivoUrl: r.arquivo_url ? String(r.arquivo_url) : undefined,
    storageBucket: r.storage_bucket ? String(r.storage_bucket) : DOCUMENTOS_BUCKET,
    storagePath: r.storage_path ? String(r.storage_path) : undefined,
    mimeType: r.mime_type ? String(r.mime_type) : undefined,
    fileSizeBytes: r.file_size_bytes !== undefined && r.file_size_bytes !== null ? Number(r.file_size_bytes) : undefined,
    sha256: r.sha256 ? String(r.sha256) : undefined,
    tamanhoKb: r.tamanho_kb !== undefined && r.tamanho_kb !== null ? Number(r.tamanho_kb) : undefined,
    revisadoPorNome: r.revisado_por_nome ? String(r.revisado_por_nome) : undefined,
    revisadoEm: r.revisado_em ? String(r.revisado_em) : undefined,
    observacaoRevisao: r.observacao_revisao ? String(r.observacao_revisao) : undefined,
  };
}

export async function fetchDocumentoSolicitacoes(colaboradorId?: string): Promise<DocumentoSolicitacao[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  let q = supabase.from('documento_solicitacoes').select('*').order('created_at', { ascending: false });
  if (colaboradorId) q = q.eq('colaborador_id', colaboradorId);
  const { data, error } = await q;
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapDocumentoSolicitacao);
}

export async function fetchColaboradorDocumentos(colaboradorId?: string): Promise<ColaboradorDocumento[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  let q = supabase.from('colaborador_documentos').select('*').order('created_at', { ascending: false });
  if (colaboradorId) q = q.eq('colaborador_id', colaboradorId);
  const { data, error } = await q;
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapColaboradorDocumento);
}

export async function fetchDocumentoHistorico(colaboradorId?: string): Promise<DocumentoHistorico[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  let q = supabase.from('documento_historico').select('*').order('created_at', { ascending: false });
  if (colaboradorId) q = q.eq('colaborador_id', colaboradorId);
  const { data, error } = await q.limit(100);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    solicitacaoId: r.solicitacao_id ? String(r.solicitacao_id) : undefined,
    documentoId: r.documento_id ? String(r.documento_id) : undefined,
    colaboradorId: String(r.colaborador_id),
    acao: r.acao as DocumentoHistorico['acao'],
    atorNome: r.ator_nome ? String(r.ator_nome) : undefined,
    detalhes: r.detalhes ? String(r.detalhes) : undefined,
    createdAt: String(r.created_at),
  }));
}

export async function criarSolicitacaoDocumentoRH(params: {
  empresaId: string;
  colaboradorId: string;
  colaboradorNome: string;
  tipoDocumento: string;
  titulo: string;
  instrucoes?: string;
  prazoEntrega?: string;
  obrigatorio?: boolean;
  solicitadoPorNome: string;
}): Promise<{ success: boolean; solicitacao?: DocumentoSolicitacao; message: string }> {
  const supabase = getSupabase();
  const id = `docreq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const nowIso = new Date().toISOString();

  const sol: DocumentoSolicitacao = {
    id,
    empresaId: params.empresaId || 'emp-matriz-principal',
    colaboradorId: params.colaboradorId,
    colaboradorNome: params.colaboradorNome,
    tipoDocumento: params.tipoDocumento,
    titulo: params.titulo,
    instrucoes: params.instrucoes,
    prazoEntrega: params.prazoEntrega,
    obrigatorio: params.obrigatorio !== false,
    status: 'pendente_envio',
    solicitadoPorNome: params.solicitadoPorNome,
    criadoEm: nowIso,
  };

  if (supabase) {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes?.user?.id || null;
    const { error } = await supabase.from('documento_solicitacoes').insert({
      id: sol.id,
      empresa_id: sol.empresaId,
      colaborador_id: sol.colaboradorId,
      colaborador_nome: sol.colaboradorNome,
      tipo_documento: sol.tipoDocumento,
      titulo: sol.titulo,
      instrucoes: sol.instrucoes || null,
      prazo_entrega: sol.prazoEntrega || null,
      obrigatorio: sol.obrigatorio,
      status: sol.status,
      solicitado_por: uid,
      solicitado_por_nome: sol.solicitadoPorNome,
    });
    if (error) return { success: false, message: `Erro ao solicitar documento: ${error.message}` };

    await supabase.from('documento_historico').insert({
      empresa_id: sol.empresaId,
      solicitacao_id: sol.id,
      colaborador_id: sol.colaboradorId,
      acao: 'solicitado',
      ator_id: uid,
      ator_nome: params.solicitadoPorNome,
      detalhes: `RH solicitou "${sol.titulo}"${sol.prazoEntrega ? ` (prazo: ${sol.prazoEntrega})` : ''}.`,
    });

    await supabase.from('notificacoes_sistema').insert({
      empresa_id: sol.empresaId,
      destinatario_colaborador_id: sol.colaboradorId,
      categoria: 'documento',
      titulo: `Documento solicitado pelo RH: ${sol.titulo}`,
      mensagem: sol.instrucoes || `Envie o arquivo em PDF, JPG ou PNG na aba Documentos.`,
      referencia_tipo: 'documento_solicitacao',
      referencia_id: sol.id,
      link_destino: 'documentos',
    });
  }

  return { success: true, solicitacao: sol, message: 'Solicitação de documento enviada ao colaborador.' };
}

export async function enviarDocumentoColaborador(params: {
  empresaId: string;
  colaboradorId: string;
  colaboradorNome: string;
  file: File;
  titulo: string;
  tipo: ColaboradorDocumento['tipo'];
  solicitacaoId?: string;
  documentoAnteriorId?: string;
  versaoAtual?: number;
}): Promise<{ success: boolean; documento?: ColaboradorDocumento; message: string }> {
  const { validation, bytes, sha256 } = await validateDocumentFile(params.file);
  if (!validation.valid || !bytes || !sha256) {
    return { success: false, message: validation.reason || 'Arquivo inválido.' };
  }

  const supabase = getSupabase();
  const docId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const novaVersao = (params.versaoAtual || 0) + 1;
  const safeName = params.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${params.empresaId}/${params.colaboradorId}/${docId}_v${novaVersao}_${safeName}`;
  const todayStr = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date());

  const doc: ColaboradorDocumento = {
    id: docId,
    empresaId: params.empresaId,
    colaboradorId: params.colaboradorId,
    solicitacaoId: params.solicitacaoId,
    titulo: params.titulo,
    tipo: params.tipo,
    status: 'pendente',
    versao: novaVersao,
    documentoAnteriorId: params.documentoAnteriorId,
    dataEmissao: todayStr,
    storageBucket: DOCUMENTOS_BUCKET,
    storagePath,
    mimeType: validation.detectedMime,
    fileSizeBytes: bytes.byteLength,
    sha256,
    tamanhoKb: Math.max(1, Math.round(bytes.byteLength / 1024)),
  };

  if (supabase) {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes?.user?.id || null;

    const { error: upErr } = await supabase.storage
      .from(DOCUMENTOS_BUCKET)
      .upload(storagePath, bytes, {
        contentType: validation.detectedMime,
        upsert: false,
      });

    if (upErr) {
      return { success: false, message: `Falha ao enviar arquivo ao Storage seguro: ${upErr.message}` };
    }

    const { error: dbErr } = await supabase.from('colaborador_documentos').insert({
      id: doc.id,
      empresa_id: doc.empresaId,
      colaborador_id: doc.colaboradorId,
      solicitacao_id: doc.solicitacaoId || null,
      titulo: doc.titulo,
      tipo: doc.tipo,
      status: 'pendente',
      versao: novaVersao,
      documento_anterior_id: doc.documentoAnteriorId || null,
      data_emissao: doc.dataEmissao,
      storage_bucket: DOCUMENTOS_BUCKET,
      storage_path: storagePath,
      mime_type: doc.mimeType,
      file_size_bytes: doc.fileSizeBytes,
      sha256: doc.sha256,
      tamanho_kb: doc.tamanhoKb,
      enviado_por: uid,
    });

    if (dbErr) {
      return { success: false, message: `Arquivo enviado, mas falha ao gravar metadados: ${dbErr.message}` };
    }

    if (params.solicitacaoId) {
      await supabase
        .from('documento_solicitacoes')
        .update({ status: 'enviado_analise', updated_at: new Date().toISOString() })
        .eq('id', params.solicitacaoId);
    }

    await supabase.from('documento_historico').insert({
      empresa_id: doc.empresaId,
      solicitacao_id: params.solicitacaoId || null,
      documento_id: doc.id,
      colaborador_id: doc.colaboradorId,
      acao: 'enviado',
      ator_id: uid,
      ator_nome: params.colaboradorNome,
      detalhes: `Arquivo ${params.file.name} (v${novaVersao}, ${doc.tamanhoKb} KB, SHA256 ${sha256.slice(0, 12)}) enviado para análise do RH.`,
    });

    await supabase.from('notificacoes_sistema').insert({
      empresa_id: doc.empresaId,
      destinatario_role: 'rh',
      categoria: 'documento',
      titulo: `Documento enviado: ${params.colaboradorNome}`,
      mensagem: `${doc.titulo} (v${novaVersao}) aguardando conferência do RH.`,
      referencia_tipo: 'colaborador_documento',
      referencia_id: doc.id,
      link_destino: 'rh',
    });
  }

  return { success: true, documento: doc, message: 'Documento enviado com sucesso para conferência do RH.' };
}

export async function getDocumentoSignedUrl(
  documento: Pick<ColaboradorDocumento, 'id' | 'empresaId' | 'colaboradorId' | 'storageBucket' | 'storagePath' | 'arquivoUrl'>,
  atorNome?: string
): Promise<{ url: string | null; message?: string }> {
  if (!documento.storagePath) {
    return { url: documento.arquivoUrl || null, message: documento.arquivoUrl ? undefined : 'Documento sem arquivo anexado no Storage.' };
  }
  const supabase = getSupabase();
  if (!supabase) return { url: null, message: 'Supabase indisponível.' };

  const bucket = documento.storageBucket || DOCUMENTOS_BUCKET;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(documento.storagePath, 120);
  if (error || !data?.signedUrl) {
    return { url: null, message: `Erro ao gerar URL assinada: ${error?.message || 'Desconhecido'}` };
  }

  const { data: userRes } = await supabase.auth.getUser();
  await supabase.from('documento_historico').insert({
    empresa_id: documento.empresaId || 'emp-matriz-principal',
    documento_id: documento.id,
    colaborador_id: documento.colaboradorId,
    acao: 'visualizado',
    ator_id: userRes?.user?.id || null,
    ator_nome: atorNome || 'Usuário',
    detalhes: 'URL assinada gerada (validade 120s).',
  });

  return { url: data.signedUrl };
}

export async function revisarDocumentoRH(params: {
  documento: ColaboradorDocumento;
  decisao: 'aprovar' | 'recusar' | 'solicitar_atualizacao';
  observacao?: string;
  revisorNome: string;
}): Promise<{ success: boolean; message: string }> {
  const supabase = getSupabase();
  const docStatus: ColaboradorDocumento['status'] =
    params.decisao === 'aprovar' ? 'valido' : params.decisao === 'recusar' ? 'recusado' : 'solicitado';
  const solStatus: StatusSolicitacaoDocumento =
    params.decisao === 'aprovar'
      ? 'aprovado'
      : params.decisao === 'recusar'
      ? 'recusado'
      : 'atualizacao_solicitada';
  const acaoHist: DocumentoHistorico['acao'] =
    params.decisao === 'aprovar'
      ? 'aprovado'
      : params.decisao === 'recusar'
      ? 'recusado'
      : 'atualizacao_solicitada';

  if (supabase) {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes?.user?.id || null;
    const nowIso = new Date().toISOString();

    const { error } = await supabase
      .from('colaborador_documentos')
      .update({
        status: docStatus,
        revisado_por: uid,
        revisado_por_nome: params.revisorNome,
        revisado_em: nowIso,
        observacao_revisao: params.observacao || null,
      })
      .eq('id', params.documento.id);

    if (error) return { success: false, message: `Falha ao atualizar documento: ${error.message}` };

    if (params.documento.solicitacaoId) {
      await supabase
        .from('documento_solicitacoes')
        .update({ status: solStatus, updated_at: nowIso })
        .eq('id', params.documento.solicitacaoId);
    }

    await supabase.from('documento_historico').insert({
      empresa_id: params.documento.empresaId || 'emp-matriz-principal',
      solicitacao_id: params.documento.solicitacaoId || null,
      documento_id: params.documento.id,
      colaborador_id: params.documento.colaboradorId,
      acao: acaoHist,
      ator_id: uid,
      ator_nome: params.revisorNome,
      detalhes: params.observacao || `Documento marcado como ${docStatus} pelo RH.`,
    });

    await supabase.from('notificacoes_sistema').insert({
      empresa_id: params.documento.empresaId || 'emp-matriz-principal',
      destinatario_colaborador_id: params.documento.colaboradorId,
      categoria: 'documento',
      titulo:
        params.decisao === 'aprovar'
          ? `Documento aprovado: ${params.documento.titulo}`
          : params.decisao === 'recusar'
          ? `Documento recusado: ${params.documento.titulo}`
          : `Atualização solicitada: ${params.documento.titulo}`,
      mensagem: params.observacao || 'Acesse a aba Documentos para verificar a revisão do RH.',
      referencia_tipo: 'colaborador_documento',
      referencia_id: params.documento.id,
      link_destino: 'documentos',
    });
  }

  return {
    success: true,
    message:
      params.decisao === 'aprovar'
        ? 'Documento aprovado e validado no prontuário.'
        : params.decisao === 'recusar'
        ? 'Documento recusado e colaborador notificado.'
        : 'Solicitação de nova versão enviada ao colaborador.',
  };
}
