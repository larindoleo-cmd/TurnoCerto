import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  CollaboratorTabType,
  CondominioPosto,
  PontoEvento,
  NotificacaoColaborador,
  HoleriteRegistro,
  TipoBatidaPonto,
} from '../../types';
import { CollaboratorHeader } from './CollaboratorHeader';
import { CollaboratorBottomBar } from './CollaboratorBottomBar';
import { MeuTurnoScreen } from './screens/MeuTurnoScreen';
import { MinhaEscalaScreen } from './screens/MinhaEscalaScreen';
import { MeusRegistrosScreen } from './screens/MeusRegistrosScreen';
import { DocumentosScreen } from './screens/DocumentosScreen';
import { MeuPerfilScreen } from './screens/MeuPerfilScreen';
import { RegistroPontoModal } from './screens/RegistroPontoModal';
import { AtivarBiometriaModal } from './screens/AtivarBiometriaModal';
import { FacialEnrollmentModal } from './screens/FacialEnrollmentModal';
import { ComunicarOcorrenciaModal } from './screens/ComunicarOcorrenciaModal';
import { FaleComRHModal } from './screens/FaleComRHModal';
import { NotificacoesModal } from './screens/NotificacoesModal';
import { AcessoBloqueadoScreen } from './screens/AcessoBloqueadoScreen';
import { HoleriteDetalheModal } from '../modals/HoleriteDetalheModal';
import { ChangePasswordModal } from '../modals/ChangePasswordModal';
import { ComprovanteDetalheModal } from './screens/ComprovanteDetalheModal';
import { getPontoEventos } from '../../services/pontoService';
import { getSupabase } from '../../lib/supabase';

export const CollaboratorView: React.FC = () => {
  const {
    currentUser,
    colaboradores,
    condominios,
    holerites,
    pontos,
    pontoEventos,
    setPontoEventos,
    coberturasProgramadas,
    documentoSolicitacoes,
    colaboradorDocumentos,
    documentoHistorico,
    notificacoesSistema,
    marcarNotificacaoLida,
    responderCobertura,
    registrarSolicitacaoCorrecao,
    solicitacoesCorrecao,
    empresaInfo,
    showToast,
    setTrocarSenhaModalOpen,
  } = useApp();

  const [activeTab, setActiveTab] = useState<CollaboratorTabType>('meu_turno');

  // Modais da Área do Funcionário
  const [registroPontoOpen, setRegistroPontoOpen] = useState(false);
  const [ativarBiometriaOpen, setAtivarBiometriaOpen] = useState(false);
  const [facialEnrollmentOpen, setFacialEnrollmentOpen] = useState(false);
  const [ocorrenciaOpen, setOcorrenciaOpen] = useState(false);
  const [faleRHOpen, setFaleRHOpen] = useState(false);
  const [notificacoesOpen, setNotificacoesOpen] = useState(false);
  const [selectedHolerite, setSelectedHolerite] = useState<HoleriteRegistro | null>(null);

  // Comprovante oficial
  const [comprovanteModalOpen, setComprovanteModalOpen] = useState(false);
  const [selectedEventoComprovante, setSelectedEventoComprovante] = useState<PontoEvento | null>(null);

  // Tipo de batida selecionado
  const [selectedPunchType, setSelectedPunchType] = useState<TipoBatidaPonto | undefined>(undefined);

  // Eventos locais registrados na sessão atual
  const [eventosAtualizados, setEventosAtualizados] = useState<PontoEvento[]>([]);
  const [legacyNotifs, setLegacyNotifs] = useState<NotificacaoColaborador[]>([]);

  const handleOpenBaterPonto = (tipo?: TipoBatidaPonto) => {
    setSelectedPunchType(tipo);
    setRegistroPontoOpen(true);
  };

  // Vínculo real do colaborador autenticado
  const linkedColaborador = useMemo(() => {
    if (!currentUser) return null;

    if (currentUser.colaboradorId) {
      const found = colaboradores.find((c) => c.id === currentUser.colaboradorId);
      if (found) return found;
    }

    const cleanEmail = currentUser.email?.trim().toLowerCase();
    if (cleanEmail) {
      const found = colaboradores.find(
        (c) => c.email && c.email.trim().toLowerCase() === cleanEmail
      );
      if (found) return found;
    }

    const foundById = colaboradores.find((c) => c.id === currentUser.id);
    if (foundById) return foundById;

    return null;
  }, [currentUser, colaboradores]);

  // Notificações legadas complementares (apenas se houver tabela antiga no Supabase)
  useEffect(() => {
    if (!linkedColaborador) return;
    const fetchLegacyNotifs = async () => {
      const client = getSupabase();
      if (!client) return;
      try {
        const { data, error } = await client
          .from('notificacoes_colaborador')
          .select('*')
          .eq('colaborador_id', linkedColaborador.id)
          .order('created_at', { ascending: false });

        if (data && data.length > 0 && !error) {
          const mapped: NotificacaoColaborador[] = data.map((d: any) => ({
            id: d.id,
            colaboradorId: d.colaborador_id,
            titulo: d.titulo,
            mensagem: d.mensagem,
            tipo: d.tipo || 'geral',
            dataHora: d.created_at
              ? new Date(d.created_at).toLocaleTimeString('pt-BR', {
                  timeZone: 'America/Sao_Paulo',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '--:--',
            lida: Boolean(d.lida),
            linkDestino: d.link_destino || undefined,
          }));
          setLegacyNotifs(mapped);
        }
      } catch {
        // tabela opcional
      }
    };
    fetchLegacyNotifs();
  }, [linkedColaborador?.id]);

  // Notificações unificadas do sistema + legadas (leitura estritamente individual)
  const notificacoes = useMemo<NotificacaoColaborador[]>(() => {
    if (!linkedColaborador) return [];
    const fromSistema: NotificacaoColaborador[] = notificacoesSistema
      .filter((n) => n.destinatarioColaboradorId === linkedColaborador.id)
      .map((n) => ({
        id: n.id,
        colaboradorId: linkedColaborador.id,
        titulo: n.titulo,
        mensagem: n.mensagem,
        tipo:
          n.categoria === 'holerite'
            ? 'holerite'
            : n.categoria === 'cobertura'
            ? 'escala'
            : n.categoria === 'ponto'
            ? 'ponto'
            : 'geral',
        dataHora: new Date(n.createdAt).toLocaleTimeString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          hour: '2-digit',
          minute: '2-digit',
        }),
        lida: n.lida,
        linkDestino: (n.linkDestino as CollaboratorTabType) || undefined,
      }));

    const merged = new Map<string, NotificacaoColaborador>();
    [...fromSistema, ...legacyNotifs].forEach((n) => merged.set(n.id, n));
    return Array.from(merged.values());
  }, [linkedColaborador, notificacoesSistema, legacyNotifs]);

  const handleMarcarNotificacaoComoLida = async (id: string) => {
    const isSistema = notificacoesSistema.some((n) => n.id === id);
    if (isSistema) {
      await marcarNotificacaoLida(id);
    }
    setLegacyNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, lida: true } : n)));
    const client = getSupabase();
    if (client && !isSistema) {
      try {
        await client.from('notificacoes_colaborador').update({ lida: true }).eq('id', id);
      } catch {
        // silencioso
      }
    }
  };

  // Se o vínculo não foi localizado, bloqueia a interface imediatamente
  if (!linkedColaborador) {
    return (
      <>
        <AcessoBloqueadoScreen onFaleComRH={() => setFaleRHOpen(true)} />
        <FaleComRHModal
          isOpen={faleRHOpen}
          empresa={empresaInfo}
          colaborador={{
            id: 'pendente',
            nome: currentUser?.nome || 'Colaborador sem vínculo',
            matricula: 'N/A',
            funcao: 'Porteiro',
            condominioId: null,
            postoNome: 'Aguardando Atribuição',
            status: 'afastado',
            jornada: 'Pendente',
            tipoEscala: '12x36',
            turno: 'diurno',
            foto: '',
            telefone: '',
            cpf: '',
            dataAdmissao: '',
            bancoHoras: 0,
            salarioBase: 0,
          }}
          onClose={() => setFaleRHOpen(false)}
        />
      </>
    );
  }

  // Posto habitual do colaborador (SEM coordenadas sintéticas de fallback)
  const linkedPosto: CondominioPosto =
    condominios.find((c) => c.id === linkedColaborador.condominioId) || {
      id: linkedColaborador.condominioId || 'reserva-operacional',
      nome: linkedColaborador.postoNome || 'Reserva Operacional / Sem Posto Fixo',
      tipo: 'Residencial',
      cnpj: '',
      contratoNumero: '',
      endereco: 'Lotação ainda não vinculada a posto específico',
      bairro: '',
      cidade: '',
      supervisor: '',
      telefoneSupervisor: '',
      vagasContratadas: 0,
      status: 'atencao',
      ativo: false,
      tipoEscalaPadrao: linkedColaborador.jornada || '12x36',
      coberturaPercentual: 0,
      contatoSindico: '',
      telefoneSindico: '',
      instrucoesGuarita: '',
      latitude: undefined,
      longitude: undefined,
      raioGpsMetros: 150,
      plantaoAtual: { operandoAgora: [], proximaRendicao: { colaboradorId: '', horarioTroca: '19:00' } },
    };

  // Carrega eventos reais de ponto do colaborador (AppContext + cache local)
  const allPunchEvents = useMemo(() => {
    const local = getPontoEventos(linkedColaborador.id);
    const fromContext = pontoEventos.filter((e) => e.colaboradorId === linkedColaborador.id);
    const combined = [...fromContext, ...eventosAtualizados, ...local];
    const uniqueMap = new Map<string, PontoEvento>();
    combined.forEach((item) => {
      const key = item.idempotencyKey || item.id;
      const existing = uniqueMap.get(key);
      if (!existing || item.verificationStatus === 'confirmado') {
        uniqueMap.set(key, item);
      }
    });
    return Array.from(uniqueMap.values()).sort(
      (a, b) => new Date(b.serverTimestamp).getTime() - new Date(a.serverTimestamp).getTime()
    );
  }, [linkedColaborador.id, pontoEventos, eventosAtualizados]);

  // Batidas de hoje no fuso America/Sao_Paulo
  const hojeKey = new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const hojePunches = allPunchEvents.filter((e) => {
    const eventDay = new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(e.serverTimestamp));
    return eventDay === hojeKey;
  });

  const ultimoEvento = allPunchEvents[0];

  const meusDocumentos = colaboradorDocumentos.filter(
    (d) => d.colaboradorId === linkedColaborador.id
  );
  const minhasSolicitacoesDocs = documentoSolicitacoes.filter(
    (s) => s.colaboradorId === linkedColaborador.id
  );
  const meuHistoricoDocs = documentoHistorico.filter(
    (h) => h.colaboradorId === linkedColaborador.id
  );
  const minhasCoberturas = coberturasProgramadas.filter(
    (c) => c.colaboradorId === linkedColaborador.id
  );
  const minhasCorrecoes = solicitacoesCorrecao.filter(
    (c) => c.colaboradorId === linkedColaborador.id
  );

  const unreadNotifs = notificacoes.filter((n) => !n.lida).length;

  const handlePontoSuccess = (novoEvento: PontoEvento) => {
    setEventosAtualizados((prev) => [
      novoEvento,
      ...prev.filter((e) => e.id !== novoEvento.id && e.idempotencyKey !== novoEvento.idempotencyKey),
    ]);
    setPontoEventos((prev) => [
      novoEvento,
      ...prev.filter((e) => e.id !== novoEvento.id && e.idempotencyKey !== novoEvento.idempotencyKey),
    ]);

    if (novoEvento.verificationStatus === 'confirmado') {
      showToast(`Ponto confirmado no servidor! Comprovante: ${novoEvento.comprovanteNumero}`);
    } else {
      showToast(`Ponto salvo em fila local (Pendente de sincronização). Comprovante: ${novoEvento.comprovanteNumero}`);
    }
  };

  const handleVerComprovante = (evento: PontoEvento) => {
    setSelectedEventoComprovante(evento);
    setComprovanteModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#060913] via-[#080E22] to-[#0B132B] text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      <CollaboratorHeader
        colaborador={linkedColaborador}
        unreadCount={unreadNotifs}
        onOpenNotifications={() => setNotificacoesOpen(true)}
        onOpenProfile={() => setActiveTab('meu_perfil')}
      />

      <main className="flex-1 max-w-md w-full mx-auto px-3.5 sm:px-4 pt-3 pb-28">
        {activeTab === 'meu_turno' && (
          <MeuTurnoScreen
            colaborador={linkedColaborador}
            posto={linkedPosto}
            hojePunches={hojePunches}
            ultimoEvento={ultimoEvento}
            pontosHistoricos={pontos.filter(
              (p) => p.colaboradorId === linkedColaborador.id || p.colaboradorNome === linkedColaborador.nome
            )}
            allPunchEvents={allPunchEvents}
            coberturas={minhasCoberturas}
            onBaterPonto={handleOpenBaterPonto}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onOpenOcorrencia={() => setOcorrenciaOpen(true)}
            onVerComprovante={handleVerComprovante}
          />
        )}

        {activeTab === 'minha_escala' && (
          <MinhaEscalaScreen
            colaborador={linkedColaborador}
            posto={linkedPosto}
            condominios={condominios}
            coberturas={minhasCoberturas}
            onResponderCobertura={responderCobertura}
            onSolicitarAjuste={(dataPonto, motivo) =>
              registrarSolicitacaoCorrecao({
                colaboradorId: linkedColaborador.id,
                colaboradorNome: linkedColaborador.nome,
                dataPonto,
                tipoCorrecao: 'ajuste_escala',
                justificativa: motivo,
              })
            }
            onOpenSupport={() => setFaleRHOpen(true)}
          />
        )}

        {activeTab === 'meus_registros' && (
          <MeusRegistrosScreen
            colaborador={linkedColaborador}
            posto={linkedPosto}
            eventos={allPunchEvents}
            pontosHistoricos={pontos.filter(
              (p) => p.colaboradorId === linkedColaborador.id || p.colaboradorNome === linkedColaborador.nome
            )}
            solicitacoesCorrecao={minhasCorrecoes}
            onSolicitarCorrecao={registrarSolicitacaoCorrecao}
            onVerComprovante={handleVerComprovante}
          />
        )}

        {activeTab === 'documentos' && (
          <DocumentosScreen
            colaborador={linkedColaborador}
            holerites={holerites.filter(
              (h) => h.statusPublicacao === 'publicado' || !h.statusPublicacao
            )}
            documentos={meusDocumentos}
            solicitacoes={minhasSolicitacoesDocs}
            historico={meuHistoricoDocs}
            empresa={empresaInfo}
            onOpenHoleriteDetalhe={(h) => setSelectedHolerite(h)}
            onOpenFaleRH={() => setFaleRHOpen(true)}
          />
        )}

        {activeTab === 'meu_perfil' && (
          <MeuPerfilScreen
            colaborador={linkedColaborador}
            posto={linkedPosto}
            onOpenAtivarBiometria={() => setAtivarBiometriaOpen(true)}
            onOpenFacialEnrollment={() => setFacialEnrollmentOpen(true)}
            onOpenTrocarSenha={() => setTrocarSenhaModalOpen(true)}
          />
        )}
      </main>

      <CollaboratorBottomBar
        activeTab={activeTab}
        onChangeTab={(tab) => setActiveTab(tab)}
        unreadCount={unreadNotifs}
      />

      <RegistroPontoModal
        isOpen={registroPontoOpen}
        colaborador={linkedColaborador}
        posto={linkedPosto}
        hojePunches={allPunchEvents}
        initialPunchType={selectedPunchType}
        onClose={() => setRegistroPontoOpen(false)}
        onSuccess={handlePontoSuccess}
        onNavigateToRegistros={() => {
          setRegistroPontoOpen(false);
          setActiveTab('meus_registros');
        }}
      />

      {selectedEventoComprovante && (
        <ComprovanteDetalheModal
          isOpen={comprovanteModalOpen}
          evento={selectedEventoComprovante}
          colaborador={linkedColaborador}
          empresa={empresaInfo}
          onClose={() => {
            setComprovanteModalOpen(false);
            setSelectedEventoComprovante(null);
          }}
        />
      )}

      <FacialEnrollmentModal
        isOpen={facialEnrollmentOpen}
        colaborador={linkedColaborador}
        onClose={() => setFacialEnrollmentOpen(false)}
        onSuccess={() => {
          showToast('Biometria facial de 128 dimensões cadastrada com sucesso!');
        }}
      />

      <AtivarBiometriaModal
        isOpen={ativarBiometriaOpen}
        colaborador={linkedColaborador}
        onClose={() => setAtivarBiometriaOpen(false)}
        onSuccess={() => {
          showToast('Biometria vinculada com sucesso a este dispositivo!');
        }}
      />

      <ComunicarOcorrenciaModal
        isOpen={ocorrenciaOpen}
        colaborador={linkedColaborador}
        posto={linkedPosto}
        onClose={() => setOcorrenciaOpen(false)}
        onSuccess={(proto) => {
          showToast(`Ocorrência encaminhada com sucesso! Protocolo: ${proto}`);
        }}
      />

      <FaleComRHModal
        isOpen={faleRHOpen}
        empresa={empresaInfo}
        colaborador={linkedColaborador}
        onClose={() => setFaleRHOpen(false)}
      />

      <NotificacoesModal
        isOpen={notificacoesOpen}
        notificacoes={notificacoes}
        condominio={linkedPosto}
        onClose={() => setNotificacoesOpen(false)}
        onNavigateTab={(tab) => setActiveTab(tab)}
        onMarcarComoLida={handleMarcarNotificacaoComoLida}
      />

      {selectedHolerite && (
        <HoleriteDetalheModal
          holerite={selectedHolerite}
          onClose={() => setSelectedHolerite(null)}
        />
      )}

      <ChangePasswordModal />
    </div>
  );
};

