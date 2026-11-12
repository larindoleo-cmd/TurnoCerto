import React, { useState } from 'react';
import {
  X,
  Bell,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  MapPin,
  Navigation,
  Scan,
  KeyRound,
  Check,
  CalendarClock,
  FileText,
  FileSpreadsheet,
} from 'lucide-react';
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
    openRedefinirSenhaModal,
    notificacoesSistema,
    marcarNotificacaoLida,
    setActiveTab,
  } = useApp();

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  if (!notificationModalOpen) return null;

  const biometriasPendentes = solicitacoesBiometria.filter((s) => s.status === 'pendente');
  const postosDescobertos = condominios.filter((c) => c.status === 'critico');
  const faltasHoje = colaboradores.filter((c) => c.status === 'falta');
  const alertasPendentes = alertas.filter((a) => !a.resolvido);
  const alertasResolvidos = alertas.filter((a) => a.resolvido);
  const notifsNaoLidas = notificacoesSistema.filter((n) => !n.lida);
  const notifsRecentesLidas = notificacoesSistema.filter((n) => n.lida).slice(0, 10);

  const totalCriticos =
    postosDescobertos.length +
    faltasHoje.length +
    alertasPendentes.length +
    biometriasPendentes.length +
    notifsNaoLidas.length;
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

  const handleConfirmarRejeicao = async (id: string) => {
    const trimmed = rejectReason.trim();
    if (!trimmed) return;
    setProcessingId(id);
    try {
      await rejeitarSolicitacaoBiometria(id, trimmed);
      setRejectingId(null);
      setRejectReason('');
    } finally {
      setProcessingId(null);
    }
  };

  const getInitials = (name: string) =>
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || '')
      .join('') || 'TC';

  const getNotifIcon = (categoria: string) => {
    switch (categoria) {
      case 'cobertura':
        return <CalendarClock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />;
      case 'documento':
        return <FileText className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />;
      case 'holerite':
        return <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />;
      case 'divergencia_posto':
      case 'alerta_config':
        return <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />;
      default:
        return <Bell className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />;
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
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                temInconformidadeOperacional
                  ? 'bg-red-600/25 border-red-500/40 text-red-400'
                  : 'bg-blue-600/20 border-blue-500/30 text-blue-400'
              }`}
            >
              <Bell className={`w-4 h-4 ${temInconformidadeOperacional ? 'text-red-400 animate-bounce' : 'text-blue-400'}`} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Central de Alertas e Notificações</h2>
              <p className="text-[11px] text-slate-400">
                {totalCriticos === 0
                  ? 'Nenhum alerta pendente no momento'
                  : `${totalCriticos} pendência(s) aguardando sua revisão`}
              </p>
            </div>
          </div>
          <button
            onClick={() => setNotificationModalOpen(false)}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
            aria-label="Fechar central de notificações"
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
                Todos os postos estão operando regularmente e não há pendências de biometria, ponto ou documentos.
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
                          {sol.fotoPerfil ? (
                            <img
                              src={sol.fotoPerfil}
                              alt={sol.colaboradorNome}
                              className="w-11 h-11 rounded-xl object-cover border-2 border-cyan-400/50 shadow-md shrink-0"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-xl bg-cyan-950 border-2 border-cyan-400/50 text-cyan-200 font-bold flex items-center justify-center shrink-0">
                              {getInitials(sol.colaboradorNome)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="font-bold text-white text-xs truncate">{sol.colaboradorNome}</h4>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/25 text-blue-300 border border-blue-500/40">
                                {sol.tipoSolicitacao === 'primeiro_cadastro' ? '1º Cadastro' : 'Recadastro'}
                              </span>
                            </div>
                            <p className="text-[11px] text-cyan-200/90 truncate">
                              {sol.colaboradorFuncao || 'Colaborador'} · Matrícula:{' '}
                              <strong className="text-white font-mono">{sol.colaboradorMatricula || 'N/A'}</strong>
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">
                              Posto:{' '}
                              <strong className="text-slate-300">{sol.condominioNome || sol.postoNome || 'Sem posto fixo'}</strong>
                            </p>
                          </div>
                        </div>

                        <span className="text-[10px] font-mono text-slate-400 shrink-0 bg-slate-900/90 px-2 py-0.5 rounded-lg border border-slate-800">
                          {new Date(sol.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-[11px] text-slate-300 space-y-1">
                        <span className="text-slate-400 font-semibold block text-[10px] uppercase">Justificativa do Colaborador:</span>
                        <p className="italic text-slate-200 leading-snug">&quot;{sol.motivo}&quot;</p>
                      </div>

                      {rejectingId === sol.id ? (
                        <div className="p-2.5 rounded-xl bg-red-950/30 border border-red-500/40 space-y-2">
                          <label className="block text-[10px] font-bold uppercase text-red-300">
                            Justificativa da rejeição
                          </label>
                          <input
                            type="text"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Descreva o motivo da recusa..."
                            className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-red-400"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setRejectingId(null);
                                setRejectReason('');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              disabled={!rejectReason.trim() || processingId === sol.id}
                              onClick={() => handleConfirmarRejeicao(sol.id)}
                              className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs cursor-pointer disabled:opacity-50"
                            >
                              {processingId === sol.id ? 'Rejeitando...' : 'Confirmar Rejeição'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-end gap-2">
                          <button
                            disabled={processingId === sol.id}
                            onClick={() => {
                              setRejectingId(sol.id);
                              setRejectReason('');
                            }}
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
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Seção: Notificações do Sistema (leitura individual) */}
              {notifsNaoLidas.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 block">
                    Notificações Recentes ({notifsNaoLidas.length} não lida(s))
                  </span>
                  {notifsNaoLidas.map((notif) => (
                    <div
                      key={notif.id}
                      className="p-3 rounded-xl bg-blue-950/30 border border-blue-500/40 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          {getNotifIcon(notif.categoria)}
                          <div className="min-w-0">
                            <h4 className="font-bold text-white text-xs truncate">{notif.titulo}</h4>
                            <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">{notif.mensagem}</p>
                            <span className="text-[10px] text-slate-500 font-mono block mt-1">
                              {new Date(notif.createdAt).toLocaleString('pt-BR', {
                                timeZone: 'America/Sao_Paulo',
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-1.5 border-t border-slate-800/80">
                        {notif.linkDestino && (notif.linkDestino === 'rh' || notif.linkDestino === 'equipe' || notif.linkDestino === 'postos') && (
                          <button
                            onClick={() => {
                              setActiveTab(notif.linkDestino as 'rh' | 'equipe' | 'postos');
                              setNotificationModalOpen(false);
                            }}
                            className="px-2.5 py-1 text-[11px] font-semibold text-blue-300 bg-blue-500/15 hover:bg-blue-500/25 rounded-lg cursor-pointer"
                          >
                            Abrir Aba
                          </button>
                        )}
                        <button
                          onClick={() => marcarNotificacaoLida(notif.id)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                          <span>Marcar lida</span>
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
                          Cobrir Posto (Temporário) →
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
                            {colab.foto ? (
                              <img
                                src={colab.foto}
                                alt={colab.nome}
                                className="w-9 h-9 rounded-lg object-cover border border-amber-500/40 shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-200 font-bold flex items-center justify-center shrink-0">
                                {getInitials(colab.nome)}
                              </div>
                            )}
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
                    Alertas Operacionais Pendentes ({alertasPendentes.length})
                  </span>
                  {alertasPendentes.map((alerta) => {
                    const posto = condominios.find((c) => c.id === alerta.postoId);
                    const colab = colaboradores.find((c) => c.id === alerta.colaboradorId);

                    const isTentativaFora = alerta.tipo === 'tentativa_ponto_fora_posto';
                    const isCobertura =
                      alerta.tipo === 'ponto_posto_cobertura' || alerta.tipo === 'posto_divergente';
                    const isSenha = alerta.tipo === 'solicitacao_senha';
                    const isSemCoord = alerta.tipo === 'posto_sem_coordenadas';
                    const cleanTel = (colab?.telefone || '').replace(/\D/g, '');

                    return (
                      <div
                        key={alerta.id}
                        className={`p-3.5 rounded-xl border space-y-2 shadow-md ${
                          isTentativaFora
                            ? 'bg-red-950/50 border-red-500/60 shadow-red-950/30'
                            : isCobertura
                            ? 'bg-blue-950/50 border-blue-500/60 shadow-blue-950/30'
                            : isSenha || isSemCoord
                            ? 'bg-amber-950/40 border-amber-500/60 shadow-amber-950/30'
                            : 'bg-slate-900/80 border-slate-700/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0">
                            {isTentativaFora ? (
                              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5 animate-pulse" />
                            ) : isCobertura || isSemCoord ? (
                              <MapPin className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                            ) : isSenha ? (
                              <KeyRound className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4
                                  className={`font-bold text-xs truncate ${
                                    isTentativaFora
                                      ? 'text-red-200'
                                      : isCobertura
                                      ? 'text-cyan-200'
                                      : isSenha || isSemCoord
                                      ? 'text-amber-200'
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
                                    {alerta.tipo === 'posto_divergente' ? 'Divergência Posto' : 'Cobertura'}
                                  </span>
                                )}
                                {isSemCoord && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
                                    Calibração GPS
                                  </span>
                                )}
                                {isSenha && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
                                    Recuperação de Senha
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
                                    Distância apurada: <strong>{alerta.distanciaTentativaM}m</strong> do posto{' '}
                                    {isCobertura ? 'detectado' : 'mais próximo'}
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
                            {(alerta.tipo === 'posto_descoberto' || alerta.tipo === 'falta') && posto && (
                              <button
                                onClick={() => {
                                  setNotificationModalOpen(false);
                                  openSubstituicaoModal(posto, colab, alerta.id);
                                }}
                                className="px-2.5 py-1 text-[11px] font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg active:scale-95 cursor-pointer"
                              >
                                Substituir
                              </button>
                            )}
                            {isSenha && colab && (
                              <button
                                onClick={() => {
                                  openRedefinirSenhaModal(colab);
                                  setNotificationModalOpen(false);
                                }}
                                className="px-2.5 py-1 text-[11px] font-bold text-amber-950 bg-amber-400 hover:bg-amber-300 rounded-lg active:scale-95 cursor-pointer flex items-center gap-1 shadow-md shadow-amber-400/20"
                              >
                                <KeyRound className="w-3 h-3" />
                                <span>Redefinir Senha</span>
                              </button>
                            )}
                            {cleanTel && (
                              <a
                                href={`tel:${cleanTel}`}
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

          {notifsRecentesLidas.length > 0 && (
            <div className="pt-3 border-t border-slate-800 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Notificações Lidas Recentemente
              </span>
              {notifsRecentesLidas.map((n) => (
                <div key={n.id} className="p-2 rounded-lg bg-slate-900/40 border border-slate-800/70 text-[11px] text-slate-400 flex items-center justify-between gap-2">
                  <span className="truncate">{n.titulo}</span>
                  <span className="text-[9px] text-emerald-400 font-mono shrink-0">Lida</span>
                </div>
              ))}
            </div>
          )}

          {alertasResolvidos.length > 0 && (
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Histórico de Alertas Resolvidos
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
            className="px-4 py-2 text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-xl cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
