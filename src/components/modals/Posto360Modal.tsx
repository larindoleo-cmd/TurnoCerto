import React from 'react';
import {
  X,
  MapPin,
  FileText,
  Clock,
  Users,
  ShieldCheck,
  AlertTriangle,
  UserPlus,
  RefreshCw,
  CalendarDays,
  FileWarning,
  ExternalLink,
  Phone,
  CheckCircle2,
  XCircle,
  Pencil,
  Crosshair,
  Compass,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CondominioPosto } from '../../types';

interface Posto360ModalProps {
  posto: CondominioPosto;
  onClose: () => void;
}

export const Posto360Modal: React.FC<Posto360ModalProps> = ({ posto, onClose }) => {
  const {
    colaboradores,
    openSubstituicaoModal,
    openAlocarModal,
    openEscalaModal,
    openOcorrenciaModal,
    removerColaboradorDoPosto,
    openEditarCondominioModal,
    openEditarFuncionarioModal,
  } = useApp();

  // Find all team members belonging to this post
  const equipePosto = colaboradores.filter((c) => c.condominioId === posto.id);
  const operandoAgoraColabs = colaboradores.filter((c) =>
    posto.plantaoAtual.operandoAgora.includes(c.id)
  );
  const proximaRendicaoColab = colaboradores.find(
    (c) => c.id === posto.plantaoAtual.proximaRendicao.colaboradorId
  );

  const isOperacional = posto.status === 'operacional';
  const isCritico = posto.status === 'critico';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full sm:max-w-xl max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-[#0B132B] border border-slate-700/60 shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-250">
        {/* Modal Header */}
        <div className="relative px-5 py-4 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between shrink-0">
          {/* Mobile drag handle affordance */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 bg-slate-700 rounded-full sm:hidden" />

          <div className="min-w-0 pr-4 mt-2 sm:mt-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Painel 360° do Posto
              </span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                  isOperacional
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : isCritico
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}
              >
                {isOperacional ? 'Operacional' : isCritico ? 'Posto Crítico' : 'Atenção'}
              </span>
            </div>
            <h2 className="text-lg font-bold text-white truncate mt-1">{posto.nome}</h2>
            <p className="text-xs text-slate-400 flex items-center gap-1 truncate">
              <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              {posto.endereco}, {posto.bairro} · {posto.cidade}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                onClose();
                openEditarCondominioModal(posto);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition-colors"
              title="Editar dados cadastrais do condomínio"
            >
              <Pencil className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Editar Posto</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors shrink-0"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-5 no-scrollbar text-sm">
          {/* Alert Callout if Critical / Attention */}
          {!isOperacional && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/40 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-red-200 uppercase tracking-wider">
                    Pendência Operacional Ativa
                  </h4>
                  <p className="text-xs text-red-300/90 mt-0.5">
                    {posto.motivoAtencao || 'Este posto possui colaboradores faltantes ou vagas descobertas.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => openSubstituicaoModal(posto)}
                className="px-2.5 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg shadow-sm shrink-0 whitespace-nowrap active:scale-95"
              >
                Cobrir Agora
              </button>
            </div>
          )}

          {/* 1. Informações Completas do Contrato e Endereço */}
          <div className="rounded-xl p-4 bg-slate-900/50 border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                Contrato & Dados do Cliente
              </span>
              <span className="text-xs font-mono text-blue-400 font-semibold">{posto.contratoNumero}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Tipo de Imóvel</span>
                <span className="text-slate-200 font-medium">{posto.tipo}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">CNPJ do Contrato</span>
                <span className="text-slate-200 font-mono text-[11px]">{posto.cnpj}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Vagas Contratadas</span>
                <span className="text-slate-200 font-medium">{posto.vagasContratadas} postos fixos</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Escala Padrão</span>
                <span className="text-slate-200 font-medium">{posto.tipoEscalaPadrao}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/60 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-slate-400 block text-[11px]">Síndico / Responsável</span>
                  <span className="text-slate-200 font-medium">{posto.contatoSindico}</span>
                </div>
                <a
                  href={`tel:${posto.telefoneSindico.replace(/\D/g, '')}`}
                  className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 font-medium"
                >
                  <Phone className="w-3 h-3" />
                  {posto.telefoneSindico}
                </a>
              </div>
            </div>

            {posto.instrucoesGuarita && (
              <div className="p-2.5 rounded-lg bg-blue-950/20 border border-blue-900/30 text-[11px] text-slate-300">
                <strong className="text-blue-400 block mb-0.5">Procedimento Operacional da Guarita:</strong>
                {posto.instrucoesGuarita}
              </div>
            )}

            {/* Cartão de Calibração GPS & Geofence do Posto */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-blue-500/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                  <Compass className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-white">Geofence do Posto:</span>
                    <span className="text-[10px] font-mono font-bold text-emerald-400">
                      Raio ±{posto.raioGpsMetros || 150}m
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate font-mono">
                    {posto.latitude ? posto.latitude.toFixed(5) : '-23.55052'}, {posto.longitude ? posto.longitude.toFixed(5) : '-46.63330'}
                    {posto.metodoCalibracaoGps === 'no_local' && ' · 📡 No Local'}
                    {posto.metodoCalibracaoGps === 'cep_endereco' && ' · 📍 Via CEP/Endereço'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {posto.latitude && (
                  <a
                    href={`https://www.google.com/maps?q=${posto.latitude},${posto.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                    title="Ver no Google Maps"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    openEditarCondominioModal(posto);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/40 text-blue-300 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Crosshair className="w-3 h-3 text-blue-400" />
                  <span>Calibrar</span>
                </button>
              </div>
            </div>
          </div>

          {/* 2. Status do Plantão Atual (Quem está operando agora & Rendimento) */}
          <div className="rounded-xl p-4 bg-slate-900/50 border border-slate-800/80 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              Plantão em Tempo Real
            </span>

            {/* Operando agora */}
            <div>
              <span className="text-[11px] text-slate-400 block mb-1.5">
                Colaboradores em Posto Atualmente:
              </span>
              {operandoAgoraColabs.length === 0 ? (
                <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>Atenção: Nenhum colaborador com ponto registrado operando neste instante!</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {operandoAgoraColabs.map((colab) => (
                    <div
                      key={colab.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50 border border-slate-700/50"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={colab.foto}
                          alt={colab.nome}
                          className="w-8 h-8 rounded-full object-cover border border-emerald-500/50 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{colab.nome}</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {colab.funcao} · {colab.jornada}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 shrink-0 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        No Posto
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Próximo rendimento */}
            <div className="pt-2 border-t border-slate-800/60">
              <span className="text-[11px] text-slate-400 block mb-1">Próxima Rendição Programada:</span>
              {proximaRendicaoColab ? (
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/30 border border-slate-700/30 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={proximaRendicaoColab.foto}
                      alt={proximaRendicaoColab.nome}
                      className="w-7 h-7 rounded-full object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-slate-200 truncate">{proximaRendicaoColab.nome}</p>
                      <p className="text-[10px] text-slate-400">{proximaRendicaoColab.funcao}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[11px] font-mono font-semibold text-blue-400">
                      {posto.plantaoAtual.proximaRendicao.horarioTroca}
                    </span>
                    <span className="block text-[9px] text-slate-400">Horário de Troca</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">Sem rendição programada no sistema.</p>
              )}
            </div>
          </div>

          {/* 3. Equipe Completa Vinculada ao Posto */}
          <div className="rounded-xl p-4 bg-slate-900/50 border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-400" />
                Quadro de Funcionários Efetivos ({equipePosto.length})
              </span>
              <button
                onClick={() => openAlocarModal(posto)}
                className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <UserPlus className="w-3 h-3" />
                Adicionar
              </button>
            </div>

            {equipePosto.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">Nenhum colaborador vinculado a este posto.</p>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {equipePosto.map((colab) => {
                  const isNoPosto = colab.status === 'no_posto';
                  const isFolga = colab.status === 'folga';
                  const isFalta = colab.status === 'falta';
                  const isAfastado = colab.status === 'afastado';

                  return (
                    <div key={colab.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={colab.foto}
                          alt={colab.nome}
                          className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-700"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-200 truncate">{colab.nome}</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {colab.funcao} · Matrícula: {colab.matricula}
                          </p>
                          <p className="text-[10px] text-slate-400">{colab.jornada}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                            isNoPosto
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : isFolga
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : isFalta
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          }`}
                        >
                          {isNoPosto ? 'No Posto' : isFolga ? 'Folga' : isFalta ? 'Falta' : 'Afastado'}
                        </span>

                        {/* Editar Colaborador */}
                        <button
                          onClick={() => {
                            onClose();
                            openEditarFuncionarioModal(colab);
                          }}
                          title="Editar cadastro do colaborador"
                          className="text-slate-400 hover:text-blue-400 text-xs p-1"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        {/* Desvincular button */}
                        <button
                          onClick={() => removerColaboradorDoPosto(colab.id)}
                          title="Desvincular e transferir para reserva"
                          className="text-slate-500 hover:text-red-400 text-xs p-1"
                        >
                          &times;
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. Ações Rápidas Integradas (Requested in Section 4) */}
          <div className="space-y-2 pt-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              Ações Rápidas de Supervisão
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => openSubstituicaoModal(posto)}
                className="flex items-center justify-center gap-2 p-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-semibold text-xs transition-colors active:scale-95"
              >
                <RefreshCw className="w-4 h-4 text-amber-400" />
                Substituir Funcionário
              </button>

              <button
                onClick={() => openAlocarModal(posto)}
                className="flex items-center justify-center gap-2 p-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 font-semibold text-xs transition-colors active:scale-95"
              >
                <UserPlus className="w-4 h-4 text-blue-400" />
                Alocar Funcionário
              </button>

              <button
                onClick={() => openEscalaModal(posto)}
                className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-slate-200 font-semibold text-xs transition-colors active:scale-95"
              >
                <CalendarDays className="w-4 h-4 text-slate-300" />
                Ver Escala do Posto
              </button>

              <button
                onClick={() => openOcorrenciaModal(posto)}
                className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-slate-200 font-semibold text-xs transition-colors active:scale-95"
              >
                <FileWarning className="w-4 h-4 text-slate-300" />
                Abrir Ocorrência
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-900/80 border-t border-slate-800 shrink-0 flex items-center justify-between">
          <button
            onClick={() => {
              const query = encodeURIComponent(`${posto.nome} ${posto.endereco}`);
              window.open(`https://maps.google.com/?q=${query}`, '_blank');
            }}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Abrir no Google Maps
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Fechar Painel
          </button>
        </div>
      </div>
    </div>
  );
};
