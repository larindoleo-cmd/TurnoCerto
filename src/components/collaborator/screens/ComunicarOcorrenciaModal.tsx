import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  Camera,
  Send,
  CheckCircle2,
  Building,
  MapPin,
  Clock,
  RotateCw,
  AlertCircle,
  FileText,
  ShieldAlert,
} from 'lucide-react';
import { Colaborador, CondominioPosto } from '../../../types';
import { getSupabase } from '../../../lib/supabase';
import { useApp } from '../../../context/AppContext';

interface ComunicarOcorrenciaModalProps {
  isOpen: boolean;
  colaborador: Colaborador;
  posto: CondominioPosto;
  onClose: () => void;
  onSuccess: (protocolo: string) => void;
}

export const ComunicarOcorrenciaModal: React.FC<ComunicarOcorrenciaModalProps> = ({
  isOpen,
  colaborador,
  posto,
  onClose,
  onSuccess,
}) => {
  const { criarOcorrencia, showToast } = useApp();
  const [categoria, setCategoria] = useState<string>('Problema no Posto');
  const [urgencia, setUrgencia] = useState<'baixa' | 'media' | 'alta'>('media');
  const [descricao, setDescricao] = useState('');
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [protocoloGerado, setProtocoloGerado] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrorMessage('A imagem deve ter no máximo 5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFotoPreview(reader.result as string);
        setErrorMessage(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao.trim()) {
      setErrorMessage('Por favor, descreva a ocorrência detalhadamente.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const now = new Date();
    const cleanDate = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const proto = `OCO-${cleanDate}-${randomSuffix}`;
    const dataHoraFmt = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(now);

    try {
      // 1. Salva no banco de dados Supabase
      const client = getSupabase();
      if (client) {
        const { error: insErr } = await client.from('ocorrencias').insert({
          id: `ocorr-${Date.now()}-${randomSuffix}`,
          posto_id: posto.id,
          posto_nome: posto.nome,
          tipo: categoria,
          descricao: `[Protocolo: ${proto}] ${descricao.trim()}`,
          registrado_por: `${colaborador.nome} (${colaborador.funcao || 'Colaborador'})`,
          data_hora: dataHoraFmt,
          urgencia,
          resolvida: false,
        });

        if (insErr) {
          console.warn('Aviso ao registrar ocorrência no Supabase:', insErr.message);
        }

        // Gera alerta para o painel de supervisão
        await client.from('alertas').insert({
          id: `alerta-${Date.now()}-${randomSuffix}`,
          tipo: 'posto_descoberto',
          gravidade: urgencia === 'alta' ? 'critica' : 'moderada',
          titulo: `Nova Ocorrência: ${categoria}`,
          descricao: `Protocolo ${proto} por ${colaborador.nome} no ${posto.nome}: ${descricao.slice(0, 100)}...`,
          posto_id: posto.id,
          posto_nome: posto.nome,
          colaborador_id: colaborador.id,
          colaborador_nome: colaborador.nome,
          horario: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          resolvido: false,
        });
      }

      // 2. Notifica no estado da aplicação
      await criarOcorrencia({
        postoId: posto.id,
        tipo: 'Posto Descoberto',
        descricao: `[${categoria}] Protocolo ${proto} por ${colaborador.nome}: ${descricao}`,
        urgencia,
      });

      setProtocoloGerado(proto);
      setIsSubmitting(false);
      onSuccess(proto);
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(
        'Não foi possível registrar a ocorrência no momento. Verifique sua conexão com a internet.'
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-3xl bg-[#091029] border border-blue-500/35 p-5 shadow-2xl text-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Comunicar Ocorrência</h3>
              <p className="text-[10px] text-slate-400">Canal direto com a supervisão operacional</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {protocoloGerado ? (
          <div className="text-center py-4 space-y-3 animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-base font-bold text-white">Ocorrência Registrada com Sucesso!</h4>
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs text-left space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Protocolo Oficial:</span>
                <strong className="text-blue-400">{protocoloGerado}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Data e Hora:</span>
                <span className="text-slate-200">
                  {new Intl.DateTimeFormat('pt-BR', {
                    timeZone: 'America/Sao_Paulo',
                    dateStyle: 'short',
                    timeStyle: 'medium',
                  }).format(new Date())}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Local:</span>
                <span className="text-slate-200 truncate max-w-[180px]">{posto.nome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Situação:</span>
                <span className="text-emerald-400 font-bold">Recebida · Em Análise RH</span>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-snug">
              Os supervisores autorizados da unidade foram notificados. Guarde seu protocolo para acompanhamento.
            </p>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs cursor-pointer shadow-md shadow-blue-600/30 transition-all"
            >
              Concluir
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 text-xs">
            {/* Posto e Condomínio pré-preenchidos */}
            <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 space-y-1 text-slate-400 text-[11px]">
              <div className="flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="text-slate-200 font-semibold truncate">{posto.nome}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="truncate">{colaborador.postoNome || 'Portaria Principal'}</span>
              </div>
            </div>

            {/* Categoria */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Categoria da Ocorrência *
              </label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="Problema no Posto">Problema no Posto</option>
                <option value="Equipamento Danificado">Equipamento Danificado (Portão, Câmera, Rádio)</option>
                <option value="Problema de Segurança">Problema de Segurança / Invasão / Alerta</option>
                <option value="Ausência de Colega">Ausência de Colega / Atraso de Rendição</option>
                <option value="Problema de Acesso">Problema de Acesso / Sistema / Leitor Facial</option>
                <option value="Problema Estrutural">Problema Estrutural / Hidráulico / Elétrico</option>
                <option value="Divergência de Ponto">Divergência de Ponto ou Horário</option>
                <option value="Outras Ocorrências">Outras Ocorrências Operacionais</option>
              </select>
            </div>

            {/* Urgência */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Grau de Urgência
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['baixa', 'media', 'alta'] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUrgencia(u)}
                    className={`py-1.5 rounded-xl text-xs font-bold capitalize border transition-all cursor-pointer ${
                      urgencia === u
                        ? u === 'alta'
                          ? 'bg-red-600/30 border-red-500 text-red-300'
                          : u === 'media'
                          ? 'bg-amber-600/30 border-amber-500 text-amber-300'
                          : 'bg-blue-600/30 border-blue-500 text-blue-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            {/* Descrição */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Descrição Detalhada do Fato *
              </label>
              <textarea
                required
                rows={3}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descreva o que ocorreu, horário aproximado e pessoas envolvidas..."
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            {/* Anexar Foto Opcional */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Fotografia como Evidência (Opcional)
              </label>
              {fotoPreview ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-700">
                  <img src={fotoPreview} alt="Anexo" className="w-full h-28 object-cover" />
                  <button
                    type="button"
                    onClick={() => setFotoPreview(null)}
                    className="absolute top-1.5 right-1.5 p-1 rounded-full bg-red-600 text-white cursor-pointer shadow-md"
                    title="Remover foto"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <label className="w-full p-3 rounded-xl border border-dashed border-slate-700 hover:border-blue-500 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors text-slate-400 hover:text-white">
                  <Camera className="w-5 h-5 text-blue-400" />
                  <span className="text-[11px]">Toque para fotografar ou anexar imagem</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFotoChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {errorMessage && (
              <div className="p-2.5 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-start gap-1.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p>{errorMessage}</p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Transmitir</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
