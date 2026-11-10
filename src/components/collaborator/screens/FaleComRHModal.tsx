import React, { useState } from 'react';
import {
  X,
  PhoneCall,
  Mail,
  MessageSquare,
  Send,
  CheckCircle2,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { EmpresaInfo, Colaborador } from '../../../types';

interface FaleComRHModalProps {
  isOpen: boolean;
  empresa: EmpresaInfo;
  colaborador: Colaborador;
  onClose: () => void;
}

export const FaleComRHModal: React.FC<FaleComRHModalProps> = ({
  isOpen,
  empresa,
  colaborador,
  onClose,
}) => {
  const [assunto, setAssunto] = useState('Dúvida sobre Folha / Holerite');
  const [mensagem, setMensagem] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [protocolo, setProtocolo] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mensagem.trim()) return;

    const proto = `RH-${Date.now().toString().slice(-6)}`;
    setProtocolo(proto);
    setEnviado(true);
  };

  const whatsappClean = (empresa.whatsapp || '11988421190').replace(/\D/g, '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-3xl bg-[#091029] border border-blue-500/35 p-5 shadow-2xl text-slate-100 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <PhoneCall className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-bold text-white">Fale com o RH / Suporte</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {enviado ? (
          <div className="text-center py-6 space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-base font-bold text-white">Mensagem Enviada!</h4>
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs text-left space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Protocolo de Atendimento:</span>
                <strong className="text-blue-400">{protocolo}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Prazo de Resposta:</span>
                <span className="text-emerald-400 font-bold">Até 24h úteis</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
            >
              Fechar
            </button>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            {/* Canais Diretos Cadastrados da Empresa */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block px-1">
                Canais de Atendimento Oficial
              </span>

              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`https://wa.me/55${whatsappClean}?text=Olá,%20sou%20o%20colaborador%20${encodeURIComponent(
                    colaborador.nome
                  )}%20(Matrícula%20${colaborador.matricula})%20e%20preciso%20de%20ajuda%20do%20RH.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/40 flex items-center justify-between text-emerald-300 transition-colors"
                >
                  <div className="flex items-center gap-2 truncate">
                    <MessageSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="font-bold truncate text-[11px]">WhatsApp RH</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </a>

                <a
                  href={`tel:${(empresa.telefone || '1132214000').replace(/\D/g, '')}`}
                  className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 flex items-center gap-2 text-slate-200 transition-colors truncate"
                >
                  <PhoneCall className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="font-bold truncate text-[11px]">{empresa.telefone || '(11) 3221-4000'}</span>
                </a>
              </div>
            </div>

            {/* Formulário de Envio de Mensagem */}
            <form onSubmit={handleSubmit} className="space-y-3 pt-1 border-t border-slate-800">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Assunto da Solicitação
                </label>
                <select
                  value={assunto}
                  onChange={(e) => setAssunto(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-blue-500"
                >
                  <option value="Dúvida sobre Folha / Holerite">Dúvida sobre Holerite / Pagamento</option>
                  <option value="Atestado Médico / Afastamento">Envio / Informação de Atestado Médico</option>
                  <option value="Benefícios VT / VR">Dúvida sobre Vale Transporte ou Refeição</option>
                  <option value="Atualização Cadastral">Alteração de Endereço ou Documentos</option>
                  <option value="Outro">Outra Dúvida ou Solicitação</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Mensagem Detalhada
                </label>
                <textarea
                  required
                  rows={3}
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  placeholder="Escreva sua mensagem para o RH..."
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar Mensagem</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
