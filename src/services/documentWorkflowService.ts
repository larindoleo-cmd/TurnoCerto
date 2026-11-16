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
  SolicitacaoColaboradorRH,
  TipoSolicitacaoColaboradorRH,
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
    const { data, error } = await supabase.rpc('criar_solicitacao_documento_rh_transacional', {
      p_colaborador_id: sol.colaboradorId,
      p_tipo_documento: sol.tipoDocumento,
      p_titulo: sol.titulo,
      p_instrucoes: sol.instrucoes || null,
      p_prazo_entrega: sol.prazoEntrega || null,
      p_obrigatorio: sol.obrigatorio,
    });
    if (error) return { success: false, message: `Erro ao solicitar documento: ${error.message}` };
    if (data && typeof data === 'object' && 'solicitacao_id' in data) {
      sol.id = String((data as Record<string, unknown>).solicitacao_id);
    }
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
  const idempotencyKey = `doc-idem-${params.empresaId}-${params.colaboradorId}-${sha256.slice(0, 24)}-${
    params.solicitacaoId || safeName.slice(0, 16)
  }-v${novaVersao}`;

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
    const { error: upErr } = await supabase.storage
      .from(DOCUMENTOS_BUCKET)
      .upload(storagePath, bytes, {
        contentType: validation.detectedMime,
        upsert: false,
      });

    if (upErr) {
      return { success: false, message: `Falha ao enviar arquivo ao Storage seguro: ${upErr.message}` };
    }

    const { data: rpcData, error: rpcErr } = await supabase.rpc('registrar_documento_colaborador_transacional', {
      p_colaborador_id: doc.colaboradorId,
      p_titulo: doc.titulo,
      p_tipo: doc.tipo,
      p_storage_bucket: DOCUMENTOS_BUCKET,
      p_storage_path: storagePath,
      p_mime_type: doc.mimeType,
      p_file_size_bytes: doc.fileSizeBytes,
      p_sha256: doc.sha256,
      p_solicitacao_id: doc.solicitacaoId || null,
      p_idempotency_key: idempotencyKey,
      p_documento_anterior_id: doc.documentoAnteriorId || null,
      p_versao_anterior: params.versaoAtual || 0,
    });

    if (rpcErr) {
      // Limpa arquivo recém-enviado no Storage para não deixar órfão privado sem metadado
      await supabase.storage.from(DOCUMENTOS_BUCKET).remove([storagePath]).catch(() => undefined);
      return { success: false, message: `Falha ao registrar documento no banco: ${rpcErr.message}` };
    }

    if (rpcData && typeof rpcData === 'object') {
      const resObj = rpcData as Record<string, unknown>;
      if (resObj.documento_id) doc.id = String(resObj.documento_id);
      if (resObj.versao !== undefined) doc.versao = Number(resObj.versao);
    }
  }

  return { success: true, documento: doc, message: 'Documento enviado com sucesso para conferência do RH.' };
}

export async function getDocumentoSignedUrl(
  documento: Pick<ColaboradorDocumento, 'id' | 'empresaId' | 'colaboradorId' | 'storageBucket' | 'storagePath'>,
  _atorNome?: string
): Promise<{ url: string | null; message?: string }> {
  if (!documento.storagePath) {
    return { url: null, message: 'Documento privado sem caminho autorizado no Storage.' };
  }
  const supabase = getSupabase();
  if (!supabase) return { url: null, message: 'Supabase indisponível.' };

  const bucket = documento.storageBucket || DOCUMENTOS_BUCKET;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(documento.storagePath, 120);
  if (error || !data?.signedUrl) {
    return { url: null, message: `Erro ao gerar URL assinada: ${error?.message || 'Desconhecido'}` };
  }

  await supabase.rpc('registrar_visualizacao_documento', { p_documento_id: documento.id });

  return { url: data.signedUrl };
}

export async function revisarDocumentoRH(params: {
  documento: ColaboradorDocumento;
  decisao: 'aprovar' | 'recusar' | 'solicitar_atualizacao';
  observacao?: string;
  revisorNome: string;
}): Promise<{ success: boolean; message: string }> {
  const supabase = getSupabase();
  const rpcDecisao =
    params.decisao === 'aprovar'
      ? 'aprovado'
      : params.decisao === 'recusar'
      ? 'recusado'
      : 'atualizacao_solicitada';

  if (supabase) {
    const { error } = await supabase.rpc('revisar_documento_colaborador_transacional', {
      p_documento_id: params.documento.id,
      p_decisao: rpcDecisao,
      p_observacao: params.observacao || null,
    });

    if (error) return { success: false, message: `Falha ao revisar documento: ${error.message}` };
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

export function mapSolicitacaoColaboradorRH(r: Record<string, unknown>): SolicitacaoColaboradorRH {
  return {
    id: String(r.id),
    empresaId: String(r.empresa_id || 'emp-matriz-principal'),
    protocolo: String(r.protocolo || ''),
    colaboradorId: String(r.colaborador_id),
    colaboradorNome: String(r.colaborador_nome || ''),
    tipo: (r.tipo as TipoSolicitacaoColaboradorRH) || 'Outro',
    assunto: String(r.assunto || ''),
    descricao: String(r.descricao || ''),
    status: (r.status as SolicitacaoColaboradorRH['status']) || 'aberta',
    responsavelRhNome: r.responsavel_rh_nome ? String(r.responsavel_rh_nome) : undefined,
    respostaRh: r.resposta_rh ? String(r.resposta_rh) : undefined,
    respondidaEm: r.respondida_em ? String(r.respondida_em) : undefined,
    createdAt: String(r.created_at || new Date().toISOString()),
    updatedAt: r.updated_at ? String(r.updated_at) : undefined,
  };
}

export async function fetchSolicitacoesColaboradorRH(colaboradorId?: string): Promise<SolicitacaoColaboradorRH[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  let q = supabase.from('solicitacoes_colaborador_rh').select('*').order('created_at', { ascending: false });
  if (colaboradorId) q = q.eq('colaborador_id', colaboradorId);
  const { data, error } = await q.limit(100);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapSolicitacaoColaboradorRH);
}

export async function criarSolicitacaoColaboradorRH(params: {
  empresaId: string;
  colaboradorId: string;
  colaboradorNome: string;
  tipo: TipoSolicitacaoColaboradorRH;
  assunto: string;
  descricao: string;
}): Promise<{ success: boolean; solicitacao?: SolicitacaoColaboradorRH; message: string }> {
  const supabase = getSupabase();
  const nowIso = new Date().toISOString();
  const idempotencyKey = `pedrh-${params.colaboradorId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const localItem: SolicitacaoColaboradorRH = {
    id: idempotencyKey,
    empresaId: params.empresaId || 'emp-matriz-principal',
    protocolo: `RH-${nowIso.slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    colaboradorId: params.colaboradorId,
    colaboradorNome: params.colaboradorNome,
    tipo: params.tipo,
    assunto: params.assunto,
    descricao: params.descricao,
    status: 'aberta',
    createdAt: nowIso,
  };

  if (supabase) {
    const { data, error } = await supabase.rpc('criar_solicitacao_colaborador_rh', {
      p_colaborador_id: params.colaboradorId,
      p_tipo: params.tipo,
      p_assunto: params.assunto,
      p_descricao: params.descricao,
      p_idempotency_key: idempotencyKey,
    });
    if (error) {
      return { success: false, message: `Erro ao registrar solicitação ao RH: ${error.message}` };
    }
    if (data && typeof data === 'object') {
      const resObj = data as Record<string, unknown>;
      if (resObj.id) localItem.id = String(resObj.id);
      if (resObj.protocolo) localItem.protocolo = String(resObj.protocolo);
    }
  }

  return {
    success: true,
    solicitacao: localItem,
    message: `Solicitação registrada (${localItem.protocolo}) e enviada à fila do RH.`,
  };
}

export async function responderSolicitacaoColaboradorRH(params: {
  solicitacaoId: string;
  status: 'em_analise' | 'aguardando_colaborador' | 'concluida' | 'recusada';
  respostaRh: string;
}): Promise<{ success: boolean; message: string }> {
  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase.rpc('responder_solicitacao_colaborador_rh', {
      p_solicitacao_id: params.solicitacaoId,
      p_status: params.status,
      p_resposta_rh: params.respostaRh,
    });
    if (error) {
      return { success: false, message: `Falha ao responder solicitação: ${error.message}` };
    }
  }
  return { success: true, message: 'Resposta registrada e colaborador notificado.' };
}

