import React, { useState } from 'react';
import { X, Bell, AlertTriangle, CheckCircle2, Clock, ShieldAlert, MapPin, Navigation, Scan, Check, XCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CondominioBadge } from './common/CondominioBadge';

export const NotificationModal: React.FC = () => {
  const {
    alertas,
    resolverAlerta,
    openSubstituicaoModal,
    notificationModalOpen,
    setNotificationModalOpen,
    condominios,
    colaboradores,
    solicitacoesBiometria,
    aprovarSolicitacaoBiometria,
    rejeitarSolicitacaoBiometria,
  } = useApp();

  const [processingId, setProcessingId] = useState<string | null>(null);

  if (!notificationModalOpen) return null;

  const biometriasPendentes = solicitacoesBiometria.filter((s) => s.status === 'pendente');
  const postosDescobertos = condominios.filter((c) => c.status === 'critico');
  const faltasHoje = colaboradores.filter((c) => c.status === 'falta');
  const alertasPendentes = alertas.filter((a) => !a.resolvido);
  const alertasResolvidos = alertas.filter((a) => a.resolvido);

  const totalCriticos =
    postosDescobertos.length +
    faltasHoje.length +
    alertasPendentes.length +
    biometriasPendentes.length;
  const temInconformidadeOperacional =
    postosDescobertos.length > 0 || faltasHoje.length > 0 || biometriasPendentes.length > 0;

  const handleAprovarBiometria = async (id: string) => {
    setProcessingId(id);
    try {
      await aprovarSolicitacaoBiometria(id);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejeitarBiometria = async (id: string) => {
    const just = prompt('Informe a justificativa da rejeição do cadastro biométrico:');
    if (!just || !just.trim()) return;
    setProcessingId(id);
    try {
      await rejeitarSolicitacaoBiometria(id, just.trim());
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full sm:max-w-lg max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-[#0B132B] border border-slate-700/60 shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-250">
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
              temInconformidadeOperacional
                ? 'bg-red-600/25 border-red-500/40 text-red-400'
                : 'bg-blue-600/20 border-blue-500/30 text-blue-400'
            }`}>
              <Bell className={`w-4 h-4 ${temInconformidadeOperacional ? 'text-red-400 animate-bounce' : 'text-blue-400'}`} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Central de Alertas e Notificações</h2>
              <p className="text-[11px] text-slate-400">
                {totalCriticos === 0
                  ? 'Nenhum alerta pendente no momento'
                  : `${totalCriticos} pendência(s) aguardando sua ação`}
              </p>
            </div>
          </div>
          <button
            onClick={() => setNotificationModalOpen(false)}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 no-scrollbar text-xs">
          {totalCriticos === 0 ? (
            <div className="p-8 text-center text-slate-400 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <p className="text-sm font-bold text-slate-200">Nenhum Alerta Operacional!</p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Todos os postos estão operando com 100% de cobertura e nenhuma pendência de biometria ou falta foi registrada.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Seção Prioritária: Solicitações de Biometria Facial Pendentes */}
              {biometriasPendentes.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                      <Scan className="w-4 h-4 text-cyan-400 animate-pulse" />
                      <span>Solicitações de Biometria Facial ({biometriasPendentes.length})</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
                      Ação Obrigatória
                    </span>
                  </div>

                  {biometriasPendentes.map((sol) => (
                    <div
                      key={`sol-bio-${sol.id}`}
                      className="p-3.5 rounded-2xl bg-gradient-to-br from-[#0B173E] via-[#09122D] to-[#070D22] border-2 border-cyan-500/50 space-y-3 shadow-xl shadow-cyan-950/40"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <img
                            src={
                              sol.fotoPerfil ||
                              'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80'
                            }
                            alt={sol.colaboradorNome}
                            className="w-11 h-11 rounded-xl object-cover border-2 border-cyan-400/50 shadow-md shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="font-bold text-white text-xs truncate">{sol.colaboradorNome}</h4>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/25 text-blue-300 border border-blue-500/40">
                                {sol.tipoSolicitacao === 'primeiro_cadastro' ? '1º Cadastro' : 'Recadastro'}
                              </span>
                            </div>
                            <p className="text-[11px] text-cyan-200/90 truncate">
                              {sol.colaboradorFuncao || 'Colaborador'} · Matrícula: <strong className="text-white font-mono">{sol.colaboradorMatricula || 'N/A'}</strong>
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">
                              Posto: <strong className="text-slate-300">{sol.condominioNome || sol.postoNome || 'Portaria Principal'}</strong>
                            </p>
                          </div>
                        </div>

                        <span className="text-[10px] font-mono text-slate-400 shrink-0 bg-slate-900/90 px-2 py-0.5 rounded-lg border border-slate-800">
                          {new Date(sol.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Motivo informado pelo colaborador */}
                      <div className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-[11px] text-slate-300 space-y-1">
                        <span className="text-slate-400 font-semibold block text-[10px] uppercase">Justificativa do Colaborador:</span>
                        <p className="italic text-slate-200 leading-snug">&quot;{sol.motivo}&quot;</p>
                      </div>

                      {/* Ações Rápidas do Administrador / Supervisor */}
                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-end gap-2">
                        <button
                          disabled={processingId === sol.id}
                          onClick={() => handleRejeitarBiometria(sol.id)}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-red-300 bg-slate-900 hover:bg-red-950/40 border border-slate-800 hover:border-red-500/40 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                        >
                          Rejeitar
                        </button>

                        <button
                          disabled={processingId === sol.id}
                          onClick={() => handleAprovarBiometria(sol.id)}
                          className="px-3.5 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 rounded-xl shadow-lg shadow-blue-600/30 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-4 h-4 text-white" />
                          <span>{processingId === sol.id ? 'Aprovando...' : 'Aprovar Cadastro (48h)'}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Seção 1: Postos Descobertos (Crítico) */}
              {postosDescobertos.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    Postos Descobertos ({postosDescobertos.length})
                  </span>
                  {postosDescobertos.map((posto) => (
                    <div
                      key={`posto-${posto.id}`}
                      className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/50 space-y-2.5 shadow-md shadow-red-950/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <h4 className="font-bold text-white text-xs truncate">{posto.nome}</h4>
                            <p className="text-[11px] text-red-200/90 mt-0.5">
                              Posto em nível crítico sem rendição confirmada.
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {posto.bairro} · {posto.vagasContratadas} vagas contratadas · {posto.coberturaPercentual}% cobertura
                            </p>
                          </div>
                        </div>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40 shrink-0 uppercase">
                          Descoberto
                        </span>
                      </div>

                      <div className="pt-2 border-t border-red-900/50 flex items-center justify-end">
                        <button
                          onClick={() => {
                            setNotificationModalOpen(false);
                            openSubstituicaoModal(posto);
                          }}
                          className="px-3 py-1.5 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 rounded-lg shadow-md active:scale-95 cursor-pointer"
                        >
                          Cobrir Posto Agora →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Seção 2: Faltas Registradas no Dia */}
              {faltasHoje.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    Faltas no Dia ({faltasHoje.length})
                  </span>
                  {faltasHoje.map((colab) => {
                    const targetPosto = condominios.find((c) => c.id === colab.condominioId);
                    return (
                      <div
                        key={`falta-${colab.id}`}
                        className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/40 space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <img
                              src={colab.foto}
                              alt={colab.nome}
                              className="w-9 h-9 rounded-lg object-cover border border-amber-500/40 shrink-0"
                            />
                            <div className="min-w-0">
                              <h4 className="font-bold text-white text-xs truncate">{colab.nome}</h4>
                              <p className="text-[11px] text-amber-200/90 truncate">
                                {colab.funcao} · Matrícula: {colab.matricula}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">
                                Posto: <strong className="text-slate-300">{colab.postoNome}</strong>
                              </p>
                            </div>
                          </div>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0 uppercase">
                            Falta
                          </span>
                        </div>

                        <div className="pt-2 border-t border-amber-900/40 flex items-center justify-end">
                          <button
                            onClick={() => {
                              setNotificationModalOpen(false);
                              openSubstituicaoModal(targetPosto, colab);
                            }}
                            className="px-3 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-sm active:scale-95 cursor-pointer"
                          >
                            Despachar Volante →
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Seção 3: Outros Alertas Operacionais Registrados */}
              {alertasPendentes.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Outros Alertas Registrados ({alertasPendentes.length})
                  </span>
                  {alertasPendentes.map((alerta) => {
                    const posto = condominios.find((c) => c.id === alerta.postoId);
                    const colab = colaboradores.find((c) => c.id === alerta.colaboradorId);

                    const isTentativaFora = alerta.tipo === 'tentativa_ponto_fora_posto';
                    const isCobertura = alerta.tipo === 'ponto_posto_cobertura';

                    return (
                      <div
                        key={alerta.id}
                        className={`p-3.5 rounded-xl border space-y-2 shadow-md ${
                          isTentativaFora
                            ? 'bg-red-950/50 border-red-500/60 shadow-red-950/30'
                            : isCobertura
                            ? 'bg-blue-950/50 border-blue-500/60 shadow-blue-950/30'
                            : 'bg-slate-900/80 border-slate-700/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0">
                            {isTentativaFora ? (
                              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5 animate-pulse" />
                            ) : isCobertura ? (
                              <MapPin className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h4
                                  className={`font-bold text-xs truncate ${
                                    isTentativaFora
                                      ? 'text-red-200'
                                      : isCobertura
                                      ? 'text-cyan-200'
                                      : 'text-slate-100'
                                  }`}
                                >
                                  {alerta.titulo}
                                </h4>
                                {isTentativaFora && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 border border-red-500/40 uppercase">
                                    Bloqueado
                                  </span>
                                )}
                                {isCobertura && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 uppercase">
                                    Cobertura
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-300 mt-0.5">{alerta.descricao}</p>
                              {alerta.distanciaTentativaM !== undefined && (
                                <p
                                  className={`text-[10px] font-mono mt-0.5 flex items-center gap-1 ${
                                    isTentativaFora ? 'text-red-300' : 'text-cyan-300'
                                  }`}
                                >
                                  <Navigation className="w-3 h-3" />
                                  <span>
                                    Distância apurada:{' '}
                                    <strong>{alerta.distanciaTentativaM}m</strong> do posto{' '}
                                    {isCobertura ? 'de destino' : 'da tentativa'}
                                  </span>
                                </p>
                              )}
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">{alerta.horario}</span>
                        </div>

                        <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <CondominioBadge icone={posto?.icone} cor={posto?.cor} size="xs" showLabel={false} />
                            <span className="text-[11px] text-slate-300 font-medium truncate">{alerta.postoNome}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {colab && (
                              <a
                                href={`tel:${colab.telefone || '1199999999'}`}
                                className="px-2.5 py-1 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg active:scale-95 cursor-pointer"
                              >
                                Ligar
                              </a>
                            )}
                            <button
                              onClick={() => resolverAlerta(alerta.id)}
                              className="px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg active:scale-95 cursor-pointer"
                            >
                              Ciente
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {alertasResolvidos.length > 0 && (
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Histórico de Alertas Resolvidos Hoje
              </span>
              <div className="space-y-2">
                {alertasResolvidos.map((alerta) => (
                  <div
                    key={alerta.id}
                    className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/80 flex items-center justify-between text-slate-400 text-[11px]"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">{alerta.titulo}</span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-mono shrink-0">
                      Resolvido às {alerta.resolvidoEm}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-3 bg-slate-900/80 border-t border-slate-800 shrink-0 flex justify-end">
          <button
            onClick={() => setNotificationModalOpen(false)}
            className="px-4 py-2 text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-xl"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
