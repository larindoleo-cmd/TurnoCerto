import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  CollaboratorTabType,
  PontoEvento,
  ColaboradorDocumento,
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
import {
  INITIAL_COLABORADOR_DOCUMENTOS,
  INITIAL_NOTIFICACOES_COLABORADOR,
  INITIAL_PONTO_EVENTOS,
} from '../../data/mockData';

export const CollaboratorView: React.FC = () => {
  const {
    currentUser,
    colaboradores,
    condominios,
    holerites,
    pontos,
    empresaInfo,
    showToast,
    setTrocarSenhaModalOpen,
    registrarPonto,
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

  // Tipo de batida selecionado (Entrada, Pausa Almoço/Janta, Retorno, Saída)
  const [selectedPunchType, setSelectedPunchType] = useState<TipoBatidaPonto | undefined>(undefined);

  // Local events state
  const [eventosAtualizados, setEventosAtualizados] = useState<PontoEvento[]>([]);

  const handleOpenBaterPonto = (tipo?: TipoBatidaPonto) => {
    setSelectedPunchType(tipo);
    setRegistroPontoOpen(true);
  };

  // =========================================================================
  // VÍNCULO REAL DO COLABORADOR AUTENTICADO
  // =========================================================================
  const linkedColaborador = useMemo(() => {
    if (!currentUser) return null;

    // 1. Pelo ID de colaborador vinculado diretamente à sessão
    if (currentUser.colaboradorId) {
      const found = colaboradores.find((c) => c.id === currentUser.colaboradorId);
      if (found) return found;
    }

    // 2. Pelo e-mail do usuário
    const cleanEmail = currentUser.email?.trim().toLowerCase();
    if (cleanEmail) {
      const found = colaboradores.find(
        (c) => c.email && c.email.trim().toLowerCase() === cleanEmail
      );
      if (found) return found;
    }

    // 3. Pelo ID de usuário se corresponder ao ID do colaborador
    const foundById = colaboradores.find((c) => c.id === currentUser.id);
    if (foundById) return foundById;

    // 4. Se não encontrar, bloqueia
    return null;
  }, [currentUser, colaboradores]);

  // Notificações do Colaborador com persistência
  const [notificacoes, setNotificacoes] = useState<NotificacaoColaborador[]>(() => {
    if (!linkedColaborador) return [];
    const initialForColab = INITIAL_NOTIFICACOES_COLABORADOR.filter(
      (n) => n.colaboradorId === linkedColaborador.id
    );
    return initialForColab;
  });

  // Carrega notificações do Supabase se existirem
  useEffect(() => {
    if (!linkedColaborador) return;
    const fetchNotificacoes = async () => {
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
            dataHora: d.created_at ? new Date(d.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Hoje',
            lida: Boolean(d.lida),
            linkDestino: d.link_destino || undefined,
          }));
          setNotificacoes(mapped);
        }
      } catch {
        // Usa mock resiliente
      }
    };
    fetchNotificacoes();
  }, [linkedColaborador?.id]);

  const handleMarcarNotificacaoComoLida = async (id: string) => {
    setNotificacoes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, lida: true } : n))
    );
    const client = getSupabase();
    if (client) {
      try {
        await client.from('notificacoes_colaborador').update({ lida: true }).eq('id', id);
      } catch (err) {
        console.warn('Erro ao atualizar notificação no Supabase:', err);
      }
    }
  };

  const handleMarcarTodasComoLidas = async () => {
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
    const client = getSupabase();
    if (client && linkedColaborador) {
      try {
        await client
          .from('notificacoes_colaborador')
          .update({ lida: true })
          .eq('colaborador_id', linkedColaborador.id);
      } catch (err) {
        console.warn('Erro ao atualizar todas notificações no Supabase:', err);
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

  // Localiza o condomínio e posto vinculado
  const linkedPosto = condominios.find((c) => c.id === linkedColaborador.condominioId) ||
    condominios[0] || {
      id: 'cond-default',
      nome: 'Residencial Alvorada',
      tipo: 'Residencial',
      cnpj: '45.123.890/0001-12',
      contratoNumero: 'CT-2024/089',
      endereco: 'Av. Paulista, 1853 - Bela Vista',
      bairro: 'Bela Vista',
      cidade: 'São Paulo - SP',
      supervisor: 'Supervisora Silva',
      telefoneSupervisor: '(11) 98842-1190',
      vagasContratadas: 4,
      status: 'operacional',
      tipoEscalaPadrao: '12x36 (07:00 - 19:00)',
      coberturaPercentual: 100,
      contatoSindico: 'Dr. Roberto Mendonça',
      telefoneSindico: '(11) 97123-4567',
      instrucoesGuarita: 'Controle de portaria e identificação.',
      latitude: -23.55052,
      longitude: -46.633308,
      raioGpsMetros: 150,
      plantaoAtual: { operandoAgora: [], proximaRendicao: { colaboradorId: '', horarioTroca: '19:00' } },
    };

  // Carrega eventos de ponto do colaborador
  const allPunchEvents = useMemo(() => {
    const local = getPontoEventos(linkedColaborador.id);
    const initialForColab = INITIAL_PONTO_EVENTOS.filter(
      (e) => e.colaboradorId === linkedColaborador.id
    );
    const combined = [...local, ...eventosAtualizados, ...initialForColab];
    const uniqueMap = new Map<string, PontoEvento>();
    combined.forEach((item) => uniqueMap.set(item.id, item));
    return Array.from(uniqueMap.values()).sort(
      (a, b) => new Date(b.serverTimestamp).getTime() - new Date(a.serverTimestamp).getTime()
    );
  }, [linkedColaborador.id, eventosAtualizados]);

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

  // Documentos pessoais
  const meusDocumentos: ColaboradorDocumento[] = INITIAL_COLABORADOR_DOCUMENTOS.filter(
    (d) => d.colaboradorId === linkedColaborador.id
  );

  const unreadNotifs = notificacoes.filter((n) => !n.lida).length;

  const handlePontoSuccess = (novoEvento: PontoEvento) => {
    setEventosAtualizados((prev) => [novoEvento, ...prev]);
    const horaFmt = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(novoEvento.serverTimestamp));

    registrarPonto({
      colaboradorId: novoEvento.colaboradorId,
      colaboradorNome: novoEvento.colaboradorNome,
      data: novoEvento.serverTimestamp.slice(0, 10),
      entrada1: novoEvento.tipoEvento === 'entrada' ? horaFmt : '07:00',
      saida1: novoEvento.tipoEvento === 'saida_intervalo' ? horaFmt : undefined,
      entrada2: novoEvento.tipoEvento === 'retorno_intervalo' ? horaFmt : undefined,
      saida2: novoEvento.tipoEvento === 'saida' ? horaFmt : undefined,
      statusPonto: 'Regular',
      localizacaoGPS: `${novoEvento.condominioNome} (${novoEvento.distanceM || 0}m)`,
    });
    showToast(`Ponto registrado e confirmado no servidor! Comprovante: ${novoEvento.comprovanteNumero}`);
  };

  const handleVerComprovante = (evento: PontoEvento) => {
    setSelectedEventoComprovante(evento);
    setComprovanteModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#060913] via-[#080E22] to-[#0B132B] text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Cabeçalho Fixo do Colaborador */}
      <CollaboratorHeader
        colaborador={linkedColaborador}
        unreadCount={unreadNotifs}
        onOpenNotifications={() => setNotificacoesOpen(true)}
        onOpenProfile={() => setActiveTab('meu_perfil')}
      />

      {/* Viewport Principal com Rolagem e Margem para a Bottom Bar */}
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
            onVerComprovante={handleVerComprovante}
          />
        )}

        {activeTab === 'documentos' && (
          <DocumentosScreen
            colaborador={linkedColaborador}
            holerites={holerites}
            documentos={meusDocumentos}
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

      {/* Barra Inferior Exclusiva do Funcionário */}
      <CollaboratorBottomBar
        activeTab={activeTab}
        onChangeTab={(tab) => setActiveTab(tab)}
        unreadCount={unreadNotifs}
      />

      {/* ========================================================================= */}
      {/* FLUXOS E MODAIS COMPLEMENTARES */}
      {/* ========================================================================= */}
      <RegistroPontoModal
        isOpen={registroPontoOpen}
        colaborador={linkedColaborador}
        posto={linkedPosto}
        hojePunches={hojePunches}
        initialPunchType={selectedPunchType}
        onClose={() => setRegistroPontoOpen(false)}
        onSuccess={handlePontoSuccess}
        onNavigateToRegistros={() => {
          setRegistroPontoOpen(false);
          setActiveTab('meus_registros');
        }}
      />

      {/* Modal de Comprovante de Ponto Oficial */}
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
        onMarcarTodasComoLidas={handleMarcarTodasComoLidas}
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
