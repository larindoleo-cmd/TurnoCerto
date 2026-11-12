import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  TabType,
  CondominioPosto,
  Colaborador,
  AlertaOperacional,
  Ocorrencia,
  HoleriteRegistro,
  PontoRegistro,
  AtestadoMedico,
  NovoFuncionarioPayload,
  EmpresaInfo,
  UsuarioAuth,
  SolicitacaoBiometriaFacial,
  CoberturaProgramada,
  DocumentoSolicitacao,
  ColaboradorDocumento,
  DocumentoHistorico,
  HoleriteLote,
  HoleriteEvento,
  NotificacaoSistema,
  SolicitacaoCorrecaoPonto,
  PontoEvento,
} from '../types';
import { getSupabase } from '../lib/supabase';
import {
  getLocalSolicitacoesBiometria,
  saveLocalSolicitacoesBiometria,
  solicitarCadastroBiometria,
  aprovarSolicitacaoBiometria as aprovarBiometriaService,
  rejeitarSolicitacaoBiometria as rejeitarBiometriaService,
  getActiveBiometriaAuthorization as getActiveBiometriaService,
  getUltimaSolicitacaoColaborador as getUltimaBiometriaService,
} from '../services/facialRecognitionService';
import {
  DEFAULT_MAX_ACCURACY_THRESHOLD_M,
  syncPendingPontoEventos,
} from '../services/pontoService';
import {
  fetchCoberturas,
  criarCoberturaProgramada,
  responderAceiteCobertura,
  atualizarStatusCobertura,
  CriarCoberturaInput,
} from '../services/escalaCoberturaService';
import {
  fetchDocumentoSolicitacoes,
  fetchColaboradorDocumentos,
  fetchDocumentoHistorico,
} from '../services/documentWorkflowService';
import {
  fetchHoleriteLotes,
  fetchHoleriteEventos,
  mapHoleriteRow,
} from '../services/holeriteWorkflowService';

function generateSafeId(prefix = 'tc'): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function isValidUUID(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

const EMPTY_EMPRESA_INFO: EmpresaInfo = {
  id: 'emp-matriz-principal',
  razaoSocial: 'TurnoCerto Gestão Operacional',
  nomeFantasia: 'TurnoCerto',
  cnpj: '',
  inscricaoEstadual: '',
  inscricaoMunicipal: '',
  telefone: '',
  whatsapp: '',
  email: '',
  endereco: '',
  bairro: '',
  cidade: '',
  estado: '',
  cep: '',
  responsavelOperacional: '',
  cargoResponsavel: '',
  chavePix: '',
  logoUrl: '',
  apresentacao: '',
  maxGpsAccuracyM: DEFAULT_MAX_ACCURACY_THRESHOLD_M,
  exigeAceiteCobertura: false,
};

interface AppContextType {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  selectedCondominioId: string;
  setSelectedCondominioId: (id: string) => void;
  condominios: CondominioPosto[];
  colaboradores: Colaborador[];
  alertas: AlertaOperacional[];
  ocorrencias: Ocorrencia[];
  holerites: HoleriteRegistro[];
  setHolerites: React.Dispatch<React.SetStateAction<HoleriteRegistro[]>>;
  pontos: PontoRegistro[];
  pontoEventos: PontoEvento[];
  setPontoEventos: React.Dispatch<React.SetStateAction<PontoEvento[]>>;
  atestados: AtestadoMedico[];
  coberturasProgramadas: CoberturaProgramada[];
  setCoberturasProgramadas: React.Dispatch<React.SetStateAction<CoberturaProgramada[]>>;
  documentoSolicitacoes: DocumentoSolicitacao[];
  setDocumentoSolicitacoes: React.Dispatch<React.SetStateAction<DocumentoSolicitacao[]>>;
  colaboradorDocumentos: ColaboradorDocumento[];
  setColaboradorDocumentos: React.Dispatch<React.SetStateAction<ColaboradorDocumento[]>>;
  documentoHistorico: DocumentoHistorico[];
  holeriteLotes: HoleriteLote[];
  setHoleriteLotes: React.Dispatch<React.SetStateAction<HoleriteLote[]>>;
  holeriteEventos: HoleriteEvento[];
  notificacoesSistema: NotificacaoSistema[];
  setNotificacoesSistema: React.Dispatch<React.SetStateAction<NotificacaoSistema[]>>;
  solicitacoesCorrecao: SolicitacaoCorrecaoPonto[];
  setSolicitacoesCorrecao: React.Dispatch<React.SetStateAction<SolicitacaoCorrecaoPonto[]>>;
  cadastroModalOpen: boolean;
  setCadastroModalOpen: (open: boolean) => void;

  // Filtering states
  filterEquipeStatus: string;
  setFilterEquipeStatus: (status: string) => void;
  filterEquipeFuncao: string;
  setFilterEquipeFuncao: (funcao: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Modals & Panels
  selectedPostoFor360: CondominioPosto | null;
  openPosto360: (posto: CondominioPosto | string) => void;
  closePosto360: () => void;

  substituicaoModal: {
    isOpen: boolean;
    posto?: CondominioPosto;
    colaboradorFalta?: Colaborador;
    alertaId?: string;
  } | null;
  openSubstituicaoModal: (posto?: CondominioPosto, colaboradorFalta?: Colaborador, alertaId?: string) => void;
  closeSubstituicaoModal: () => void;

  alocarModal: { isOpen: boolean; posto?: CondominioPosto } | null;
  openAlocarModal: (posto?: CondominioPosto) => void;
  closeAlocarModal: () => void;

  escalaModal: { isOpen: boolean; posto?: CondominioPosto } | null;
  openEscalaModal: (posto?: CondominioPosto) => void;
  closeEscalaModal: () => void;

  ocorrenciaModal: { isOpen: boolean; posto?: CondominioPosto } | null;
  openOcorrenciaModal: (posto?: CondominioPosto) => void;
  closeOcorrenciaModal: () => void;

  holeriteDetalhe: HoleriteRegistro | null;
  openHoleriteDetalhe: (holerite: HoleriteRegistro) => void;
  closeHoleriteDetalhe: () => void;

  notificationModalOpen: boolean;
  setNotificationModalOpen: (open: boolean) => void;

  supabaseModalOpen: boolean;
  setSupabaseModalOpen: (open: boolean) => void;

  // Empresa Info
  empresaInfo: EmpresaInfo;
  empresaModalOpen: boolean;
  setEmpresaModalOpen: (open: boolean) => void;
  atualizarEmpresaInfo: (dados: Partial<EmpresaInfo>) => Promise<boolean>;

  // Edição & Cadastro de Funcionários
  colaboradorParaEditar: Colaborador | null;
  openEditarFuncionarioModal: (colaborador: Colaborador) => void;
  closeCadastroModal: () => void;
  atualizarFuncionario: (id: string, dados: Partial<Colaborador>) => Promise<boolean>;
  excluirFuncionario: (id: string) => Promise<boolean>;

  // Edição & Cadastro de Condomínios
  condominioModal: { isOpen: boolean; condominio?: CondominioPosto; isNovo?: boolean } | null;
  openNovoCondominioModal: () => void;
  openEditarCondominioModal: (condominio: CondominioPosto) => void;
  closeCondominioModal: () => void;
  cadastrarCondominio: (dados: Partial<CondominioPosto> & { nome: string }) => Promise<boolean>;
  atualizarCondominio: (id: string, dados: Partial<CondominioPosto>) => Promise<boolean>;
  excluirCondominio: (id: string) => Promise<boolean>;

  // Ações Operacionais com Persistência
  substituirColaborador: (
    postoId: string,
    substitutoId: string,
    colaboradorFaltaId?: string,
    options?: {
      dataInicio?: string;
      dataFim?: string;
      horaInicio?: string;
      horaFim?: string;
      motivo?: string;
      alertaId?: string;
    }
  ) => Promise<boolean>;
  alocarColaborador: (postoId: string, colaboradorId: string, jornada: string) => Promise<boolean>;
  removerColaboradorDoPosto: (colaboradorId: string) => Promise<boolean>;
  resolverAlerta: (alertaId: string) => Promise<boolean>;
  criarOcorrencia: (dados: { postoId: string; tipo: Ocorrencia['tipo']; descricao: string; urgencia: Ocorrencia['urgencia'] }) => Promise<boolean>;
  aprovarAtestado: (atestadoId: string) => Promise<boolean>;
  recusarAtestado: (atestadoId: string) => Promise<boolean>;
  assinarHolerite: (holeriteId: string) => Promise<boolean>;
  cadastrarFuncionario: (dados: NovoFuncionarioPayload) => Promise<boolean>;
  registrarPonto: (dados: Partial<PontoRegistro> & { colaboradorId: string }) => Promise<boolean>;
  notificarTentativaForaPosto: (
    colaborador: Colaborador,
    posto: CondominioPosto,
    distanciaM: number,
    coords?: { latitude: number; longitude: number }
  ) => Promise<void>;
  notificarPontoOutroPostoCobertura: (
    colaborador: Colaborador,
    postoCadastrado: CondominioPosto,
    postoDetectado: CondominioPosto,
    distanciaM: number,
    coords?: { latitude: number; longitude: number },
    isProgramada?: boolean
  ) => Promise<void>;
  alertarPostoSemCoordenadas: (postosSemCoords: CondominioPosto[]) => Promise<void>;

  // Coberturas e Notificações
  criarCobertura: (input: Omit<CriarCoberturaInput, 'empresaId' | 'criadoPorNome'>) => Promise<{ success: boolean; message: string }>;
  responderCobertura: (cobertura: CoberturaProgramada, aceitar: boolean, motivoRecusa?: string) => Promise<{ success: boolean; message: string }>;
  alterarStatusCobertura: (cobertura: CoberturaProgramada, novoStatus: 'cancelada' | 'concluida' | 'aprovada', detalhes?: string) => Promise<{ success: boolean; message: string }>;
  marcarNotificacaoLida: (notificacaoId: string) => Promise<void>;
  registrarSolicitacaoCorrecao: (dados: {
    colaboradorId: string;
    colaboradorNome: string;
    dataPonto: string;
    tipoCorrecao: SolicitacaoCorrecaoPonto['tipoCorrecao'];
    justificativa: string;
  }) => Promise<{ success: boolean; message: string }>;
  revisarSolicitacaoCorrecao: (id: string, status: 'aprovado' | 'rejeitado', respostaRH: string) => Promise<boolean>;

  // Feedback toast
  toastMessage: string | null;
  showToast: (msg: string) => void;

  // Supabase sync
  syncWithSupabase: () => Promise<void>;
  isSyncing: boolean;
  authLoading: boolean;

  // Sessão e Autenticação
  currentUser: UsuarioAuth | null;
  setCurrentUser: (user: UsuarioAuth | null) => void;
  login: (emailOrCpf: string, senhaDigitada: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  trocarSenhaModalOpen: boolean;
  setTrocarSenhaModalOpen: (open: boolean) => void;
  trocarSenha: (senhaAtual: string, novaSenha: string) => Promise<{ success: boolean; message: string }>;

  // Gestão de Senha do Colaborador
  redefinirSenhaModalOpen: boolean;
  setRedefinirSenhaModalOpen: (open: boolean) => void;
  colaboradorParaRedefinirSenha: Colaborador | null;
  setColaboradorParaRedefinirSenha: (colab: Colaborador | null) => void;
  openRedefinirSenhaModal: (colab: Colaborador) => void;
  redefinirSenhaColaborador: (
    colaboradorId: string,
    novaSenha: string,
    supervisor?: { id: string; nome: string }
  ) => Promise<{ success: boolean; message: string }>;
  solicitarAjudaSenha: (
    identificador: string,
    contatoTelefone?: string,
    observacao?: string
  ) => Promise<{ success: boolean; message: string; colaboradorLocalizado?: Colaborador }>;
  ajudaAcessoModalOpen: boolean;
  setAjudaAcessoModalOpen: (open: boolean) => void;

  // Solicitações e Autorizações de Biometria Facial
  solicitacoesBiometria: SolicitacaoBiometriaFacial[];
  solicitarCadastroFacial: (
    colaborador: Colaborador,
    motivo: string,
    tipo?: 'primeiro_cadastro' | 'atualizacao_recadastro'
  ) => Promise<{ success: boolean; message: string }>;
  aprovarSolicitacaoBiometria: (
    solicitacaoId: string,
    supervisor?: UsuarioAuth | { id: string; nome: string },
    validadeHoras?: number
  ) => Promise<{ success: boolean; message: string }>;
  rejeitarSolicitacaoBiometria: (
    solicitacaoId: string,
    justificativa: string,
    supervisor?: UsuarioAuth | { id: string; nome: string }
  ) => Promise<{ success: boolean; message: string }>;
  obterAutorizacaoAtiva: (colaboradorId: string) => SolicitacaoBiometriaFacial | null;
  obterUltimaSolicitacao: (colaboradorId: string) => SolicitacaoBiometriaFacial | null;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<TabType>('operacao');
  const [selectedCondominioId, setSelectedCondominioId] = useState<string>('todos');

  const [condominios, setCondominios] = useState<CondominioPosto[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [alertas, setAlertas] = useState<AlertaOperacional[]>([]);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [holerites, setHolerites] = useState<HoleriteRegistro[]>([]);
  const [pontos, setPontos] = useState<PontoRegistro[]>([]);
  const [pontoEventos, setPontoEventos] = useState<PontoEvento[]>([]);
  const [atestados, setAtestados] = useState<AtestadoMedico[]>([]);
  const [empresaInfo, setEmpresaInfo] = useState<EmpresaInfo>(EMPTY_EMPRESA_INFO);

  const [coberturasProgramadas, setCoberturasProgramadas] = useState<CoberturaProgramada[]>([]);
  const [documentoSolicitacoes, setDocumentoSolicitacoes] = useState<DocumentoSolicitacao[]>([]);
  const [colaboradorDocumentos, setColaboradorDocumentos] = useState<ColaboradorDocumento[]>([]);
  const [documentoHistorico, setDocumentoHistorico] = useState<DocumentoHistorico[]>([]);
  const [holeriteLotes, setHoleriteLotes] = useState<HoleriteLote[]>([]);
  const [holeriteEventos, setHoleriteEventos] = useState<HoleriteEvento[]>([]);
  const [notificacoesSistema, setNotificacoesSistema] = useState<NotificacaoSistema[]>([]);
  const [solicitacoesCorrecao, setSolicitacoesCorrecao] = useState<SolicitacaoCorrecaoPonto[]>([]);

  const [solicitacoesBiometria, setSolicitacoesBiometria] = useState<SolicitacaoBiometriaFacial[]>(() => {
    try {
      const stored = getLocalSolicitacoesBiometria();
      return Array.isArray(stored) ? stored.filter((s) => s.id !== 'sbf-init-101') : [];
    } catch {
      return [];
    }
  });

  // Filter states
  const [filterEquipeStatus, setFilterEquipeStatus] = useState<string>('todos');
  const [filterEquipeFuncao, setFilterEquipeFuncao] = useState<string>('todas');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [selectedPostoFor360, setSelectedPostoFor360] = useState<CondominioPosto | null>(null);
  const [substituicaoModal, setSubstituicaoModal] = useState<{
    isOpen: boolean;
    posto?: CondominioPosto;
    colaboradorFalta?: Colaborador;
    alertaId?: string;
  } | null>(null);
  const [alocarModal, setAlocarModal] = useState<{ isOpen: boolean; posto?: CondominioPosto } | null>(null);
  const [escalaModal, setEscalaModal] = useState<{ isOpen: boolean; posto?: CondominioPosto } | null>(null);
  const [ocorrenciaModal, setOcorrenciaModal] = useState<{ isOpen: boolean; posto?: CondominioPosto } | null>(null);
  const [holeriteDetalhe, setHoleriteDetalhe] = useState<HoleriteRegistro | null>(null);
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);
  const [supabaseModalOpen, setSupabaseModalOpen] = useState(false);
  const [cadastroModalOpen, setCadastroModalOpen] = useState(false);
  const [colaboradorParaEditar, setColaboradorParaEditar] = useState<Colaborador | null>(null);
  const [empresaModalOpen, setEmpresaModalOpen] = useState(false);
  const [condominioModal, setCondominioModal] = useState<{
    isOpen: boolean;
    condominio?: CondominioPosto;
    isNovo?: boolean;
  } | null>(null);
  const [trocarSenhaModalOpen, setTrocarSenhaModalOpen] = useState(false);
  const [redefinirSenhaModalOpen, setRedefinirSenhaModalOpen] = useState(false);
  const [colaboradorParaRedefinirSenha, setColaboradorParaRedefinirSenha] = useState<Colaborador | null>(null);
  const [ajudaAcessoModalOpen, setAjudaAcessoModalOpen] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Authenticated user - Fonte única: Supabase Auth (Zero-Trust)
  const [currentUser, setCurrentUser] = useState<UsuarioAuth | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 4500);
  }, []);

  const syncSessionUser = useCallback(async (user: any) => {
    const supabase = getSupabase();
    if (!user || !supabase) {
      setCurrentUser(null);
      setAuthLoading(false);
      return;
    }

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .or(`auth_user_id.eq.${user.id},id.eq.${user.id}`)
        .maybeSingle();

      const { data: colabByAuth } = await supabase
        .from('colaboradores')
        .select('*')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      const colabId = profile?.colaborador_id || colabByAuth?.id || undefined;
      let colabData = colabByAuth;

      if (!colabData && profile?.colaborador_id) {
        const { data: cRow } = await supabase
          .from('colaboradores')
          .select('*')
          .eq('id', profile.colaborador_id)
          .maybeSingle();
        colabData = cRow;
      }

      const role = (profile?.role || colabData?.role || user.app_metadata?.role || 'funcionario') as UsuarioAuth['role'];
      const nome = colabData?.nome || profile?.full_name || profile?.nome || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuário';
      const cargo =
        colabData?.funcao ||
        profile?.cargo ||
        (role === 'admin'
          ? 'Administrador Geral'
          : role === 'supervisor'
          ? 'Supervisor Operacional'
          : role === 'rh'
          ? 'Recursos Humanos'
          : 'Colaborador');

      const authUser: UsuarioAuth = {
        id: user.id,
        nome,
        email: user.email || '',
        role,
        cargo,
        colaboradorId: colabId,
        avatarUrl: colabData?.foto_url || profile?.foto_url || user.user_metadata?.avatar_url,
        postoNome: colabData?.posto_nome || profile?.posto_nome,
      };

      setCurrentUser(authUser);
      if (role === 'rh') {
        setActiveTab('rh');
      }
    } catch (err) {
      console.warn('Erro ao carregar perfil autenticado do Supabase:', err);
      setCurrentUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setCurrentUser(null);
      setAuthLoading(false);
      return;
    }

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (session?.user) {
          syncSessionUser(session.user);
        } else {
          setCurrentUser(null);
          setAuthLoading(false);
        }
      })
      .catch(() => {
        setCurrentUser(null);
        setAuthLoading(false);
      });

    const { data: authSub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (session?.user) {
          await syncSessionUser(session.user);
        }
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setAuthLoading(false);
      }
    });

    return () => {
      authSub.subscription.unsubscribe();
    };
  }, [syncSessionUser]);

  useEffect(() => {
    if (selectedPostoFor360) {
      const updated = condominios.find((c) => c.id === selectedPostoFor360.id);
      if (updated) setSelectedPostoFor360(updated);
    }
  }, [condominios, selectedPostoFor360]);

  // Sincronização Bidirecional Completa com Supabase (executa quando há sessão ativa)
  const syncWithSupabase = useCallback(async () => {
    const client = getSupabase();
    if (!client || !currentUser) {
      return;
    }

    setIsSyncing(true);
    try {
      // Reenvia pontos offline pendentes com idempotência
      await syncPendingPontoEventos();

      // 1. Condomínios / Postos
      const { data: remoteCondos } = await client.from('condominios').select('*').order('nome');
      const condoMap = new Map<string, string>();
      if (Array.isArray(remoteCondos)) {
        const mappedCondos: CondominioPosto[] = remoteCondos.map((rc: any) => {
          condoMap.set(rc.id, rc.nome || 'Posto');
          return {
            id: rc.id,
            nome: rc.nome || 'Posto Sem Nome',
            tipo: rc.tipo || 'Residencial',
            cnpj: rc.cnpj || '',
            contratoNumero: rc.contrato_numero || '',
            endereco: rc.endereco || '',
            bairro: rc.bairro || '',
            cidade: rc.cidade || '',
            supervisor: rc.supervisor || '',
            telefoneSupervisor: rc.telefone_supervisor || '',
            vagasContratadas: Number(rc.vagas_contratadas) || 2,
            status: (rc.status as CondominioPosto['status']) || 'operacional',
            motivoAtencao: rc.motivo_atencao || undefined,
            tipoEscalaPadrao: rc.tipo_escala_padrao || '12x36 (07:00 - 19:00)',
            plantaoAtual: {
              operandoAgora: [],
              proximaRendicao: { colaboradorId: '', horarioTroca: '19:00' },
            },
            coberturaPercentual: Number(rc.cobertura_percentual ?? 100),
            contatoSindico: rc.contato_sindico || '',
            telefoneSindico: rc.telefone_sindico || '',
            instrucoesGuarita: rc.instrucoes_guarita || '',
            foto: rc.foto_url || undefined,
            ativo: rc.ativo !== false,
            latitude: rc.latitude !== null && rc.latitude !== undefined ? Number(rc.latitude) : rc.lat !== null && rc.lat !== undefined ? Number(rc.lat) : undefined,
            longitude: rc.longitude !== null && rc.longitude !== undefined ? Number(rc.longitude) : rc.lng !== null && rc.lng !== undefined ? Number(rc.lng) : undefined,
            raioGpsMetros: Number(rc.raio_gps_metros || rc.raio_tolerancia_metros || 150),
            icone: rc.icone || 'Building2',
            cor: rc.cor || '#3B82F6',
          };
        });
        setCondominios(mappedCondos);
      }

      // 2. Colaboradores (sem expor senha)
      const { data: remoteColabs } = await client.from('colaboradores').select('*').order('nome');
      if (Array.isArray(remoteColabs)) {
        setColaboradores(
          remoteColabs.map((rc: any) => ({
            id: rc.id,
            nome: rc.nome || rc.full_name || 'Colaborador',
            matricula: rc.matricula || `TC-${String(rc.id).slice(0, 4).toUpperCase()}`,
            funcao: rc.funcao || rc.cargo || 'Porteiro',
            condominioId: rc.condominio_id || null,
            postoNome: (rc.condominio_id && condoMap.get(rc.condominio_id)) || rc.posto_nome || 'Matriz - Reserva Central',
            status: (rc.status as Colaborador['status']) || 'no_posto',
            jornada: rc.jornada || (rc.tipo_jornada ? `${rc.tipo_jornada} (${rc.turno_inicio || '07:00'} - ${rc.turno_fim || '19:00'})` : '12x36 (07:00 - 19:00)'),
            tipoEscala: (rc.tipo_jornada as Colaborador['tipoEscala']) || '12x36',
            turno: rc.turno_inicio && parseInt(String(rc.turno_inicio), 10) >= 18 ? 'noturno' : 'diurno',
            foto: rc.foto_url || '',
            telefone: rc.telefone || '',
            cpf: rc.cpf || '',
            dataAdmissao: rc.data_admissao || '',
            bancoHoras: rc.banco_horas !== undefined ? Number(rc.banco_horas) : 0,
            ultimoPonto: rc.ultimo_ponto || '',
            salarioBase: Number(rc.salario_base) || 0,
            rg: rc.rg || undefined,
            dataNascimento: rc.data_nascimento || undefined,
            pis: rc.pis || undefined,
            ctps: rc.ctps || undefined,
            nomeMae: rc.nome_mae || undefined,
            endereco: rc.endereco || undefined,
            turnoInicio: rc.turno_inicio ? String(rc.turno_inicio).slice(0, 5) : undefined,
            turnoFim: rc.turno_fim ? String(rc.turno_fim).slice(0, 5) : undefined,
            pix: rc.pix || undefined,
            banco: rc.banco || undefined,
            agencia: rc.agencia || undefined,
            conta: rc.conta || undefined,
            recebeVT: rc.recebe_vt !== false,
            recebeVR: rc.recebe_vr !== false,
            valorVR: rc.valor_vr !== undefined && rc.valor_vr !== null ? Number(rc.valor_vr) : undefined,
            recebeVA: rc.recebe_va !== false,
            valorVA: rc.valor_va !== undefined && rc.valor_va !== null ? Number(rc.valor_va) : undefined,
            valorExtraFT: rc.valor_extra_ft !== undefined && rc.valor_extra_ft !== null ? Number(rc.valor_extra_ft) : undefined,
            valorBonus: rc.valor_bonus !== undefined && rc.valor_bonus !== null ? Number(rc.valor_bonus) : undefined,
            email: rc.email || undefined,
            role: (rc.role as Colaborador['role']) || 'funcionario',
            primeiroAcessoConcluido: Boolean(rc.primeiro_acesso_concluido),
          }))
        );
      }

      // 3. Empresa Matriz & Configurações
      const [{ data: remoteEmpresaInfo }, { data: remoteEmpresa }] = await Promise.all([
        client.from('empresa_info').select('*').limit(1).maybeSingle(),
        client.from('empresas').select('*').limit(1).maybeSingle(),
      ]);
      if (remoteEmpresaInfo || remoteEmpresa) {
        setEmpresaInfo((prev) => ({
          ...prev,
          id: remoteEmpresa?.id || remoteEmpresaInfo?.empresa_id || prev.id || 'emp-matriz-principal',
          razaoSocial: remoteEmpresaInfo?.razao_social || remoteEmpresa?.razao_social || prev.razaoSocial,
          nomeFantasia: remoteEmpresaInfo?.nome_fantasia || remoteEmpresa?.nome_fantasia || prev.nomeFantasia,
          cnpj: remoteEmpresaInfo?.cnpj || remoteEmpresa?.cnpj || prev.cnpj,
          inscricaoEstadual: remoteEmpresaInfo?.inscricao_estadual || '',
          inscricaoMunicipal: remoteEmpresaInfo?.inscricao_municipal || '',
          telefone: remoteEmpresaInfo?.telefone || prev.telefone,
          whatsapp: remoteEmpresaInfo?.whatsapp || prev.whatsapp,
          email: remoteEmpresaInfo?.email || prev.email,
          endereco: remoteEmpresaInfo?.endereco || prev.endereco,
          bairro: remoteEmpresaInfo?.bairro || prev.bairro,
          cidade: remoteEmpresaInfo?.cidade || prev.cidade,
          estado: remoteEmpresaInfo?.estado || prev.estado,
          cep: remoteEmpresaInfo?.cep || prev.cep,
          responsavelOperacional: remoteEmpresaInfo?.responsavel_operacional || prev.responsavelOperacional,
          cargoResponsavel: remoteEmpresaInfo?.cargo_responsavel || prev.cargoResponsavel,
          chavePix: remoteEmpresaInfo?.chave_pix || '',
          logoUrl: remoteEmpresaInfo?.logo_url || '',
          apresentacao: remoteEmpresaInfo?.apresentacao || '',
          maxGpsAccuracyM: remoteEmpresa?.max_gps_accuracy_m ? Number(remoteEmpresa.max_gps_accuracy_m) : prev.maxGpsAccuracyM || DEFAULT_MAX_ACCURACY_THRESHOLD_M,
          exigeAceiteCobertura: remoteEmpresa?.exige_aceite_cobertura !== undefined ? Boolean(remoteEmpresa.exige_aceite_cobertura) : false,
        }));
      }

      // 4. Pontos, Ponto Eventos, Ocorrências, Alertas, Atestados
      const [
        { data: remotePontos },
        { data: remotePontoEventos },
        { data: remoteOcorrs },
        { data: remoteAlertas },
        { data: remoteHolerites },
        { data: remoteAtestados },
        { data: remoteNotifs },
        { data: remoteCorrecoes },
      ] = await Promise.all([
        client.from('pontos').select('*').order('created_at', { ascending: false }).limit(200),
        client.from('ponto_eventos').select('*').order('server_timestamp', { ascending: false }).limit(200),
        client.from('ocorrencias').select('*').order('created_at', { ascending: false }).limit(200),
        client.from('alertas').select('*').order('created_at', { ascending: false }).limit(200),
        client.from('holerites').select('*').order('created_at', { ascending: false }),
        client.from('atestados').select('*').order('created_at', { ascending: false }),
        client.from('notificacoes_sistema').select('*').order('created_at', { ascending: false }).limit(150),
        client.from('solicitacoes_correcao_ponto').select('*').order('created_at', { ascending: false }).limit(150),
      ]);

      if (Array.isArray(remotePontos)) {
        setPontos(
          remotePontos.map((rp: any) => ({
            id: rp.id,
            colaboradorId: rp.colaborador_id,
            colaboradorNome: rp.colaborador_nome || 'Colaborador',
            data: rp.data || '',
            entrada1: rp.entrada_1 || '--:--',
            saida1: rp.saida_1 || '--:--',
            entrada2: rp.entrada_2 || '--:--',
            saida2: rp.saida_2 || '--:--',
            totalHoras: rp.total_horas || '--',
            statusPonto: rp.status_ponto || rp.status || 'Regular',
            localizacaoGPS: rp.localizacao_gps || '',
          }))
        );
      }

      if (Array.isArray(remotePontoEventos)) {
        setPontoEventos(
          remotePontoEventos.map((pe: any) => ({
            id: pe.id,
            colaboradorId: pe.colaborador_id,
            colaboradorNome: pe.colaborador_nome || 'Colaborador',
            authUserId: pe.auth_user_id || undefined,
            condominioId: pe.condominio_id || undefined,
            condominioNome: pe.condominio_nome || pe.posto_detectado_nome || 'Posto',
            postoNome: pe.posto_nome || pe.posto_detectado_nome || 'Posto',
            tipoEvento: pe.tipo_evento,
            labelEvento: pe.label_evento || pe.tipo_evento,
            serverTimestamp: pe.server_timestamp,
            latitude: pe.latitude !== null && pe.latitude !== undefined ? Number(pe.latitude) : undefined,
            longitude: pe.longitude !== null && pe.longitude !== undefined ? Number(pe.longitude) : undefined,
            accuracyM: pe.accuracy_m !== null && pe.accuracy_m !== undefined ? Number(pe.accuracy_m) : undefined,
            accuracyRealM: pe.accuracy_real_m !== null && pe.accuracy_real_m !== undefined ? Number(pe.accuracy_real_m) : undefined,
            geofenceStatus: pe.geofence_status,
            decisaoGeofence: pe.decisao_geofence || pe.geofence_status,
            distanceM: pe.distance_m !== null && pe.distance_m !== undefined ? Number(pe.distance_m) : undefined,
            credentialId: pe.credential_id || undefined,
            fotoBiometriaUrl: pe.foto_biometria_url || undefined,
            metodoAutenticacao: pe.metodo_autenticacao || 'biometria_facial',
            verificationStatus: pe.verification_status || 'confirmado',
            classificacaoPosto: pe.classificacao_posto || 'posto_regular',
            postoBaseId: pe.posto_base_id || undefined,
            postoDetectadoId: pe.posto_detectado_id || undefined,
            coverageAssignmentId: pe.coverage_assignment_id || undefined,
            ambiguidadeDetectada: Boolean(pe.ambiguidade_detectada),
            idempotencyKey: pe.idempotency_key || pe.id,
            comprovanteNumero: pe.comprovante_numero || pe.id,
            motivoExcecao: pe.motivo_excecao || undefined,
            isCobertura: pe.classificacao_posto && pe.classificacao_posto !== 'posto_regular',
            criadoEm: pe.criado_em || pe.created_at || pe.server_timestamp,
          }))
        );
      }

      if (Array.isArray(remoteOcorrs)) {
        setOcorrencias(
          remoteOcorrs.map((ro: any) => ({
            id: ro.id,
            postoId: ro.posto_id || '',
            postoNome: ro.posto_nome || 'Posto',
            tipo: ro.tipo || 'Ronda',
            descricao: ro.descricao || '',
            registradoPor: ro.registrado_por || '',
            dataHora: ro.data_hora || '',
            urgencia: ro.urgencia || 'media',
            resolvida: Boolean(ro.resolvida),
          }))
        );
      }

      if (Array.isArray(remoteAlertas)) {
        setAlertas(
          remoteAlertas.map((ra: any) => ({
            id: ra.id,
            tipo: ra.tipo || 'posto_descoberto',
            gravidade: ra.gravidade || 'moderada',
            titulo: ra.titulo || '',
            descricao: ra.descricao || '',
            postoId: ra.posto_id || '',
            postoNome: ra.posto_nome || '',
            colaboradorId: ra.colaborador_id || undefined,
            colaboradorNome: ra.colaborador_nome || undefined,
            horario: ra.horario || '',
            resolvido: Boolean(ra.resolvido),
            resolvidoPor: ra.resolvido_por || undefined,
            resolvidoEm: ra.resolvido_em || undefined,
          }))
        );
      }

      if (Array.isArray(remoteHolerites)) {
        setHolerites((remoteHolerites as Record<string, unknown>[]).map(mapHoleriteRow));
      }

      if (Array.isArray(remoteAtestados)) {
        setAtestados(
          remoteAtestados.map((ra: any) => ({
            id: ra.id,
            colaboradorId: ra.colaborador_id,
            colaboradorNome: ra.colaborador_nome,
            matricula: ra.matricula || '',
            postoNome: ra.posto_nome || '',
            medico: ra.medico || '',
            crm: ra.crm || '',
            cid: ra.cid || '',
            dataInicio: ra.data_inicio || '',
            diasAfastamento: Number(ra.dias_afastamento) || 1,
            status: ra.status || 'Pendente',
            substitutoAlocadoId: ra.substituto_alocado_id || undefined,
            anexoUrl: ra.anexo_url || undefined,
          }))
        );
      }

      if (Array.isArray(remoteNotifs)) {
        setNotificacoesSistema(
          remoteNotifs.map((n: any) => ({
            id: n.id,
            empresaId: n.empresa_id || 'emp-matriz-principal',
            destinatarioColaboradorId: n.destinatario_colaborador_id || null,
            destinatarioRole: n.destinatario_role || null,
            categoria: n.categoria || 'sistema',
            titulo: n.titulo,
            mensagem: n.mensagem,
            referenciaTipo: n.referencia_tipo || undefined,
            referenciaId: n.referencia_id || undefined,
            linkDestino: n.link_destino || undefined,
            lida: Boolean(n.lida),
            lidaEm: n.lida_em || null,
            createdAt: n.created_at,
          }))
        );
      }

      if (Array.isArray(remoteCorrecoes)) {
        setSolicitacoesCorrecao(
          remoteCorrecoes.map((c: any) => ({
            id: c.id,
            colaboradorId: c.colaborador_id,
            colaboradorNome: c.colaborador_nome || 'Colaborador',
            dataPonto: c.data_ponto || '',
            tipoCorrecao: c.tipo_correcao || 'divergencia_horario',
            justificativa: c.justificativa || '',
            status: c.status || 'pendente',
            criadoEm: c.created_at || new Date().toISOString(),
            respostaRH: c.resposta_rh || undefined,
          }))
        );
      }

      // 5. Fluxos de Coberturas, Documentos e Lotes de Holerites
      const colabFilter = currentUser.role === 'funcionario' ? currentUser.colaboradorId : undefined;
      const [covs, docReqs, docs, docHist, lotes, holEvs] = await Promise.all([
        fetchCoberturas(colabFilter),
        fetchDocumentoSolicitacoes(colabFilter),
        fetchColaboradorDocumentos(colabFilter),
        fetchDocumentoHistorico(colabFilter),
        currentUser.role !== 'funcionario' ? fetchHoleriteLotes() : Promise.resolve([]),
        currentUser.role !== 'funcionario' ? fetchHoleriteEventos() : Promise.resolve([]),
      ]);

      setCoberturasProgramadas(covs);
      setDocumentoSolicitacoes(docReqs);
      setColaboradorDocumentos(docs);
      setDocumentoHistorico(docHist);
      if (currentUser.role !== 'funcionario') {
        setHoleriteLotes(lotes);
        setHoleriteEventos(holEvs);
      }
    } catch (err) {
      console.warn('Sync com Supabase finalizado com avisos:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      syncWithSupabase();
    }
  }, [currentUser?.id, syncWithSupabase]);

  // Modal Openers
  const openPosto360 = (postoOrId: CondominioPosto | string) => {
    if (typeof postoOrId === 'string') {
      const found = condominios.find((c) => c.id === postoOrId);
      if (found) setSelectedPostoFor360(found);
    } else {
      setSelectedPostoFor360(postoOrId);
    }
  };
  const closePosto360 = () => setSelectedPostoFor360(null);

  const openSubstituicaoModal = (posto?: CondominioPosto, colaboradorFalta?: Colaborador, alertaId?: string) => {
    setSubstituicaoModal({ isOpen: true, posto, colaboradorFalta, alertaId });
  };
  const closeSubstituicaoModal = () => setSubstituicaoModal(null);

  const openAlocarModal = (posto?: CondominioPosto) => setAlocarModal({ isOpen: true, posto });
  const closeAlocarModal = () => setAlocarModal(null);

  const openEscalaModal = (posto?: CondominioPosto) => setEscalaModal({ isOpen: true, posto });
  const closeEscalaModal = () => setEscalaModal(null);

  const openOcorrenciaModal = (posto?: CondominioPosto) => setOcorrenciaModal({ isOpen: true, posto });
  const closeOcorrenciaModal = () => setOcorrenciaModal(null);

  const openHoleriteDetalhe = (holerite: HoleriteRegistro) => setHoleriteDetalhe(holerite);
  const closeHoleriteDetalhe = () => setHoleriteDetalhe(null);

  const openEditarFuncionarioModal = (colaborador: Colaborador) => {
    setColaboradorParaEditar(colaborador);
    setCadastroModalOpen(true);
  };
  const closeCadastroModal = () => {
    setColaboradorParaEditar(null);
    setCadastroModalOpen(false);
  };

  const openNovoCondominioModal = () => setCondominioModal({ isOpen: true, isNovo: true });
  const openEditarCondominioModal = (condominio: CondominioPosto) =>
    setCondominioModal({ isOpen: true, condominio, isNovo: false });
  const closeCondominioModal = () => setCondominioModal(null);

  const actorName = currentUser?.nome || 'Gestão Operacional';

  // 1. Resolver Alerta Operacional (apenas o alerta alvo)
  const resolverAlerta = async (alertaId: string): Promise<boolean> => {
    const resolvidoEmHora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    setAlertas((prev) =>
      prev.map((alerta) =>
        alerta.id === alertaId
          ? { ...alerta, resolvido: true, resolvidoPor: actorName, resolvidoEm: resolvidoEmHora }
          : alerta
      )
    );

    const client = getSupabase();
    if (client) {
      await client
        .from('alertas')
        .update({
          resolvido: true,
          resolvido_por: actorName,
          resolvido_em: resolvidoEmHora,
          updated_at: new Date().toISOString(),
        })
        .eq('id', alertaId);
    }

    showToast('Alerta marcado como resolvido.');
    return true;
  };

  // 2. Substituir Colaborador (Emergencial — NUNCA altera colaboradores.condominio_id!)
  const substituirColaborador = async (
    postoId: string,
    substitutoId: string,
    colaboradorFaltaId?: string,
    options?: {
      dataInicio?: string;
      dataFim?: string;
      horaInicio?: string;
      horaFim?: string;
      motivo?: string;
      alertaId?: string;
    }
  ): Promise<boolean> => {
    const posto = condominios.find((c) => c.id === postoId);
    const substituto = colaboradores.find((c) => c.id === substitutoId);

    if (!posto || !substituto) {
      showToast('Erro: Posto ou substituto não encontrado.');
      return false;
    }

    const todayBR = new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const dataInicio = options?.dataInicio || todayBR;
    const dataFim = options?.dataFim || dataInicio;
    const horaInicio = options?.horaInicio || substituto.turnoInicio || '07:00';
    const horaFim = options?.horaFim || substituto.turnoFim || '19:00';
    const motivo =
      options?.motivo ||
      `Substituição emergencial em ${posto.nome}${colaboradorFaltaId ? ' por falta no turno' : ''}.`;

    const targetAlertId =
      options?.alertaId ||
      alertas.find(
        (a) =>
          !a.resolvido &&
          a.postoId === postoId &&
          (colaboradorFaltaId ? a.colaboradorId === colaboradorFaltaId : a.tipo === 'posto_descoberto' || a.tipo === 'falta')
      )?.id;

    const client = getSupabase();
    if (client) {
      const { data: rpcRes, error: rpcErr } = await client.rpc('registrar_substituicao_emergencial', {
        p_posto_id: postoId,
        p_substituto_id: substitutoId,
        p_colaborador_falta_id: colaboradorFaltaId || null,
        p_alerta_id: targetAlertId || null,
        p_data_inicio: dataInicio,
        p_data_fim: dataFim,
        p_hora_inicio: horaInicio,
        p_hora_fim: horaFim,
        p_motivo: motivo,
      });

      if (rpcErr) {
        showToast(`Falha ao registrar substituição: ${rpcErr.message}`);
        return false;
      }

      await syncWithSupabase();
      closeSubstituicaoModal();
      showToast(`Substituição temporária registrada para ${substituto.nome} em ${posto.nome} (lotação base preservada).`);
      void rpcRes;
      return true;
    }

    // Fallback sem Supabase
    const covRes = await criarCoberturaProgramada(
      {
        empresaId: empresaInfo.id || 'emp-matriz-principal',
        colaborador: substituto,
        postoCobertura: posto,
        tipo: 'substituicao',
        dataInicio,
        dataFim,
        horaInicio,
        horaFim,
        motivo,
        substituidoColaboradorId: colaboradorFaltaId,
        alertaOrigemId: targetAlertId,
        criadoPorNome: actorName,
      },
      coberturasProgramadas
    );

    if (!covRes.success || !covRes.cobertura) {
      showToast(covRes.message);
      return false;
    }

    setCoberturasProgramadas((prev) => [covRes.cobertura!, ...prev]);
    if (colaboradorFaltaId) {
      setColaboradores((prev) =>
        prev.map((c) => (c.id === colaboradorFaltaId ? { ...c, status: 'falta', motivoStatus: 'Falta no turno - Coberto temporariamente' } : c))
      );
    }
    if (targetAlertId) {
      const agoraHora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      setAlertas((prev) =>
        prev.map((a) => (a.id === targetAlertId ? { ...a, resolvido: true, resolvidoPor: actorName, resolvidoEm: agoraHora } : a))
      );
    }

    closeSubstituicaoModal();
    showToast(`Substituição temporária registrada para ${substituto.nome} (posto habitual preservado).`);
    return true;
  };

  // 3. Alocar Colaborador em Posto (Ação Administrativa Explícita)
  const alocarColaborador = async (postoId: string, colaboradorId: string, jornada: string): Promise<boolean> => {
    const posto = condominios.find((c) => c.id === postoId);
    const colab = colaboradores.find((c) => c.id === colaboradorId);
    if (!posto || !colab) return false;

    setColaboradores((prev) =>
      prev.map((c) =>
        c.id === colaboradorId
          ? { ...c, condominioId: posto.id, postoNome: posto.nome, jornada: jornada || c.jornada, status: 'no_posto', motivoStatus: undefined }
          : c
      )
    );

    const client = getSupabase();
    if (client) {
      await client
        .from('colaboradores')
        .update({
          condominio_id: posto.id,
          jornada: jornada || colab.jornada,
          status: 'no_posto',
          updated_at: new Date().toISOString(),
        })
        .eq('id', colaboradorId);
    }

    closeAlocarModal();
    showToast(`${colab.nome} alocado em ${posto.nome}.`);
    return true;
  };

  // 4. Desvincular Colaborador do Posto (Ação Administrativa Explícita)
  const removerColaboradorDoPosto = async (colaboradorId: string): Promise<boolean> => {
    const colab = colaboradores.find((c) => c.id === colaboradorId);
    if (!colab) return false;

    setColaboradores((prev) =>
      prev.map((c) =>
        c.id === colaboradorId
          ? { ...c, condominioId: null, postoNome: 'Matriz - Reserva Central', status: 'folga', motivoStatus: 'Disponível na Base Reserva' }
          : c
      )
    );

    const client = getSupabase();
    if (client) {
      await client
        .from('colaboradores')
        .update({ condominio_id: null, status: 'folga', updated_at: new Date().toISOString() })
        .eq('id', colaboradorId);
    }

    showToast(`${colab.nome} transferido para a Reserva.`);
    return true;
  };

  // 5. Criar Ocorrência
  const criarOcorrencia = async (dados: {
    postoId: string;
    tipo: Ocorrencia['tipo'];
    descricao: string;
    urgencia: Ocorrencia['urgencia'];
  }): Promise<boolean> => {
    const posto = condominios.find((c) => c.id === dados.postoId);
    const nova: Ocorrencia = {
      id: generateSafeId('ocorr'),
      postoId: dados.postoId,
      postoNome: posto ? posto.nome : 'Posto Geral',
      tipo: dados.tipo,
      descricao: dados.descricao,
      registradoPor: actorName,
      dataHora: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      urgencia: dados.urgencia,
      resolvida: false,
    };

    setOcorrencias((prev) => [nova, ...prev]);

    const client = getSupabase();
    if (client) {
      await client.from('ocorrencias').insert({
        id: nova.id,
        empresa_id: empresaInfo.id || 'emp-matriz-principal',
        posto_id: nova.postoId || null,
        posto_nome: nova.postoNome,
        tipo: nova.tipo,
        descricao: nova.descricao,
        registrado_por: nova.registradoPor,
        data_hora: nova.dataHora,
        urgencia: nova.urgencia,
        resolvida: false,
      });
    }

    closeOcorrenciaModal();
    showToast('Ocorrência operacional registrada.');
    return true;
  };

  // 6/7. Atestados Médicos
  const aprovarAtestado = async (atestadoId: string): Promise<boolean> => {
    setAtestados((prev) => prev.map((a) => (a.id === atestadoId ? { ...a, status: 'Aprovado' } : a)));
    const client = getSupabase();
    if (client) {
      await client.from('atestados').update({ status: 'Aprovado', updated_at: new Date().toISOString() }).eq('id', atestadoId);
    }
    showToast('Atestado médico aprovado.');
    return true;
  };

  const recusarAtestado = async (atestadoId: string): Promise<boolean> => {
    setAtestados((prev) => prev.map((a) => (a.id === atestadoId ? { ...a, status: 'Recusado' } : a)));
    const client = getSupabase();
    if (client) {
      await client.from('atestados').update({ status: 'Recusado', updated_at: new Date().toISOString() }).eq('id', atestadoId);
    }
    showToast('Atestado médico recusado.');
    return true;
  };

  // 8. Holerite ciência fallback
  const assinarHolerite = async (holeriteId: string): Promise<boolean> => {
    setHolerites((prev) =>
      prev.map((h) =>
        h.id === holeriteId
          ? { ...h, statusEnvio: 'Assinado', cienciaConfirmadaEm: new Date().toISOString() }
          : h
      )
    );
    return true;
  };

  // 9. Espelho consolidado de ponto (pontos)
  const registrarPonto = async (dados: Partial<PontoRegistro> & { colaboradorId: string }): Promise<boolean> => {
    const colab = colaboradores.find((c) => c.id === dados.colaboradorId);
    const dataHoje = dados.data || new Date().toISOString().split('T')[0];
    const novoPonto: PontoRegistro = {
      id: generateSafeId('ponto'),
      colaboradorId: dados.colaboradorId,
      colaboradorNome: colab?.nome || dados.colaboradorNome || 'Colaborador',
      data: dataHoje,
      entrada1: dados.entrada1 || '--:--',
      saida1: dados.saida1 || '--:--',
      entrada2: dados.entrada2 || '--:--',
      saida2: dados.saida2 || '--:--',
      totalHoras: dados.totalHoras || '--',
      statusPonto: dados.statusPonto || 'Regular',
      localizacaoGPS: dados.localizacaoGPS || '',
    };

    setPontos((prev) => [novoPonto, ...prev]);

    const client = getSupabase();
    if (client) {
      const { data: existingRows } = await client
        .from('pontos')
        .select('id')
        .eq('colaborador_id', novoPonto.colaboradorId)
        .eq('data', dataHoje)
        .limit(1);

      if (existingRows && existingRows.length > 0) {
        await client
          .from('pontos')
          .update({
            entrada_1: novoPonto.entrada1,
            saida_1: novoPonto.saida1,
            entrada_2: novoPonto.entrada2,
            saida_2: novoPonto.saida2,
            total_horas: novoPonto.totalHoras,
            status_ponto: novoPonto.statusPonto,
            status: novoPonto.statusPonto,
            localizacao_gps: novoPonto.localizacaoGPS,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingRows[0].id);
      } else {
        await client.from('pontos').insert({
          id: novoPonto.id,
          empresa_id: empresaInfo.id || 'emp-matriz-principal',
          colaborador_id: novoPonto.colaboradorId,
          colaborador_nome: novoPonto.colaboradorNome,
          data: novoPonto.data,
          entrada_1: novoPonto.entrada1,
          saida_1: novoPonto.saida1,
          entrada_2: novoPonto.entrada2,
          saida_2: novoPonto.saida2,
          total_horas: novoPonto.totalHoras,
          status_ponto: novoPonto.statusPonto,
          status: novoPonto.statusPonto,
          localizacao_gps: novoPonto.localizacaoGPS,
        });
      }
    }

    return true;
  };

  // 10. Atualizar Empresa (incluindo maxGpsAccuracyM e exigeAceiteCobertura)
  const atualizarEmpresaInfo = async (dados: Partial<EmpresaInfo>): Promise<boolean> => {
    const updated = { ...empresaInfo, ...dados };
    setEmpresaInfo(updated);

    const client = getSupabase();
    if (client) {
      await client.from('empresa_info').upsert({
        id: 'matriz-principal',
        empresa_id: updated.id || 'emp-matriz-principal',
        razao_social: updated.razaoSocial,
        nome_fantasia: updated.nomeFantasia,
        cnpj: updated.cnpj,
        inscricao_estadual: updated.inscricaoEstadual || null,
        inscricao_municipal: updated.inscricaoMunicipal || null,
        telefone: updated.telefone,
        whatsapp: updated.whatsapp,
        email: updated.email,
        endereco: updated.endereco,
        bairro: updated.bairro,
        cidade: updated.cidade,
        estado: updated.estado,
        cep: updated.cep,
        responsavel_operacional: updated.responsavelOperacional,
        cargo_responsavel: updated.cargoResponsavel,
        chave_pix: updated.chavePix || null,
        logo_url: updated.logoUrl || null,
        apresentacao: updated.apresentacao || null,
        updated_at: new Date().toISOString(),
      });

      if (updated.id) {
        await client
          .from('empresas')
          .update({
            razao_social: updated.razaoSocial,
            nome_fantasia: updated.nomeFantasia,
            cnpj: updated.cnpj,
            max_gps_accuracy_m: Math.max(10, Math.min(500, Number(updated.maxGpsAccuracyM) || DEFAULT_MAX_ACCURACY_THRESHOLD_M)),
            exige_aceite_cobertura: Boolean(updated.exigeAceiteCobertura),
            updated_at: new Date().toISOString(),
          })
          .eq('id', updated.id);
      }
    }

    showToast('Configurações da empresa atualizadas.');
    setEmpresaModalOpen(false);
    return true;
  };

  // 11. Cadastrar Funcionário (sem senha em texto claro na tabela)
  const cadastrarFuncionario = async (dados: NovoFuncionarioPayload): Promise<boolean> => {
    const condom = condominios.find((c) => c.id === dados.condominioId);
    const postoNome = condom ? condom.nome : 'Matriz - Reserva Central';
    const newId = generateSafeId('colab');
    const randomMatricula = `TC-${Math.floor(1150 + Math.random() * 850)}`;
    const jornadaDesc = `${dados.regimeEscala} (${dados.turnoInicio || '07:00'} - ${dados.turnoFim || '19:00'})`;
    const horaInicioNum = dados.turnoInicio ? parseInt(dados.turnoInicio.split(':')[0], 10) : 7;
    const turnoTipo: 'diurno' | 'noturno' | 'comercial' =
      horaInicioNum >= 18 || horaInicioNum < 5 ? 'noturno' : dados.regimeEscala === '6x1' ? 'comercial' : 'diurno';

    const novoColaborador: Colaborador = {
      id: newId,
      nome: dados.nome,
      matricula: randomMatricula,
      funcao: dados.cargo,
      condominioId: dados.condominioId || null,
      postoNome,
      status: 'no_posto',
      jornada: jornadaDesc,
      tipoEscala: dados.regimeEscala,
      turno: turnoTipo,
      foto: dados.foto || '',
      telefone: dados.telefone,
      cpf: dados.cpf,
      dataAdmissao: dados.dataAdmissao || new Date().toISOString().split('T')[0],
      bancoHoras: 0,
      ultimoPonto: '',
      salarioBase: Number(dados.salarioBase) || 2150,
      rg: dados.rg,
      dataNascimento: dados.dataNascimento,
      pis: dados.pis,
      ctps: dados.ctps,
      nomeMae: dados.nomeMae,
      endereco: dados.endereco,
      turnoInicio: dados.turnoInicio,
      turnoFim: dados.turnoFim,
      pix: dados.pix,
      banco: dados.banco,
      agencia: dados.agencia,
      conta: dados.conta,
      recebeVT: dados.recebeVT,
      recebeVR: dados.recebeVR,
      valorVR: dados.valorVR,
      recebeVA: dados.recebeVA,
      valorVA: dados.valorVA,
      valorExtraFT: dados.valorExtraFT,
      valorBonus: dados.valorBonus,
      email: dados.email || undefined,
      role: dados.role || 'funcionario',
      primeiroAcessoConcluido: false,
    };

    setColaboradores((prev) => [novoColaborador, ...prev]);

    const client = getSupabase();
    if (client) {
      const { error } = await client.from('colaboradores').upsert({
        id: newId,
        empresa_id: empresaInfo.id || 'emp-matriz-principal',
        nome: dados.nome,
        full_name: dados.nome,
        matricula: randomMatricula,
        funcao: dados.cargo,
        cargo: dados.cargo,
        condominio_id: dados.condominioId || null,
        status: 'no_posto',
        jornada: jornadaDesc,
        tipo_jornada: dados.regimeEscala,
        turno_inicio: dados.turnoInicio || '07:00:00',
        turno_fim: dados.turnoFim || '19:00:00',
        data_admissao: dados.dataAdmissao || new Date().toISOString().split('T')[0],
        salario_base: Number(dados.salarioBase) || 2150,
        banco_horas: 0,
        cpf: dados.cpf || null,
        rg: dados.rg || null,
        data_nascimento: dados.dataNascimento || null,
        telefone: dados.telefone || null,
        pis: dados.pis || null,
        ctps: dados.ctps || null,
        nome_mae: dados.nomeMae || null,
        endereco: dados.endereco || null,
        pix: dados.pix || null,
        banco: dados.banco || null,
        agencia: dados.agencia || null,
        conta: dados.conta || null,
        recebe_vt: dados.recebeVT !== false,
        recebe_vr: dados.recebeVR !== false,
        valor_vr: dados.valorVR !== undefined ? Number(dados.valorVR) : 28.5,
        recebe_va: dados.recebeVA !== false,
        valor_va: dados.valorVA !== undefined ? Number(dados.valorVA) : 220.0,
        valor_extra_ft: dados.valorExtraFT !== undefined ? Number(dados.valorExtraFT) : 160.0,
        valor_bonus: dados.valorBonus !== undefined ? Number(dados.valorBonus) : 0.0,
        foto_url: dados.foto || null,
        email: dados.email || null,
        role: dados.role || 'funcionario',
        primeiro_acesso_concluido: false,
        updated_at: new Date().toISOString(),
      });
      if (error) {
        showToast(`Aviso ao salvar no Supabase: ${error.message}`);
      }
    }

    showToast(`Colaborador ${dados.nome} cadastrado.`);
    closeCadastroModal();
    return true;
  };

  // 12. Atualizar Funcionário (sem campo senha)
  const atualizarFuncionario = async (id: string, dados: Partial<Colaborador>): Promise<boolean> => {
    const colabAtual = colaboradores.find((c) => c.id === id);
    if (!colabAtual) return false;

    const novoCondominioId = dados.condominioId !== undefined ? dados.condominioId : colabAtual.condominioId;
    const condom = condominios.find((c) => c.id === novoCondominioId);
    const postoNome = condom ? condom.nome : novoCondominioId ? colabAtual.postoNome : 'Matriz - Reserva Central';

    setColaboradores((prev) => prev.map((c) => (c.id === id ? { ...c, ...dados, postoNome } : c)));

    const client = getSupabase();
    if (client) {
      const payloadToUpdate: Record<string, any> = { updated_at: new Date().toISOString() };
      if (dados.nome !== undefined) {
        payloadToUpdate.nome = dados.nome;
        payloadToUpdate.full_name = dados.nome;
      }
      if (dados.cpf !== undefined) payloadToUpdate.cpf = dados.cpf;
      if (dados.rg !== undefined) payloadToUpdate.rg = dados.rg;
      if (dados.dataNascimento !== undefined) payloadToUpdate.data_nascimento = dados.dataNascimento;
      if (dados.telefone !== undefined) payloadToUpdate.telefone = dados.telefone;
      if (dados.pis !== undefined) payloadToUpdate.pis = dados.pis;
      if (dados.ctps !== undefined) payloadToUpdate.ctps = dados.ctps;
      if (dados.nomeMae !== undefined) payloadToUpdate.nome_mae = dados.nomeMae;
      if (dados.endereco !== undefined) payloadToUpdate.endereco = dados.endereco;
      if (dados.funcao !== undefined) {
        payloadToUpdate.cargo = dados.funcao;
        payloadToUpdate.funcao = dados.funcao;
      }
      if (dados.tipoEscala !== undefined) {
        payloadToUpdate.tipo_jornada = dados.tipoEscala;
        payloadToUpdate.jornada = `${dados.tipoEscala} (${dados.turnoInicio || colabAtual.turnoInicio || '07:00'} - ${dados.turnoFim || colabAtual.turnoFim || '19:00'})`;
      }
      if (dados.turnoInicio !== undefined) payloadToUpdate.turno_inicio = dados.turnoInicio;
      if (dados.turnoFim !== undefined) payloadToUpdate.turno_fim = dados.turnoFim;
      if (dados.salarioBase !== undefined) payloadToUpdate.salario_base = Number(dados.salarioBase);
      if (dados.status !== undefined) payloadToUpdate.status = dados.status;
      if (dados.pix !== undefined) payloadToUpdate.pix = dados.pix;
      if (dados.banco !== undefined) payloadToUpdate.banco = dados.banco;
      if (dados.agencia !== undefined) payloadToUpdate.agencia = dados.agencia;
      if (dados.conta !== undefined) payloadToUpdate.conta = dados.conta;
      if (dados.recebeVT !== undefined) payloadToUpdate.recebe_vt = dados.recebeVT;
      if (dados.recebeVR !== undefined) payloadToUpdate.recebe_vr = dados.recebeVR;
      if (dados.valorVR !== undefined) payloadToUpdate.valor_vr = Number(dados.valorVR);
      if (dados.recebeVA !== undefined) payloadToUpdate.recebe_va = dados.recebeVA;
      if (dados.valorVA !== undefined) payloadToUpdate.valor_va = Number(dados.valorVA);
      if (dados.valorExtraFT !== undefined) payloadToUpdate.valor_extra_ft = Number(dados.valorExtraFT);
      if (dados.valorBonus !== undefined) payloadToUpdate.valor_bonus = Number(dados.valorBonus);
      if (dados.email !== undefined) payloadToUpdate.email = dados.email || null;
      if (dados.role !== undefined) payloadToUpdate.role = dados.role;
      if (dados.foto !== undefined) payloadToUpdate.foto_url = dados.foto;
      if (novoCondominioId !== undefined) payloadToUpdate.condominio_id = novoCondominioId || null;

      await client.from('colaboradores').update(payloadToUpdate).eq('id', id);
      if (isValidUUID(id)) {
        const profileUpd = { ...payloadToUpdate };
        if (profileUpd.condominio_id && !isValidUUID(profileUpd.condominio_id)) {
          profileUpd.condominio_id = null;
        }
        await client.from('profiles').update(profileUpd).eq('colaborador_id', id);
      }
    }

    showToast(`Colaborador ${dados.nome || colabAtual.nome} atualizado.`);
    closeCadastroModal();
    return true;
  };

  // 13. Excluir Funcionário
  const excluirFuncionario = async (id: string): Promise<boolean> => {
    const colab = colaboradores.find((c) => c.id === id);
    if (!colab) return false;
    setColaboradores((prev) => prev.filter((c) => c.id !== id));

    const client = getSupabase();
    if (client) {
      await client.from('colaboradores').delete().eq('id', id);
    }

    showToast(`Colaborador ${colab.nome} removido.`);
    return true;
  };

  // 14. Cadastrar Condomínio (permite latitude/longitude null sem fallback fictício)
  const cadastrarCondominio = async (dados: Partial<CondominioPosto> & { nome: string }): Promise<boolean> => {
    const newId = generateSafeId('cond');
    const hasCoords =
      typeof dados.latitude === 'number' &&
      Number.isFinite(dados.latitude) &&
      typeof dados.longitude === 'number' &&
      Number.isFinite(dados.longitude);

    const novoCondo: CondominioPosto = {
      id: newId,
      nome: dados.nome,
      tipo: dados.tipo || 'Residencial',
      cnpj: dados.cnpj || '',
      contratoNumero: dados.contratoNumero || '',
      endereco: dados.endereco || '',
      bairro: dados.bairro || '',
      cidade: dados.cidade || '',
      cep: dados.cep || '',
      supervisor: dados.supervisor || actorName,
      telefoneSupervisor: dados.telefoneSupervisor || '',
      vagasContratadas: Number(dados.vagasContratadas) || 2,
      status: dados.status || 'operacional',
      motivoAtencao: dados.motivoAtencao,
      tipoEscalaPadrao: dados.tipoEscalaPadrao || '12x36 (07:00 - 19:00)',
      plantaoAtual: { operandoAgora: [], proximaRendicao: { colaboradorId: '', horarioTroca: '19:00' } },
      coberturaPercentual: 100,
      contatoSindico: dados.contatoSindico || '',
      telefoneSindico: dados.telefoneSindico || '',
      instrucoesGuarita: dados.instrucoesGuarita || '',
      foto: dados.foto || undefined,
      ativo: dados.ativo !== false,
      icone: dados.icone || 'Building2',
      cor: dados.cor || '#3B82F6',
      latitude: hasCoords ? dados.latitude : undefined,
      longitude: hasCoords ? dados.longitude : undefined,
      raioGpsMetros: dados.raioGpsMetros !== undefined ? dados.raioGpsMetros : 150,
      metodoCalibracaoGps: dados.metodoCalibracaoGps || 'manual',
      calibradoEm: hasCoords ? dados.calibradoEm || new Date().toISOString() : undefined,
      calibradoPrecisaoM: dados.calibradoPrecisaoM,
    };

    setCondominios((prev) => [novoCondo, ...prev]);

    const client = getSupabase();
    if (client) {
      await client.from('condominios').upsert({
        id: newId,
        empresa_id: empresaInfo.id || 'emp-matriz-principal',
        nome: novoCondo.nome,
        tipo: novoCondo.tipo,
        cnpj: novoCondo.cnpj || null,
        contrato_numero: novoCondo.contratoNumero || null,
        endereco: novoCondo.endereco || 'Não informado',
        bairro: novoCondo.bairro || 'Centro',
        cidade: novoCondo.cidade || '',
        supervisor: novoCondo.supervisor,
        telefone_supervisor: novoCondo.telefoneSupervisor || null,
        vagas_contratadas: novoCondo.vagasContratadas,
        status: novoCondo.status,
        motivo_atencao: novoCondo.motivoAtencao || null,
        tipo_escala_padrao: novoCondo.tipoEscalaPadrao,
        cobertura_percentual: novoCondo.coberturaPercentual,
        contato_sindico: novoCondo.contatoSindico || null,
        telefone_sindico: novoCondo.telefoneSindico || null,
        instrucoes_guarita: novoCondo.instrucoesGuarita || null,
        foto_url: novoCondo.foto || null,
        ativo: novoCondo.ativo !== false,
        latitude: hasCoords ? Number(novoCondo.latitude) : null,
        longitude: hasCoords ? Number(novoCondo.longitude) : null,
        raio_gps_metros: novoCondo.raioGpsMetros || 150,
        lat: hasCoords ? Number(novoCondo.latitude) : null,
        lng: hasCoords ? Number(novoCondo.longitude) : null,
        raio_tolerancia_metros: novoCondo.raioGpsMetros || 150,
        icone: novoCondo.icone || 'Building2',
        cor: novoCondo.cor || '#3B82F6',
        updated_at: new Date().toISOString(),
      });
    }

    showToast(`Posto ${novoCondo.nome} cadastrado.`);
    closeCondominioModal();
    return true;
  };

  // 15. Atualizar Condomínio
  const atualizarCondominio = async (id: string, dados: Partial<CondominioPosto>): Promise<boolean> => {
    const condoAtual = condominios.find((c) => c.id === id);
    if (!condoAtual) return false;

    setCondominios((prev) => prev.map((c) => (c.id === id ? { ...c, ...dados } : c)));

    const client = getSupabase();
    if (client) {
      const payload: Record<string, any> = { updated_at: new Date().toISOString() };
      if (dados.nome !== undefined) payload.nome = dados.nome;
      if (dados.tipo !== undefined) payload.tipo = dados.tipo;
      if (dados.cnpj !== undefined) payload.cnpj = dados.cnpj;
      if (dados.contratoNumero !== undefined) payload.contrato_numero = dados.contratoNumero;
      if (dados.endereco !== undefined) payload.endereco = dados.endereco;
      if (dados.bairro !== undefined) payload.bairro = dados.bairro;
      if (dados.cidade !== undefined) payload.cidade = dados.cidade;
      if (dados.supervisor !== undefined) payload.supervisor = dados.supervisor;
      if (dados.telefoneSupervisor !== undefined) payload.telefone_supervisor = dados.telefoneSupervisor;
      if (dados.vagasContratadas !== undefined) payload.vagas_contratadas = Number(dados.vagasContratadas);
      if (dados.status !== undefined) payload.status = dados.status;
      if (dados.ativo !== undefined) payload.ativo = dados.ativo;
      if (dados.motivoAtencao !== undefined) payload.motivo_atencao = dados.motivoAtencao;
      if (dados.tipoEscalaPadrao !== undefined) payload.tipo_escala_padrao = dados.tipoEscalaPadrao;
      if (dados.coberturaPercentual !== undefined) payload.cobertura_percentual = dados.coberturaPercentual;
      if (dados.contatoSindico !== undefined) payload.contato_sindico = dados.contatoSindico;
      if (dados.telefoneSindico !== undefined) payload.telefone_sindico = dados.telefoneSindico;
      if (dados.latitude !== undefined) {
        payload.latitude = dados.latitude !== null ? Number(dados.latitude) : null;
        payload.lat = payload.latitude;
      }
      if (dados.longitude !== undefined) {
        payload.longitude = dados.longitude !== null ? Number(dados.longitude) : null;
        payload.lng = payload.longitude;
      }
      if (dados.raioGpsMetros !== undefined) {
        payload.raio_gps_metros = Number(dados.raioGpsMetros);
        payload.raio_tolerancia_metros = Number(dados.raioGpsMetros);
      }

      await client.from('condominios').update(payload).eq('id', id);
    }

    showToast(`Posto ${dados.nome || condoAtual.nome} atualizado.`);
    closeCondominioModal();
    return true;
  };

  // 16. Notificar Tentativa Fora de Todos os Postos (SEM mutar condominios/colaboradores!)
  const notificarTentativaForaPosto = async (
    colaborador: Colaborador,
    posto: CondominioPosto,
    distanciaM: number,
    coords?: { latitude: number; longitude: number }
  ): Promise<void> => {
    const agoraHora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const alertaId = generateSafeId('alerta-fraude');

    const novoAlerta: AlertaOperacional = {
      id: alertaId,
      tipo: 'tentativa_ponto_fora_posto',
      gravidade: 'critica',
      titulo: `Tentativa de Ponto Fora dos Postos (${colaborador.nome})`,
      descricao: `Leitura GPS fora de todos os postos ativos da empresa. Mais próximo: ${posto.nome} (${distanciaM}m; raio ${posto.raioGpsMetros || 150}m).`,
      postoId: posto.id,
      postoNome: posto.nome,
      colaboradorId: colaborador.id,
      colaboradorNome: colaborador.nome,
      horario: agoraHora,
      resolvido: false,
      latitudeTentativa: coords?.latitude,
      longitudeTentativa: coords?.longitude,
      distanciaTentativaM: distanciaM,
    };

    setAlertas((prev) => [novoAlerta, ...prev]);

    const client = getSupabase();
    if (client) {
      await client.from('alertas').insert({
        id: novoAlerta.id,
        empresa_id: empresaInfo.id || 'emp-matriz-principal',
        tipo: novoAlerta.tipo,
        gravidade: novoAlerta.gravidade,
        titulo: novoAlerta.titulo,
        descricao: novoAlerta.descricao,
        posto_id: posto.id,
        posto_nome: posto.nome,
        colaborador_id: colaborador.id,
        colaborador_nome: colaborador.nome,
        horario: agoraHora,
        resolvido: false,
      });

      await client.from('notificacoes_sistema').insert({
        empresa_id: empresaInfo.id || 'emp-matriz-principal',
        destinatario_role: 'supervisor',
        categoria: 'ponto',
        titulo: novoAlerta.titulo,
        mensagem: novoAlerta.descricao,
        referencia_tipo: 'alerta',
        referencia_id: novoAlerta.id,
      });
    }
  };

  // 17. Notificar Ponto em Outro Posto (Cobertura ou Divergência) — NUNCA muta colaboradores.condominio_id!
  const notificarPontoOutroPostoCobertura = async (
    colaborador: Colaborador,
    postoCadastrado: CondominioPosto,
    postoDetectado: CondominioPosto,
    distanciaM: number,
    coords?: { latitude: number; longitude: number },
    isProgramada = false
  ): Promise<void> => {
    const agoraHora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const alertaId = generateSafeId('alerta-multiposto');

    const novoAlerta: AlertaOperacional = {
      id: alertaId,
      tipo: isProgramada ? 'ponto_posto_cobertura' : 'posto_divergente',
      gravidade: isProgramada ? 'informativa' : 'moderada',
      titulo: isProgramada
        ? `Cobertura Programada Executada (${colaborador.nome})`
        : `Divergência de Posto (${colaborador.nome})`,
      descricao: isProgramada
        ? `${colaborador.nome} registrou ponto conforme escala de cobertura em ${postoDetectado.nome} (${distanciaM}m). Posto-base "${postoCadastrado.nome}" preservado.`
        : `${colaborador.nome} (posto-base: ${postoCadastrado.nome}) registrou ponto presencial em ${postoDetectado.nome} (${distanciaM}m) sem cobertura prévia programada.`,
      postoId: postoDetectado.id,
      postoNome: postoDetectado.nome,
      colaboradorId: colaborador.id,
      colaboradorNome: colaborador.nome,
      horario: agoraHora,
      resolvido: false,
      latitudeTentativa: coords?.latitude,
      longitudeTentativa: coords?.longitude,
      distanciaTentativaM: distanciaM,
    };

    setAlertas((prev) => [novoAlerta, ...prev]);

    // Nota: quando gravado via RPC registrar_ponto_transacional, o próprio backend já cria notificacoes_sistema.
    // Mantemos alerta local sincronizado sem sobrescrever condominio_id do colaborador.
  };

  // 18. Alertar gestor sobre postos ativos sem coordenadas configuradas
  const alertarPostoSemCoordenadas = async (postosSemCoords: CondominioPosto[]): Promise<void> => {
    if (postosSemCoords.length === 0) return;
    const client = getSupabase();
    const agoraHora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    for (const p of postosSemCoords) {
      const jaExiste = alertas.some((a) => !a.resolvido && a.tipo === 'posto_sem_coordenadas' && a.postoId === p.id);
      if (jaExiste) continue;

      const alertaId = generateSafeId('alerta-geocalib');
      const novoAlerta: AlertaOperacional = {
        id: alertaId,
        tipo: 'posto_sem_coordenadas',
        gravidade: 'moderada',
        titulo: `Posto sem coordenadas GPS (${p.nome})`,
        descricao: `O posto ativo "${p.nome}" não possui latitude/longitude configuradas para geofence. Calibre o posto na aba Postos.`,
        postoId: p.id,
        postoNome: p.nome,
        horario: agoraHora,
        resolvido: false,
      };
      setAlertas((prev) => [novoAlerta, ...prev]);

      if (client) {
        await client.from('alertas').insert({
          id: alertaId,
          empresa_id: empresaInfo.id || 'emp-matriz-principal',
          tipo: 'posto_sem_coordenadas',
          gravidade: 'moderada',
          titulo: novoAlerta.titulo,
          descricao: novoAlerta.descricao,
          posto_id: p.id,
          posto_nome: p.nome,
          horario: agoraHora,
          resolvido: false,
        });
        await client.from('notificacoes_sistema').insert({
          empresa_id: empresaInfo.id || 'emp-matriz-principal',
          destinatario_role: 'supervisor',
          categoria: 'alerta_config',
          titulo: novoAlerta.titulo,
          mensagem: novoAlerta.descricao,
          referencia_tipo: 'condominio',
          referencia_id: p.id,
        });
      }
    }
  };

  const excluirCondominio = async (id: string): Promise<boolean> => {
    const condo = condominios.find((c) => c.id === id);
    if (!condo) return false;
    setCondominios((prev) => prev.filter((c) => c.id !== id));
    const client = getSupabase();
    if (client) {
      await client.from('condominios').delete().eq('id', id);
    }
    showToast(`Posto ${condo.nome} excluído.`);
    closeCondominioModal();
    return true;
  };

  // Coberturas e Notificações
  const criarCobertura = async (
    input: Omit<CriarCoberturaInput, 'empresaId' | 'criadoPorNome'>
  ): Promise<{ success: boolean; message: string }> => {
    const res = await criarCoberturaProgramada(
      {
        ...input,
        empresaId: empresaInfo.id || 'emp-matriz-principal',
        exigeAceiteColaborador:
          input.exigeAceiteColaborador !== undefined
            ? input.exigeAceiteColaborador
            : Boolean(empresaInfo.exigeAceiteCobertura),
        criadoPorNome: actorName,
      },
      coberturasProgramadas
    );
    if (res.success && res.cobertura) {
      setCoberturasProgramadas((prev) => [res.cobertura!, ...prev]);
    }
    showToast(res.message);
    return { success: res.success, message: res.message };
  };

  const responderCobertura = async (
    cobertura: CoberturaProgramada,
    aceitar: boolean,
    motivoRecusa?: string
  ): Promise<{ success: boolean; message: string }> => {
    const res = await responderAceiteCobertura(cobertura, aceitar, motivoRecusa, currentUser?.nome);
    if (res.success) {
      setCoberturasProgramadas((prev) =>
        prev.map((c) =>
          c.id === cobertura.id
            ? { ...c, status: res.status, aceiteColaborador: aceitar, recusaMotivo: aceitar ? null : motivoRecusa }
            : c
        )
      );
    }
    showToast(res.message);
    return { success: res.success, message: res.message };
  };

  const alterarStatusCobertura = async (
    cobertura: CoberturaProgramada,
    novoStatus: 'cancelada' | 'concluida' | 'aprovada',
    detalhes?: string
  ): Promise<{ success: boolean; message: string }> => {
    const res = await atualizarStatusCobertura(cobertura, novoStatus, actorName, detalhes);
    if (res.success) {
      setCoberturasProgramadas((prev) =>
        prev.map((c) => (c.id === cobertura.id ? { ...c, status: novoStatus } : c))
      );
    }
    showToast(res.message);
    return res;
  };

  const marcarNotificacaoLida = async (notificacaoId: string): Promise<void> => {
    const nowIso = new Date().toISOString();
    setNotificacoesSistema((prev) =>
      prev.map((n) => (n.id === notificacaoId ? { ...n, lida: true, lidaEm: nowIso } : n))
    );
    const client = getSupabase();
    if (client) {
      await client
        .from('notificacoes_sistema')
        .update({ lida: true, lida_em: nowIso })
        .eq('id', notificacaoId);
    }
  };

  const registrarSolicitacaoCorrecao = async (dados: {
    colaboradorId: string;
    colaboradorNome: string;
    dataPonto: string;
    tipoCorrecao: SolicitacaoCorrecaoPonto['tipoCorrecao'];
    justificativa: string;
  }): Promise<{ success: boolean; message: string }> => {
    const nova: SolicitacaoCorrecaoPonto = {
      id: generateSafeId('corr'),
      colaboradorId: dados.colaboradorId,
      colaboradorNome: dados.colaboradorNome,
      dataPonto: dados.dataPonto,
      tipoCorrecao: dados.tipoCorrecao,
      justificativa: dados.justificativa.trim(),
      status: 'pendente',
      criadoEm: new Date().toISOString(),
    };

    const client = getSupabase();
    if (client) {
      const { error } = await client.from('solicitacoes_correcao_ponto').insert({
        id: nova.id,
        empresa_id: empresaInfo.id || 'emp-matriz-principal',
        colaborador_id: nova.colaboradorId,
        colaborador_nome: nova.colaboradorNome,
        data_ponto: nova.dataPonto,
        tipo_correcao: nova.tipoCorrecao,
        justificativa: nova.justificativa,
        status: 'pendente',
      });
      if (error) {
        return { success: false, message: `Erro ao registrar solicitação: ${error.message}` };
      }

      await client.from('notificacoes_sistema').insert({
        empresa_id: empresaInfo.id || 'emp-matriz-principal',
        destinatario_role: 'rh',
        categoria: 'ponto',
        titulo: `Solicitação de correção de ponto: ${nova.colaboradorNome}`,
        mensagem: `Data ${nova.dataPonto} (${nova.tipoCorrecao}): ${nova.justificativa}`,
        referencia_tipo: 'solicitacao_correcao',
        referencia_id: nova.id,
        link_destino: 'rh',
      });
    }

    setSolicitacoesCorrecao((prev) => [nova, ...prev]);
    return { success: true, message: 'Solicitação de ajuste registrada e enviada ao RH/Supervisão.' };
  };

  const revisarSolicitacaoCorrecao = async (
    id: string,
    status: 'aprovado' | 'rejeitado',
    respostaRH: string
  ): Promise<boolean> => {
    setSolicitacoesCorrecao((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status, respostaRH } : s))
    );
    const client = getSupabase();
    if (client) {
      await client
        .from('solicitacoes_correcao_ponto')
        .update({ status, resposta_rh: respostaRH, updated_at: new Date().toISOString() })
        .eq('id', id);
    }
    showToast(`Solicitação marcada como ${status}.`);
    return true;
  };

  // ============================================================================
  // AUTENTICAÇÃO ESTRITA VIA SUPABASE AUTH (ZERO HARDCODED PASSWORDS)
  // ============================================================================
  const login = async (
    emailOrCpf: string,
    senhaDigitada: string
  ): Promise<{ success: boolean; message: string }> => {
    const cleanInput = emailOrCpf.trim().toLowerCase();
    const cleanSenha = senhaDigitada;

    if (!cleanInput) {
      return { success: false, message: 'Informe seu e-mail corporativo cadastrado no Supabase Auth.' };
    }
    if (!cleanSenha) {
      return { success: false, message: 'Informe sua senha de acesso.' };
    }

    const supabase = getSupabase();
    if (!supabase) {
      return {
        success: false,
        message: 'Supabase não configurado neste ambiente. Configure a URL e Anon Key nas definições do banco.',
      };
    }

    if (!cleanInput.includes('@')) {
      return {
        success: false,
        message: 'Por segurança, informe seu e-mail corporativo completo (ex: nome@empresa.com.br).',
      };
    }

    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: cleanInput,
      password: cleanSenha,
    });

    if (authErr || !authData?.user) {
      return {
        success: false,
        message: authErr?.message === 'Invalid login credentials'
          ? 'E-mail ou senha inválidos no Supabase Auth.'
          : authErr?.message || 'Falha ao autenticar no Supabase Auth.',
      };
    }

    await syncSessionUser(authData.user);
    return { success: true, message: 'Autenticação confirmada com sucesso.' };
  };

  const logout = async () => {
    const supabase = getSupabase();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setCurrentUser(null);
    setCondominios([]);
    setColaboradores([]);
    setAlertas([]);
    setOcorrencias([]);
    setHolerites([]);
    setPontos([]);
    setPontoEventos([]);
    setCoberturasProgramadas([]);
    setDocumentoSolicitacoes([]);
    setColaboradorDocumentos([]);
    setNotificacoesSistema([]);
    showToast('Sessão encerrada com segurança.');
  };

  const trocarSenha = async (
    senhaAtual: string,
    novaSenha: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!novaSenha || novaSenha.trim().length < 8) {
      return { success: false, message: 'A nova senha deve ter no mínimo 8 caracteres.' };
    }
    const supabase = getSupabase();
    if (!supabase || !currentUser?.email) {
      return { success: false, message: 'Sessão Supabase Auth ativa necessária para alterar senha.' };
    }

    if (!senhaAtual.trim()) {
      return { success: false, message: 'Informe sua senha atual para confirmar a alteração.' };
    }

    const { error: reauthErr } = await supabase.auth.signInWithPassword({
      email: currentUser.email,
      password: senhaAtual,
    });
    if (reauthErr) {
      return { success: false, message: 'Senha atual incorreta.' };
    }

    const { error: updErr } = await supabase.auth.updateUser({ password: novaSenha.trim() });
    if (updErr) {
      return { success: false, message: `Erro ao atualizar senha no Supabase Auth: ${updErr.message}` };
    }

    showToast('Senha alterada com segurança no Supabase Auth.');
    setTrocarSenhaModalOpen(false);
    return { success: true, message: 'Senha atualizada com sucesso.' };
  };

  const openRedefinirSenhaModal = (colab: Colaborador) => {
    setColaboradorParaRedefinirSenha(colab);
    setRedefinirSenhaModalOpen(true);
  };

  const redefinirSenhaColaborador = async (
    colaboradorId: string,
    _novaSenha: string,
    supervisor?: { id: string; nome: string }
  ): Promise<{ success: boolean; message: string }> => {
    const colab = colaboradores.find((c) => c.id === colaboradorId);
    const supabase = getSupabase();

    if (!colab?.email) {
      return {
        success: false,
        message: 'Colaborador não possui e-mail corporativo cadastrado para envio do link de redefinição do Supabase Auth.',
      };
    }

    if (supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(colab.email, {
        redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      });
      if (error) {
        return { success: false, message: `Erro ao disparar e-mail de redefinição: ${error.message}` };
      }

      const supNome = supervisor?.nome || actorName;
      const agoraHora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      await supabase
        .from('alertas')
        .update({ resolvido: true, resolvido_por: supNome, resolvido_em: agoraHora })
        .eq('colaborador_id', colaboradorId)
        .eq('tipo', 'solicitacao_senha');

      setAlertas((prev) =>
        prev.map((a) =>
          a.colaboradorId === colaboradorId && a.tipo === 'solicitacao_senha'
            ? { ...a, resolvido: true, resolvidoPor: supNome, resolvidoEm: agoraHora }
            : a
        )
      );
    }

    showToast(`Link oficial de recuperação enviado para ${colab.email}.`);
    return {
      success: true,
      message: `E-mail de redefinição enviado via Supabase Auth para ${colab.email}.`,
    };
  };

  const solicitarAjudaSenha = async (
    identificador: string
  ): Promise<{ success: boolean; message: string; colaboradorLocalizado?: Colaborador }> => {
    if (!identificador || !identificador.trim()) {
      return { success: false, message: 'Informe seu e-mail corporativo cadastrado.' };
    }

    const cleanInput = identificador.trim().toLowerCase();
    const supabase = getSupabase();

    if (supabase && cleanInput.includes('@')) {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanInput, {
        redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      });
      if (!error) {
        return {
          success: true,
          message: `Se ${cleanInput} estiver cadastrado no Supabase Auth, você receberá o link oficial de redefinição por e-mail.`,
        };
      }
    }

    return {
      success: true,
      message: 'Entre em contato com seu supervisor ou RH para solicitar a liberação de recuperação de acesso.',
    };
  };

  // Biometria Facial
  const solicitarCadastroFacial = async (
    colaborador: Colaborador,
    motivo: string,
    tipo: 'primeiro_cadastro' | 'atualizacao_recadastro' = 'primeiro_cadastro'
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await solicitarCadastroBiometria(colaborador, motivo, tipo);
      if (res.success && res.solicitacao) {
        setSolicitacoesBiometria((prev) => [res.solicitacao, ...prev.filter((s) => s.id !== res.solicitacao.id)]);
        const agoraHora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const novoAlerta: AlertaOperacional = {
          id: `alerta-bio-${res.solicitacao.id}`,
          tipo: 'solicitacao_biometria',
          gravidade: 'moderada',
          titulo: 'Solicitação de Biometria Facial',
          descricao: `${colaborador.nome} (${colaborador.funcao}) aguarda autorização para cadastro facial. Motivo: "${motivo}"`,
          postoId: colaborador.condominioId || '',
          postoNome: colaborador.postoNome || 'Posto',
          colaboradorId: colaborador.id,
          colaboradorNome: colaborador.nome,
          horario: agoraHora,
          resolvido: false,
        };
        setAlertas((prev) => [novoAlerta, ...prev.filter((a) => a.id !== novoAlerta.id)]);
        showToast('Solicitação de biometria facial enviada ao supervisor.');
        return { success: true, message: 'Solicitação cadastrada e enviada à supervisão.' };
      }
      return { success: false, message: res.message || 'Falha ao solicitar biometria.' };
    } catch (err: any) {
      const msg = err?.message || 'Falha ao solicitar autorização de biometria.';
      showToast(msg);
      return { success: false, message: msg };
    }
  };

  const aprovarSolicitacaoBiometria = async (
    solicitacaoId: string,
    supervisor?: UsuarioAuth | { id: string; nome: string },
    validadeHoras: number = 48
  ): Promise<{ success: boolean; message: string }> => {
    const sup = supervisor || currentUser;
    if (!sup) return { success: false, message: 'Sessão de supervisor necessária.' };
    const res = await aprovarBiometriaService(solicitacaoId, sup, validadeHoras);
    if (res.success && res.solicitacao) {
      setSolicitacoesBiometria((prev) => prev.map((s) => (s.id === solicitacaoId ? res.solicitacao! : s)));
      const agoraHora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      setAlertas((prev) =>
        prev.map((a) =>
          a.id === `alerta-bio-${solicitacaoId}`
            ? { ...a, resolvido: true, resolvidoPor: sup.nome, resolvidoEm: agoraHora }
            : a
        )
      );
      showToast(`Autorização aprovada por ${validadeHoras}h.`);
      return { success: true, message: 'Solicitação aprovada e token gerado.' };
    }
    showToast(res.message);
    return { success: false, message: res.message };
  };

  const rejeitarSolicitacaoBiometria = async (
    solicitacaoId: string,
    justificativa: string,
    supervisor?: UsuarioAuth | { id: string; nome: string }
  ): Promise<{ success: boolean; message: string }> => {
    const sup = supervisor || currentUser;
    if (!sup) return { success: false, message: 'Sessão de supervisor necessária.' };
    const res = await rejeitarBiometriaService(solicitacaoId, justificativa, sup);
    if (res.success && res.solicitacao) {
      setSolicitacoesBiometria((prev) => prev.map((s) => (s.id === solicitacaoId ? res.solicitacao! : s)));
      const agoraHora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      setAlertas((prev) =>
        prev.map((a) =>
          a.id === `alerta-bio-${solicitacaoId}`
            ? { ...a, resolvido: true, resolvidoPor: sup.nome, resolvidoEm: agoraHora }
            : a
        )
      );
      showToast('Solicitação de biometria rejeitada.');
      return { success: true, message: 'Solicitação rejeitada.' };
    }
    showToast(res.message);
    return { success: false, message: res.message };
  };

  const obterAutorizacaoAtiva = (colaboradorId: string): SolicitacaoBiometriaFacial | null => {
    const encontrada = solicitacoesBiometria.find(
      (s) =>
        s.colaboradorId === colaboradorId &&
        s.status === 'aprovada' &&
        s.tokenAutorizacao &&
        s.expiraEm &&
        new Date(s.expiraEm).getTime() > Date.now()
    );
    if (encontrada) return encontrada;
    return getActiveBiometriaService(colaboradorId);
  };

  const obterUltimaSolicitacao = (colaboradorId: string): SolicitacaoBiometriaFacial | null => {
    const daLista = solicitacoesBiometria
      .filter((s) => s.colaboradorId === colaboradorId)
      .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())[0];
    if (daLista) return daLista;
    return getUltimaBiometriaService(colaboradorId);
  };

  // Preserve unused import check cleanly
  void saveLocalSolicitacoesBiometria;

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        selectedCondominioId,
        setSelectedCondominioId,
        condominios,
        colaboradores,
        alertas,
        ocorrencias,
        holerites,
        setHolerites,
        pontos,
        pontoEventos,
        setPontoEventos,
        atestados,
        coberturasProgramadas,
        setCoberturasProgramadas,
        documentoSolicitacoes,
        setDocumentoSolicitacoes,
        colaboradorDocumentos,
        setColaboradorDocumentos,
        documentoHistorico,
        holeriteLotes,
        setHoleriteLotes,
        holeriteEventos,
        notificacoesSistema,
        setNotificacoesSistema,
        solicitacoesCorrecao,
        setSolicitacoesCorrecao,
        filterEquipeStatus,
        setFilterEquipeStatus,
        filterEquipeFuncao,
        setFilterEquipeFuncao,
        searchQuery,
        setSearchQuery,
        selectedPostoFor360,
        openPosto360,
        closePosto360,
        substituicaoModal,
        openSubstituicaoModal,
        closeSubstituicaoModal,
        alocarModal,
        openAlocarModal,
        closeAlocarModal,
        escalaModal,
        openEscalaModal,
        closeEscalaModal,
        ocorrenciaModal,
        openOcorrenciaModal,
        closeOcorrenciaModal,
        holeriteDetalhe,
        openHoleriteDetalhe,
        closeHoleriteDetalhe,
        notificationModalOpen,
        setNotificationModalOpen,
        supabaseModalOpen,
        setSupabaseModalOpen,
        cadastroModalOpen,
        setCadastroModalOpen,
        colaboradorParaEditar,
        openEditarFuncionarioModal,
        closeCadastroModal,
        atualizarFuncionario,
        excluirFuncionario,
        condominioModal,
        openNovoCondominioModal,
        openEditarCondominioModal,
        closeCondominioModal,
        cadastrarCondominio,
        atualizarCondominio,
        excluirCondominio,
        empresaInfo,
        empresaModalOpen,
        setEmpresaModalOpen,
        atualizarEmpresaInfo,
        cadastrarFuncionario,
        substituirColaborador,
        alocarColaborador,
        removerColaboradorDoPosto,
        resolverAlerta,
        criarOcorrencia,
        aprovarAtestado,
        recusarAtestado,
        assinarHolerite,
        registrarPonto,
        notificarTentativaForaPosto,
        notificarPontoOutroPostoCobertura,
        alertarPostoSemCoordenadas,
        criarCobertura,
        responderCobertura,
        alterarStatusCobertura,
        marcarNotificacaoLida,
        registrarSolicitacaoCorrecao,
        revisarSolicitacaoCorrecao,
        toastMessage,
        showToast,
        syncWithSupabase,
        isSyncing,
        authLoading,
        currentUser,
        setCurrentUser,
        login,
        logout,
        trocarSenhaModalOpen,
        setTrocarSenhaModalOpen,
        trocarSenha,
        redefinirSenhaModalOpen,
        setRedefinirSenhaModalOpen,
        colaboradorParaRedefinirSenha,
        setColaboradorParaRedefinirSenha,
        openRedefinirSenhaModal,
        redefinirSenhaColaborador,
        solicitarAjudaSenha,
        ajudaAcessoModalOpen,
        setAjudaAcessoModalOpen,
        solicitacoesBiometria,
        solicitarCadastroFacial,
        aprovarSolicitacaoBiometria,
        rejeitarSolicitacaoBiometria,
        obterAutorizacaoAtiva,
        obterUltimaSolicitacao,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp deve ser usado dentro de um AppProvider');
  }
  return context;
};
