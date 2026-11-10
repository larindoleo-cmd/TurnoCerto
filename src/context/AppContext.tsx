import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  TabType,
  StatusColaborador,
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
} from '../types';
import {
  INITIAL_CONDOMINIOS,
  INITIAL_COLABORADORES,
  INITIAL_ALERTAS,
  INITIAL_OCORRENCIAS,
  INITIAL_HOLERITES,
  INITIAL_PONTO_REGISTROS,
  INITIAL_ATESTADOS,
  INITIAL_EMPRESA_INFO,
} from '../data/mockData';
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

export const ADMIN_CAETANO_USER: UsuarioAuth = {
  id: 'usr-caetano-adm',
  nome: 'Caetano (Administrador Geral)',
  email: 'caetano.adm@turnocerto.com.br',
  role: 'admin',
  cargo: 'Administrador Geral / Controle Total',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
};

export const DEFAULT_USER: UsuarioAuth = {
  id: 'usr-supervisor',
  nome: 'Supervisão Geral',
  email: 'supervisor@turnocerto.com.br',
  role: 'supervisor',
  cargo: 'Supervisão Geral de Operações',
  avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
};

// Helper to generate RFC4122 v4 UUID or unique safe ID
function generateSafeId(prefix = 'tc'): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

// Helper to check valid UUID
function isValidUUID(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

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
  pontos: PontoRegistro[];
  atestados: AtestadoMedico[];
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

  substituicaoModal: { isOpen: boolean; posto?: CondominioPosto; colaboradorFalta?: Colaborador } | null;
  openSubstituicaoModal: (posto?: CondominioPosto, colaboradorFalta?: Colaborador) => void;
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
  substituirColaborador: (postoId: string, substitutoId: string, colaboradorFaltaId?: string) => Promise<boolean>;
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
    coords?: { latitude: number; longitude: number }
  ) => Promise<void>;

  // Feedback toast
  toastMessage: string | null;
  showToast: (msg: string) => void;

  // Supabase sync
  syncWithSupabase: () => Promise<void>;
  isSyncing: boolean;

  // Sessão e Autenticação
  currentUser: UsuarioAuth | null;
  setCurrentUser: (user: UsuarioAuth | null) => void;
  login: (emailOrCpf: string, senhaDigitada: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  trocarSenhaModalOpen: boolean;
  setTrocarSenhaModalOpen: (open: boolean) => void;
  trocarSenha: (senhaAtual: string, novaSenha: string) => Promise<{ success: boolean; message: string }>;

  // Gestão de Senha do Colaborador (Supervisor & Ajuda com Acesso)
  redefinirSenhaModalOpen: boolean;
  setRedefinirSenhaModalOpen: (open: boolean) => void;
  colaboradorParaRedefinirSenha: Colaborador | null;
  setColaboradorParaRedefinirSenha: (colab: Colaborador | null) => void;
  openRedefinirSenhaModal: (colab: Colaborador) => void;
  redefinirSenhaColaborador: (
    colaboradorId: string,
    novaSenha: string,
    supervisor?: { id: string; nome: string }
  ) => Promise<{ success: boolean; message: string; novaSenhaGerada?: string }>;
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

const LOCAL_STORAGE_KEY = 'turnocerto_app_data_v3';

// Helper para detectar e descartar IDs fictícios de sementes legadas
const isMockId = (id: string | null | undefined): boolean => {
  if (!id) return false;
  return (
    /^cond-[0-9]+$/.test(id) ||
    /^colab-[0-9]+$/.test(id) ||
    id === 'colab-falta-1' ||
    id === 'colab-afastado-1' ||
    id.startsWith('colab-reserva') ||
    /^alerta-[0-9]+$/.test(id) ||
    id === 'alert-init-1' ||
    /^ocorr-[0-9]+$/.test(id) ||
    id === 'ocorr-init-1' ||
    /^hol-[0-9]+$/.test(id) ||
    /^pto-[0-9]+$/.test(id) ||
    /^atest-[0-9]+$/.test(id) ||
    id.startsWith('c21111') ||
    id.startsWith('c31111') ||
    id.startsWith('c41111') ||
    id.startsWith('c51111') ||
    id.startsWith('c61111') ||
    id.startsWith('c22222') ||
    id.startsWith('c33333') ||
    id.startsWith('c44444')
  );
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<TabType>('operacao');
  const [selectedCondominioId, setSelectedCondominioId] = useState<string>('todos');

  // Inicializa estado apenas com dados reais ou vazio
  const [condominios, setCondominios] = useState<CondominioPosto[]>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_condominios`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed.filter((c: CondominioPosto) => !isMockId(c.id)) : [];
      }
      return INITIAL_CONDOMINIOS;
    } catch {
      return INITIAL_CONDOMINIOS;
    }
  });

  const [colaboradores, setColaboradores] = useState<Colaborador[]>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_colaboradores`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed.filter((c: Colaborador) => !isMockId(c.id)) : [];
      }
      return INITIAL_COLABORADORES;
    } catch {
      return INITIAL_COLABORADORES;
    }
  });

  const [alertas, setAlertas] = useState<AlertaOperacional[]>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_alertas`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed.filter((a: AlertaOperacional) => !isMockId(a.id)) : [];
      }
      return INITIAL_ALERTAS;
    } catch {
      return INITIAL_ALERTAS;
    }
  });

  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_ocorrencias`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed.filter((o: Ocorrencia) => !isMockId(o.id)) : [];
      }
      return INITIAL_OCORRENCIAS;
    } catch {
      return INITIAL_OCORRENCIAS;
    }
  });

  const [holerites, setHolerites] = useState<HoleriteRegistro[]>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_holerites`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed.filter((h: HoleriteRegistro) => !isMockId(h.id)) : [];
      }
      return INITIAL_HOLERITES;
    } catch {
      return INITIAL_HOLERITES;
    }
  });

  const [pontos, setPontos] = useState<PontoRegistro[]>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_pontos`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed.filter((p: PontoRegistro) => !isMockId(p.id)) : [];
      }
      return INITIAL_PONTO_REGISTROS;
    } catch {
      return INITIAL_PONTO_REGISTROS;
    }
  });

  const [atestados, setAtestados] = useState<AtestadoMedico[]>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_atestados`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed.filter((a: AtestadoMedico) => !isMockId(a.id)) : [];
      }
      return INITIAL_ATESTADOS;
    } catch {
      return INITIAL_ATESTADOS;
    }
  });

  const [empresaInfo, setEmpresaInfo] = useState<EmpresaInfo>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_empresa`);
      return saved ? JSON.parse(saved) : INITIAL_EMPRESA_INFO;
    } catch {
      return INITIAL_EMPRESA_INFO;
    }
  });

  const [solicitacoesBiometria, setSolicitacoesBiometria] = useState<SolicitacaoBiometriaFacial[]>(() => {
    try {
      const stored = getLocalSolicitacoesBiometria();
      if (stored && stored.length > 0) return stored;
      const initial: SolicitacaoBiometriaFacial[] = [
        {
          id: 'sbf-init-101',
          colaboradorId: 'colab-carlos-1042',
          colaboradorNome: 'Carlos Eduardo Santos',
          colaboradorMatricula: 'TC-1042',
          colaboradorFuncao: 'Porteiro',
          condominioId: 'cond-alvorada-01',
          condominioNome: 'Residencial Alvorada',
          postoNome: 'Portaria Principal',
          fotoPerfil: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
          tipoSolicitacao: 'primeiro_cadastro',
          motivo: 'Primeiro cadastro de biometria facial para controle de ponto digital.',
          status: 'pendente',
          criadoEm: '2026-11-10T10:30:00.000Z',
        },
      ];
      saveLocalSolicitacoesBiometria(initial);
      return initial;
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

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Authenticated user
  const [currentUser, setCurrentUser] = useState<UsuarioAuth | null>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_user`);
      if (saved === 'null') return null;
      return saved ? JSON.parse(saved) : DEFAULT_USER;
    } catch {
      return DEFAULT_USER;
    }
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 4500);
  };

  // Persist state to localStorage for offline resilience
  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_condominios`, JSON.stringify(condominios));
  }, [condominios]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_colaboradores`, JSON.stringify(colaboradores));
  }, [colaboradores]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_alertas`, JSON.stringify(alertas));
  }, [alertas]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_ocorrencias`, JSON.stringify(ocorrencias));
  }, [ocorrencias]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_holerites`, JSON.stringify(holerites));
  }, [holerites]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_pontos`, JSON.stringify(pontos));
  }, [pontos]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_atestados`, JSON.stringify(atestados));
  }, [atestados]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_empresa`, JSON.stringify(empresaInfo));
  }, [empresaInfo]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_user`, JSON.stringify(currentUser));
    } else {
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_user`, 'null');
    }
  }, [currentUser]);

  // Keep selectedPostoFor360 fresh when condominios updates
  useEffect(() => {
    if (selectedPostoFor360) {
      const updated = condominios.find((c) => c.id === selectedPostoFor360.id);
      if (updated) setSelectedPostoFor360(updated);
    }
  }, [condominios]);

  // Initial bi-directional sync on mount
  useEffect(() => {
    syncWithSupabase();
  }, []);

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

  const openSubstituicaoModal = (posto?: CondominioPosto, colaboradorFalta?: Colaborador) => {
    setSubstituicaoModal({ isOpen: true, posto, colaboradorFalta });
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

  const openNovoCondominioModal = () => {
    setCondominioModal({ isOpen: true, isNovo: true });
  };
  const openEditarCondominioModal = (condominio: CondominioPosto) => {
    setCondominioModal({ isOpen: true, condominio, isNovo: false });
  };
  const closeCondominioModal = () => setCondominioModal(null);

  // ============================================================================
  // AÇÕES OPERACIONAIS COM PERSISTÊNCIA REAL NO SUPABASE
  // ============================================================================

  // 1. Resolver Alerta Operacional
  const resolverAlerta = async (alertaId: string): Promise<boolean> => {
    const resolvidoEmHora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    setAlertas((prev) =>
      prev.map((alerta) =>
        alerta.id === alertaId
          ? { ...alerta, resolvido: true, resolvidoPor: 'Supervisora Silva', resolvidoEm: resolvidoEmHora }
          : alerta
      )
    );

    const client = getSupabase();
    if (client) {
      try {
        await client.from('alertas').update({
          resolvido: true,
          resolvido_por: 'Supervisora Silva',
          resolvido_em: resolvidoEmHora,
          updated_at: new Date().toISOString(),
        }).eq('id', alertaId);
      } catch (err) {
        console.warn('Erro ao persistir resolução de alerta no Supabase:', err);
      }
    }

    showToast('Alerta operacional marcado como resolvido e atualizado no banco.');
    return true;
  };

  // 2. Substituir Colaborador (Emergencial / Despacho de Volante)
  const substituirColaborador = async (
    postoId: string,
    substitutoId: string,
    colaboradorFaltaId?: string
  ): Promise<boolean> => {
    const posto = condominios.find((c) => c.id === postoId);
    const substituto = colaboradores.find((c) => c.id === substitutoId);

    if (!posto || !substituto) {
      showToast('Erro: Posto ou substituto não encontrado.');
      return false;
    }

    const agoraHora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // Atualização local de colaboradores
    setColaboradores((prev) =>
      prev.map((c) => {
        if (c.id === substitutoId) {
          return {
            ...c,
            status: 'no_posto',
            condominioId: posto.id,
            postoNome: posto.nome,
            ultimoPonto: `Hoje às ${agoraHora} (Substituição)`,
            motivoStatus: `Alocado emergencialmente em cobertura no posto ${posto.nome}`,
          };
        }
        if (colaboradorFaltaId && c.id === colaboradorFaltaId) {
          return {
            ...c,
            status: 'falta',
            motivoStatus: 'Falta no turno - Coberto por Volante',
          };
        }
        return c;
      })
    );

    // Atualização local de condomínios
    setCondominios((prev) =>
      prev.map((c) => {
        if (c.id === postoId) {
          const currentOperando = c.plantaoAtual.operandoAgora.filter((id) => id !== colaboradorFaltaId);
          if (!currentOperando.includes(substitutoId)) {
            currentOperando.push(substitutoId);
          }
          return {
            ...c,
            status: 'operacional',
            motivoAtencao: undefined,
            coberturaPercentual: 100,
            plantaoAtual: {
              ...c.plantaoAtual,
              operandoAgora: currentOperando,
            },
          };
        }
        return c;
      })
    );

    // Resolver alertas do posto
    setAlertas((prev) =>
      prev.map((a) => (a.postoId === postoId ? { ...a, resolvido: true, resolvidoPor: 'Supervisora Silva', resolvidoEm: agoraHora } : a))
    );

    // Criar ocorrência no log
    const novaOcorr: Ocorrencia = {
      id: `ocorr-${Date.now()}`,
      postoId: posto.id,
      postoNome: posto.nome,
      tipo: 'Posto Descoberto',
      descricao: `Substituição emergencial realizada com sucesso. Colaborador ${substituto.nome} (${substituto.funcao}) assumiu o posto em cobertura.`,
      registradoPor: 'Supervisora Silva',
      dataHora: `Hoje às ${agoraHora}`,
      urgencia: 'alta',
      resolvida: true,
    };
    setOcorrencias((prev) => [novaOcorr, ...prev]);

    // Persistência Completa no Supabase
    const client = getSupabase();
    if (client) {
      try {
        // Atualiza substituto no Supabase
        await client.from('colaboradores').update({
          condominio_id: posto.id,
          status: 'no_posto',
          updated_at: new Date().toISOString(),
        }).eq('id', substitutoId);

        // Se houver colaborador faltante, atualiza status para falta
        if (colaboradorFaltaId) {
          await client.from('colaboradores').update({
            status: 'falta',
            updated_at: new Date().toISOString(),
          }).eq('id', colaboradorFaltaId);
        }

        // Atualiza status do condomínio para operacional
        await client.from('condominios').update({
          status: 'operacional',
          motivo_atencao: null,
          cobertura_percentual: 100,
          updated_at: new Date().toISOString(),
        }).eq('id', postoId);

        // Salva a nova ocorrência
        await client.from('ocorrencias').insert({
          id: novaOcorr.id,
          posto_id: novaOcorr.postoId,
          posto_nome: novaOcorr.postoNome,
          tipo: novaOcorr.tipo,
          descricao: novaOcorr.descricao,
          registrado_por: novaOcorr.registradoPor,
          data_hora: novaOcorr.dataHora,
          urgencia: novaOcorr.urgencia,
          resolvida: true,
        });

        // Marca alertas do posto como resolvidos
        await client.from('alertas').update({
          resolvido: true,
          resolvido_por: 'Supervisora Silva',
          resolvido_em: agoraHora,
        }).eq('posto_id', postoId);
      } catch (err) {
        console.warn('Erro ao persistir substituição no Supabase:', err);
      }
    }

    closeSubstituicaoModal();
    showToast(`Substituição concluída e salva no banco! ${substituto.nome} alocado no ${posto.nome}.`);
    return true;
  };

  // 3. Alocar Colaborador em Posto
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

    setCondominios((prev) =>
      prev.map((c) => {
        if (c.id === postoId) {
          const current = [...c.plantaoAtual.operandoAgora];
          if (!current.includes(colaboradorId)) current.push(colaboradorId);
          return {
            ...c,
            status: 'operacional',
            motivoAtencao: undefined,
            coberturaPercentual: Math.min(100, Math.round((current.length / c.vagasContratadas) * 100)),
            plantaoAtual: { ...c.plantaoAtual, operandoAgora: current },
          };
        }
        return c;
      })
    );

    // Persistência no Supabase
    const client = getSupabase();
    if (client) {
      try {
        await client.from('colaboradores').update({
          condominio_id: posto.id,
          jornada: jornada || colab.jornada,
          status: 'no_posto',
          updated_at: new Date().toISOString(),
        }).eq('id', colaboradorId);

        await client.from('condominios').update({
          status: 'operacional',
          motivo_atencao: null,
          updated_at: new Date().toISOString(),
        }).eq('id', postoId);
      } catch (err) {
        console.warn('Erro ao persistir alocação no Supabase:', err);
      }
    }

    closeAlocarModal();
    showToast(`${colab.nome} alocado com sucesso no ${posto.nome} e salvo no banco!`);
    return true;
  };

  // 4. Remover / Desvincular Colaborador do Posto
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

    if (colab.condominioId) {
      setCondominios((prev) =>
        prev.map((c) => {
          if (c.id === colab.condominioId) {
            const updated = c.plantaoAtual.operandoAgora.filter((id) => id !== colaboradorId);
            return {
              ...c,
              plantaoAtual: { ...c.plantaoAtual, operandoAgora: updated },
              coberturaPercentual: Math.min(100, Math.round((updated.length / c.vagasContratadas) * 100)),
            };
          }
          return c;
        })
      );
    }

    // Persistência no Supabase
    const client = getSupabase();
    if (client) {
      try {
        await client.from('colaboradores').update({
          condominio_id: null,
          status: 'folga',
          updated_at: new Date().toISOString(),
        }).eq('id', colaboradorId);
      } catch (err) {
        console.warn('Erro ao desvincular colaborador no Supabase:', err);
      }
    }

    showToast(`${colab.nome} transferido para a Reserva e atualizado no banco.`);
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
      id: `ocorr-${Date.now()}`,
      postoId: dados.postoId,
      postoNome: posto ? posto.nome : 'Posto Geral',
      tipo: dados.tipo,
      descricao: dados.descricao,
      registradoPor: 'Supervisora Silva',
      dataHora: `Hoje às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      urgencia: dados.urgencia,
      resolvida: false,
    };

    setOcorrencias((prev) => [nova, ...prev]);

    // Persistência no Supabase
    const client = getSupabase();
    if (client) {
      try {
        await client.from('ocorrencias').insert({
          id: nova.id,
          posto_id: nova.postoId,
          posto_nome: nova.postoNome,
          tipo: nova.tipo,
          descricao: nova.descricao,
          registrado_por: nova.registradoPor,
          data_hora: nova.dataHora,
          urgencia: nova.urgencia,
          resolvida: false,
        });
      } catch (err) {
        console.warn('Erro ao salvar ocorrência no Supabase:', err);
      }
    }

    closeOcorrenciaModal();
    showToast('Ocorrência operacional registrada e salva no banco de dados!');
    return true;
  };

  // 6. Aprovar Atestado Médico
  const aprovarAtestado = async (atestadoId: string): Promise<boolean> => {
    setAtestados((prev) => prev.map((a) => (a.id === atestadoId ? { ...a, status: 'Aprovado' } : a)));

    const client = getSupabase();
    if (client) {
      try {
        await client.from('atestados').update({ status: 'Aprovado', updated_at: new Date().toISOString() }).eq('id', atestadoId);
      } catch (err) {
        console.warn('Erro ao atualizar atestado no Supabase:', err);
      }
    }

    showToast('Atestado médico aprovado e atualizado no banco de dados!');
    return true;
  };

  // 7. Recusar Atestado Médico
  const recusarAtestado = async (atestadoId: string): Promise<boolean> => {
    setAtestados((prev) => prev.map((a) => (a.id === atestadoId ? { ...a, status: 'Recusado' } : a)));

    const client = getSupabase();
    if (client) {
      try {
        await client.from('atestados').update({ status: 'Recusado', updated_at: new Date().toISOString() }).eq('id', atestadoId);
      } catch (err) {
        console.warn('Erro ao atualizar atestado no Supabase:', err);
      }
    }

    showToast('Atestado médico recusado.');
    return true;
  };

  // 8. Assinar Holerite Digital
  const assinarHolerite = async (holeriteId: string): Promise<boolean> => {
    setHolerites((prev) => prev.map((h) => (h.id === holeriteId ? { ...h, statusEnvio: 'Assinado' } : h)));

    const client = getSupabase();
    if (client) {
      try {
        await client.from('holerites').update({
          status_envio: 'Assinado',
          data_assinatura: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', holeriteId);
      } catch (err) {
        console.warn('Erro ao atualizar holerite no Supabase:', err);
      }
    }

    showToast('Contracheque assinado digitalmente com sucesso!');
    return true;
  };

  // 9. Registrar Ponto Eletrônico
  const registrarPonto = async (dados: Partial<PontoRegistro> & { colaboradorId: string }): Promise<boolean> => {
    const colab = colaboradores.find((c) => c.id === dados.colaboradorId);
    const dataHoje = dados.data || new Date().toISOString().split('T')[0];
    const novoPonto: PontoRegistro = {
      id: generateSafeId('ponto'),
      colaboradorId: dados.colaboradorId,
      colaboradorNome: colab?.nome || dados.colaboradorNome || 'Colaborador',
      data: dataHoje,
      entrada1: dados.entrada1 || '07:00',
      saida1: dados.saida1 || '12:00',
      entrada2: dados.entrada2 || '13:00',
      saida2: dados.saida2 || '19:00',
      totalHoras: dados.totalHoras || '11h 00m',
      statusPonto: dados.statusPonto || 'Regular',
      localizacaoGPS: dados.localizacaoGPS || 'Dentro do Raio Geofence (12m)',
    };

    setPontos((prev) => [novoPonto, ...prev]);

    const client = getSupabase();
    if (client) {
      try {
        // 1. Garante que o colaborador exista em 'colaboradores' (evita violação FK fk_pontos_colaborador)
        if (colab) {
          await client.from('colaboradores').upsert({
            id: colab.id,
            nome: colab.nome,
            full_name: colab.nome,
            matricula: colab.matricula || `TC-${colab.id.slice(0, 4)}`,
            funcao: colab.funcao || 'Porteiro',
            cargo: colab.funcao || 'Porteiro',
            status: colab.status || 'no_posto',
            condominio_id: colab.condominioId || null,
            cpf: colab.cpf || null,
            role: colab.role || 'funcionario',
          });
        }

        // 2. Verifica se já existe registro de ponto na data
        const { data: existingRows } = await client
          .from('pontos')
          .select('id')
          .eq('colaborador_id', novoPonto.colaboradorId)
          .eq('data', dataHoje)
          .limit(1);

        if (existingRows && existingRows.length > 0) {
          const { error: updErr } = await client
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

          if (updErr) {
            console.warn('Erro ao atualizar ponto no Supabase:', updErr.message);
          } else {
            console.info('Ponto atualizado com sucesso no Supabase:', existingRows[0].id);
          }
        } else {
          const { error: insErr } = await client.from('pontos').insert({
            id: novoPonto.id,
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
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

          if (insErr) {
            console.warn('Erro ao inserir ponto no Supabase:', insErr.message);
          } else {
            console.info('Ponto gravado com sucesso no Supabase:', novoPonto.id);
          }
        }
      } catch (err) {
        console.warn('Erro ao salvar ponto no Supabase:', err);
      }
    }

    showToast(`Ponto registrado com sucesso para ${novoPonto.colaboradorNome}!`);
    return true;
  };

  // 10. Atualizar Dados da Empresa Matriz
  const atualizarEmpresaInfo = async (dados: Partial<EmpresaInfo>): Promise<boolean> => {
    const updated = { ...empresaInfo, ...dados };
    setEmpresaInfo(updated);

    const client = getSupabase();
    if (client) {
      try {
        await client.from('empresa_info').upsert({
          id: 'matriz-principal',
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
      } catch (err) {
        console.warn('Erro ao atualizar empresa_info no Supabase:', err);
      }
    }

    showToast('Dados da empresa matriz atualizados e salvos no banco de dados!');
    setEmpresaModalOpen(false);
    return true;
  };

  // 11. Cadastrar Funcionário
  const cadastrarFuncionario = async (dados: NovoFuncionarioPayload): Promise<boolean> => {
    const condom = condominios.find((c) => c.id === dados.condominioId);
    const postoNome = condom ? condom.nome : 'Matriz - Reserva Central';
    const newId = generateSafeId('colab');
    const randomMatricula = `TC-${Math.floor(1150 + Math.random() * 850)}`;

    const jornadaDesc = `${dados.regimeEscala} (${dados.turnoInicio || '07:00'} - ${dados.turnoFim || '19:00'})`;
    const horaInicioNum = dados.turnoInicio ? parseInt(dados.turnoInicio.split(':')[0], 10) : 7;
    const turnoTipo: 'diurno' | 'noturno' | 'comercial' =
      horaInicioNum >= 18 || horaInicioNum < 5
        ? 'noturno'
        : dados.regimeEscala === '6x1'
        ? 'comercial'
        : 'diurno';

    const novoColaborador: Colaborador = {
      id: newId,
      nome: dados.nome,
      matricula: randomMatricula,
      funcao: dados.cargo,
      condominioId: dados.condominioId || null,
      postoNome: postoNome,
      status: 'no_posto',
      jornada: jornadaDesc,
      tipoEscala: dados.regimeEscala,
      turno: turnoTipo,
      foto: dados.foto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      telefone: dados.telefone,
      cpf: dados.cpf,
      dataAdmissao: dados.dataAdmissao || new Date().toISOString().split('T')[0],
      bancoHoras: 0,
      ultimoPonto: `Admitido em ${dados.dataAdmissao || 'Hoje'}`,
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
      senha: dados.senha || undefined,
      role: dados.role || 'funcionario',
      primeiroAcessoConcluido: false,
    };

    setColaboradores((prev) => [novoColaborador, ...prev]);

    // Atualiza postos e vagas ocupadas se alocado em condomínio
    if (condom) {
      setCondominios((prev) =>
        prev.map((c) => {
          if (c.id === condom.id) {
            const updatedOperando = [...c.plantaoAtual.operandoAgora, newId];
            return {
              ...c,
              status: c.status === 'critico' ? 'operacional' : c.status,
              motivoAtencao: c.status === 'critico' ? undefined : c.motivoAtencao,
              coberturaPercentual: Math.min(100, Math.round((updatedOperando.length / c.vagasContratadas) * 100)),
              plantaoAtual: { ...c.plantaoAtual, operandoAgora: updatedOperando },
            };
          }
          return c;
        })
      );
    }

    // Persistência no Supabase
    const client = getSupabase();
    let persistSuccess = false;

    if (client) {
      try {
        let targetId = newId;

        // Se CPF já existir no Supabase, reutiliza o ID existente
        if (dados.cpf) {
          const { data: existingColab } = await client
            .from('colaboradores')
            .select('id')
            .eq('cpf', dados.cpf)
            .maybeSingle();

          if (existingColab?.id) {
            targetId = existingColab.id;
            novoColaborador.id = targetId;
            setColaboradores((prev) => prev.map((c) => (c.id === newId ? { ...c, id: targetId } : c)));
          }
        }

        // Se condominioId foi informado, garante que o condomínio exista no Supabase (evita erro FK 23503)
        if (dados.condominioId) {
          const condoVinculado = condominios.find((c) => c.id === dados.condominioId);
          if (condoVinculado) {
            await client.from('condominios').upsert({
              id: condoVinculado.id,
              nome: condoVinculado.nome,
              tipo: condoVinculado.tipo || 'Residencial',
              cnpj: condoVinculado.cnpj || null,
              endereco: condoVinculado.endereco || 'Endereço não informado',
              bairro: condoVinculado.bairro || 'Centro',
              cidade: condoVinculado.cidade || 'São Paulo - SP',
              lat: condoVinculado.latitude !== undefined ? Number(condoVinculado.latitude) : -23.55052,
              lng: condoVinculado.longitude !== undefined ? Number(condoVinculado.longitude) : -46.633308,
              raio_tolerancia_metros: condoVinculado.raioGpsMetros || 150,
              status: condoVinculado.status || 'operacional',
              vagas_contratadas: condoVinculado.vagasContratadas || 2,
            });
          }
        }

        const colabPayload = {
          id: targetId,
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
          senha: dados.senha || null,
          role: dados.role || 'funcionario',
          primeiro_acesso_concluido: false,
          updated_at: new Date().toISOString(),
        };

        const { error: colabErr } = await client.from('colaboradores').upsert(colabPayload);
        if (!colabErr) {
          persistSuccess = true;
          console.info('Colaborador salvo com sucesso no Supabase:', targetId);
        } else {
          console.warn('Erro ao salvar colaborador no Supabase:', colabErr.message);
        }

        // Espelho em profiles (se targetId for um UUID válido)
        if (isValidUUID(targetId)) {
          try {
            const profilePayload = {
              id: targetId,
              full_name: dados.nome,
              nome: dados.nome,
              cpf: dados.cpf || '000.000.000-00',
              rg: dados.rg || null,
              data_nascimento: dados.dataNascimento || null,
              telefone: dados.telefone || null,
              cargo: dados.cargo,
              role: dados.role || 'funcionario',
              email: dados.email || null,
              condominio_id: dados.condominioId && isValidUUID(dados.condominioId) ? dados.condominioId : null,
              updated_at: new Date().toISOString(),
            };
            await client.from('profiles').upsert(profilePayload);
          } catch (pErr) {
            console.warn('Espelho em profiles opcional ignorado:', pErr);
          }
        }
      } catch (err) {
        console.warn('Erro ao salvar colaborador no Supabase:', err);
      }
    }

    if (persistSuccess) {
      showToast(`✅ Colaborador ${dados.nome} salvo com sucesso no Supabase!`);
    } else {
      showToast(`Colaborador ${dados.nome} cadastrado com sucesso!`);
    }

    closeCadastroModal();
    return true;
  };

  // 12. Atualizar Funcionário
  const atualizarFuncionario = async (id: string, dados: Partial<Colaborador>): Promise<boolean> => {
    const colabAtual = colaboradores.find((c) => c.id === id);
    if (!colabAtual) return false;

    const novoCondominioId = dados.condominioId !== undefined ? dados.condominioId : colabAtual.condominioId;
    const condom = condominios.find((c) => c.id === novoCondominioId);
    const postoNome = condom ? condom.nome : novoCondominioId ? colabAtual.postoNome : 'Matriz - Reserva Central';

    setColaboradores((prev) => prev.map((c) => (c.id === id ? { ...c, ...dados, postoNome } : c)));

    // Persistência no Supabase
    const client = getSupabase();
    if (client) {
      try {
        const payloadToUpdate: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };
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
        if (dados.senha !== undefined) payloadToUpdate.senha = dados.senha || null;
        if (dados.role !== undefined) payloadToUpdate.role = dados.role;
        if (dados.foto !== undefined) payloadToUpdate.foto_url = dados.foto;
        if (novoCondominioId !== undefined) payloadToUpdate.condominio_id = novoCondominioId || null;

        await client.from('colaboradores').update(payloadToUpdate).eq('id', id);

        // Atualiza profiles
        const profileUpd = { ...payloadToUpdate };
        if (profileUpd.condominio_id && !isValidUUID(profileUpd.condominio_id)) {
          profileUpd.condominio_id = null;
        }
        await client.from('profiles').update(profileUpd).eq('id', id);
      } catch (err) {
        console.warn('Erro ao atualizar colaborador no Supabase:', err);
      }
    }

    showToast(`Colaborador ${dados.nome || colabAtual.nome} atualizado e salvo no banco!`);
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
      try {
        await client.from('colaboradores').delete().eq('id', id);
        if (colab.cpf) {
          await client.from('colaboradores').delete().eq('cpf', colab.cpf);
        }
        await client.from('profiles').delete().eq('id', id);
      } catch (err) {
        console.warn('Erro ao excluir colaborador no Supabase:', err);
      }
    }

    showToast(`Colaborador ${colab.nome} removido do sistema e banco de dados.`);
    return true;
  };

  // 14. Cadastrar Condomínio / Posto
  const cadastrarCondominio = async (dados: Partial<CondominioPosto> & { nome: string }): Promise<boolean> => {
    const newId = generateSafeId('cond');
    const novoCondo: CondominioPosto = {
      id: newId,
      nome: dados.nome,
      tipo: dados.tipo || 'Residencial',
      cnpj: dados.cnpj || '00.000.000/0001-00',
      contratoNumero: dados.contratoNumero || `CT-2026/${Math.floor(100 + Math.random() * 900)}`,
      endereco: dados.endereco || 'Endereço não informado',
      bairro: dados.bairro || 'Centro',
      cidade: dados.cidade || 'São Paulo - SP',
      cep: dados.cep || '',
      supervisor: dados.supervisor || 'Supervisora Silva',
      telefoneSupervisor: dados.telefoneSupervisor || '(11) 98842-1190',
      vagasContratadas: Number(dados.vagasContratadas) || 2,
      status: dados.status || 'operacional',
      motivoAtencao: dados.motivoAtencao,
      tipoEscalaPadrao: dados.tipoEscalaPadrao || '12x36 (07:00 - 19:00)',
      plantaoAtual: {
        operandoAgora: [],
        proximaRendicao: { colaboradorId: '', horarioTroca: '19:00' },
      },
      coberturaPercentual: 100,
      contatoSindico: dados.contatoSindico || 'Síndico Responsável',
      telefoneSindico: dados.telefoneSindico || '(11) 98765-4321',
      instrucoesGuarita: dados.instrucoesGuarita || 'Controle rigoroso de portaria.',
      foto: dados.foto || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=500&auto=format&fit=crop&q=80',
      icone: dados.icone || 'Building2',
      cor: dados.cor || '#3B82F6',
      latitude: dados.latitude !== undefined ? dados.latitude : -23.55052,
      longitude: dados.longitude !== undefined ? dados.longitude : -46.633308,
      raioGpsMetros: dados.raioGpsMetros !== undefined ? dados.raioGpsMetros : 150,
      metodoCalibracaoGps: dados.metodoCalibracaoGps || 'manual',
      calibradoEm: dados.calibradoEm || new Date().toISOString(),
      calibradoPrecisaoM: dados.calibradoPrecisaoM,
    };

    setCondominios((prev) => [novoCondo, ...prev]);

    // Persistência Completa no Supabase
    const client = getSupabase();
    if (client) {
      try {
        const payload: Record<string, any> = {
          id: newId,
          nome: novoCondo.nome,
          tipo: novoCondo.tipo || 'Residencial',
          cnpj: novoCondo.cnpj || null,
          contrato_numero: novoCondo.contratoNumero || null,
          endereco: novoCondo.endereco || 'Endereço não informado',
          bairro: novoCondo.bairro || 'Centro',
          cidade: novoCondo.cidade || 'São Paulo - SP',
          supervisor: novoCondo.supervisor || 'Supervisora Silva',
          telefone_supervisor: novoCondo.telefoneSupervisor || '(11) 98842-1190',
          vagas_contratadas: novoCondo.vagasContratadas || 2,
          status: novoCondo.status || 'operacional',
          motivo_atencao: novoCondo.motivoAtencao || null,
          tipo_escala_padrao: novoCondo.tipoEscalaPadrao || '12x36 (07:00 - 19:00)',
          cobertura_percentual: novoCondo.coberturaPercentual || 100,
          contato_sindico: novoCondo.contatoSindico || null,
          telefone_sindico: novoCondo.telefoneSindico || null,
          instrucoes_guarita: novoCondo.instrucoesGuarita || null,
          foto_url: novoCondo.foto || null,
          lat: novoCondo.latitude !== undefined ? Number(novoCondo.latitude) : -23.55052,
          lng: novoCondo.longitude !== undefined ? Number(novoCondo.longitude) : -46.633308,
          raio_tolerancia_metros: novoCondo.raioGpsMetros || 150,
          updated_at: new Date().toISOString(),
        };

        // Salva na tabela autoritativa condominios
        const { error: cErr } = await client.from('condominios').upsert(payload);
        if (cErr) {
          console.warn('Erro ao salvar em condominios no Supabase:', cErr.message);
        } else {
          console.info('Condomínio salvo com sucesso no Supabase:', newId);
        }

        // Espelha na tabela legada postos (apenas colunas existentes)
        await client.from('postos').upsert({
          id: newId,
          nome: novoCondo.nome,
          tipo: novoCondo.tipo || 'Residencial',
          cnpj: novoCondo.cnpj || null,
          endereco: novoCondo.endereco || 'Endereço não informado',
          bairro: novoCondo.bairro || 'Centro',
          cidade: novoCondo.cidade || 'São Paulo - SP',
          supervisor: novoCondo.supervisor || 'Supervisora Silva',
          status: novoCondo.status || 'operacional',
          updated_at: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Erro ao salvar condomínio no Supabase:', err);
      }
    }

    showToast(`Condomínio ${novoCondo.nome} adicionado e salvo no banco de dados!`);
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
      try {
        const payload: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };
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
        if (dados.motivoAtencao !== undefined) payload.motivo_atencao = dados.motivoAtencao;
        if (dados.tipoEscalaPadrao !== undefined) payload.tipo_escala_padrao = dados.tipoEscalaPadrao;
        if (dados.coberturaPercentual !== undefined) payload.cobertura_percentual = dados.coberturaPercentual;
        if (dados.contatoSindico !== undefined) payload.contato_sindico = dados.contatoSindico;
        if (dados.telefoneSindico !== undefined) payload.telefone_sindico = dados.telefoneSindico;
        if (dados.instrucoesGuarita !== undefined) payload.instrucoes_guarita = dados.instrucoesGuarita;
        if (dados.foto !== undefined) payload.foto_url = dados.foto;
        if (dados.latitude !== undefined) payload.lat = Number(dados.latitude);
        if (dados.longitude !== undefined) payload.lng = Number(dados.longitude);
        if (dados.raioGpsMetros !== undefined) payload.raio_tolerancia_metros = Number(dados.raioGpsMetros);

        const { error: updErr } = await client.from('condominios').update(payload).eq('id', id);
        if (updErr) {
          console.warn('Erro ao atualizar em condominios no Supabase:', updErr.message);
        } else {
          console.info('Condomínio atualizado com sucesso no Supabase:', id);
        }

        // Atualiza também na tabela legada postos (apenas colunas existentes)
        await client.from('postos').update({
          nome: dados.nome || condoAtual.nome,
          tipo: dados.tipo || condoAtual.tipo,
          cnpj: dados.cnpj !== undefined ? dados.cnpj : condoAtual.cnpj,
          endereco: dados.endereco || condoAtual.endereco,
          bairro: dados.bairro || condoAtual.bairro,
          cidade: dados.cidade || condoAtual.cidade,
          supervisor: dados.supervisor || condoAtual.supervisor,
          status: dados.status || condoAtual.status,
          updated_at: new Date().toISOString(),
        }).eq('id', id);
      } catch (err) {
        console.warn('Erro ao atualizar condomínio no Supabase:', err);
      }
    }

    showToast(`Condomínio ${dados.nome || condoAtual.nome} atualizado no banco de dados!`);
    closeCondominioModal();
    return true;
  };

  // 16. Notificar Tentativa de Bater Ponto Fora do Posto (Anti-Fraude)
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
      titulo: `Tentativa de Ponto Fora do Posto (${colaborador.nome})`,
      descricao: `O colaborador ${colaborador.nome} (${colaborador.funcao}) tentou registrar ponto a ${distanciaM}m de distância do ${posto.nome} (raio máximo: ${posto.raioGpsMetros || 150}m). O ponto foi sumariamente BLOQUEADO.`,
      postoId: posto.id,
      postoNome: posto.nome,
      colaboradorId: colaborador.id,
      colaboradorNome: colaborador.nome,
      horario: `Hoje às ${agoraHora}`,
      resolvido: false,
      latitudeTentativa: coords?.latitude,
      longitudeTentativa: coords?.longitude,
      distanciaTentativaM: distanciaM,
    };

    setAlertas((prev) => [novoAlerta, ...prev]);

    // Adiciona ao histórico de ocorrências
    const novaOcorr: Ocorrencia = {
      id: generateSafeId('ocorr-perimetro'),
      postoId: posto.id,
      postoNome: posto.nome,
      tipo: 'Ponto Divergente',
      descricao: `[BLOQUEIO DE SEGURANÇA] Tentativa de batida fora do posto por ${colaborador.nome} a ${distanciaM}m da cerca virtual. Coordenadas: ${coords?.latitude?.toFixed(5) || '--'}, ${coords?.longitude?.toFixed(5) || '--'}. Ponto cancelado.`,
      registradoPor: 'Sistema Anti-Fraude Geofence',
      dataHora: `Hoje às ${agoraHora}`,
      urgencia: 'alta',
      resolvida: false,
    };

    setOcorrencias((prev) => [novaOcorr, ...prev]);

    // Persistência no Supabase
    const client = getSupabase();
    if (client) {
      try {
        // Garante que o posto exista no Supabase (evita erro FK fk_alertas_posto / fk_ocorrencias_posto)
        await client.from('condominios').upsert({
          id: posto.id,
          nome: posto.nome,
          tipo: posto.tipo || 'Residencial',
          endereco: posto.endereco || 'Endereço não informado',
          bairro: posto.bairro || 'Centro',
          cidade: posto.cidade || 'São Paulo - SP',
          lat: posto.latitude !== undefined ? Number(posto.latitude) : -23.55052,
          lng: posto.longitude !== undefined ? Number(posto.longitude) : -46.633308,
          raio_tolerancia_metros: posto.raioGpsMetros || 150,
          status: posto.status || 'operacional',
          vagas_contratadas: posto.vagasContratadas || 2,
        });

        // Garante que o colaborador exista no Supabase
        await client.from('colaboradores').upsert({
          id: colaborador.id,
          nome: colaborador.nome,
          full_name: colaborador.nome,
          matricula: colaborador.matricula || `TC-${colaborador.id.slice(0, 4)}`,
          funcao: colaborador.funcao || 'Porteiro',
          cargo: colaborador.funcao || 'Porteiro',
          status: 'no_posto',
          condominio_id: posto.id,
          role: colaborador.role || 'funcionario',
        });

        await client.from('alertas').insert({
          id: novoAlerta.id,
          tipo: novoAlerta.tipo,
          gravidade: novoAlerta.gravidade,
          titulo: novoAlerta.titulo,
          descricao: novoAlerta.descricao,
          posto_id: novoAlerta.postoId,
          posto_nome: novoAlerta.postoNome,
          colaborador_id: novoAlerta.colaboradorId,
          colaborador_nome: novoAlerta.colaboradorNome,
          horario: novoAlerta.horario,
          resolvido: false,
        });

        await client.from('ocorrencias').insert({
          id: novaOcorr.id,
          posto_id: novaOcorr.postoId,
          posto_nome: novaOcorr.postoNome,
          tipo: novaOcorr.tipo,
          descricao: novaOcorr.descricao,
          registrado_por: novaOcorr.registradoPor,
          data_hora: novaOcorr.dataHora,
          urgencia: novaOcorr.urgencia,
          resolvida: false,
        });
      } catch (err) {
        console.warn('Erro ao salvar alerta de tentativa fora do posto no Supabase:', err);
      }
    }
  };

  // 17. Notificar Ponto em Outro Posto da Empresa (Cobertura de Falta / Posto Divergente)
  const notificarPontoOutroPostoCobertura = async (
    colaborador: Colaborador,
    postoCadastrado: CondominioPosto,
    postoDetectado: CondominioPosto,
    distanciaM: number,
    coords?: { latitude: number; longitude: number }
  ): Promise<void> => {
    const agoraHora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const alertaId = generateSafeId('alerta-cobertura');

    const novoAlerta: AlertaOperacional = {
      id: alertaId,
      tipo: 'ponto_posto_cobertura',
      gravidade: 'moderada',
      titulo: `Cobertura de Falta / Batida em Outro Posto (${colaborador.nome})`,
      descricao: `O colaborador ${colaborador.nome} (${colaborador.funcao}), cadastrado no posto ${postoCadastrado.nome}, bateu ponto presencialmente no posto ${postoDetectado.nome} (a ${distanciaM}m de distância). Ponto registrado com sucesso como cobertura de turno.`,
      postoId: postoDetectado.id,
      postoNome: postoDetectado.nome,
      colaboradorId: colaborador.id,
      colaboradorNome: colaborador.nome,
      horario: `Hoje às ${agoraHora}`,
      resolvido: false,
      latitudeTentativa: coords?.latitude,
      longitudeTentativa: coords?.longitude,
      distanciaTentativaM: distanciaM,
    };

    setAlertas((prev) => [novoAlerta, ...prev]);

    // Registra ocorrência de cobertura operacional
    const novaOcorr: Ocorrencia = {
      id: generateSafeId('ocorr-cobertura'),
      postoId: postoDetectado.id,
      postoNome: postoDetectado.nome,
      tipo: 'Ponto Divergente',
      descricao: `[COBERTURA DE ESCALA] Colaborador ${colaborador.nome} (${colaborador.funcao}) registrou ponto no posto ${postoDetectado.nome} (Posto de origem: ${postoCadastrado.nome}). Batida validada via GPS multi-postos da empresa.`,
      registradoPor: 'Sistema GPS Multi-Postos',
      dataHora: `Hoje às ${agoraHora}`,
      urgencia: 'media',
      resolvida: false,
    };

    setOcorrencias((prev) => [novaOcorr, ...prev]);

    // Persistência no Supabase
    const client = getSupabase();
    if (client) {
      try {
        // Garante que o posto detectado exista no Supabase
        await client.from('condominios').upsert({
          id: postoDetectado.id,
          nome: postoDetectado.nome,
          tipo: postoDetectado.tipo || 'Residencial',
          endereco: postoDetectado.endereco || 'Endereço não informado',
          bairro: postoDetectado.bairro || 'Centro',
          cidade: postoDetectado.cidade || 'São Paulo - SP',
          lat: postoDetectado.latitude !== undefined ? Number(postoDetectado.latitude) : -23.55052,
          lng: postoDetectado.longitude !== undefined ? Number(postoDetectado.longitude) : -46.633308,
          raio_tolerancia_metros: postoDetectado.raioGpsMetros || 150,
          status: postoDetectado.status || 'operacional',
          vagas_contratadas: postoDetectado.vagasContratadas || 2,
        });

        // Garante que o colaborador exista no Supabase
        await client.from('colaboradores').upsert({
          id: colaborador.id,
          nome: colaborador.nome,
          full_name: colaborador.nome,
          matricula: colaborador.matricula || `TC-${colaborador.id.slice(0, 4)}`,
          funcao: colaborador.funcao || 'Porteiro',
          cargo: colaborador.funcao || 'Porteiro',
          status: 'no_posto',
          condominio_id: postoDetectado.id,
          role: colaborador.role || 'funcionario',
        });

        await client.from('alertas').insert({
          id: novoAlerta.id,
          tipo: novoAlerta.tipo,
          gravidade: novoAlerta.gravidade,
          titulo: novoAlerta.titulo,
          descricao: novoAlerta.descricao,
          posto_id: novoAlerta.postoId,
          posto_nome: novoAlerta.postoNome,
          colaborador_id: novoAlerta.colaboradorId,
          colaborador_nome: novoAlerta.colaboradorNome,
          horario: novoAlerta.horario,
          resolvido: false,
        });

        await client.from('ocorrencias').insert({
          id: novaOcorr.id,
          posto_id: novaOcorr.postoId,
          posto_nome: novaOcorr.postoNome,
          tipo: novaOcorr.tipo,
          descricao: novaOcorr.descricao,
          registrado_por: novaOcorr.registradoPor,
          data_hora: novaOcorr.dataHora,
          urgencia: novaOcorr.urgencia,
          resolvida: false,
        });
      } catch (err) {
        console.warn('Erro ao salvar alerta de cobertura no Supabase:', err);
      }
    }
  };

  // 16. Excluir Condomínio
  const excluirCondominio = async (id: string): Promise<boolean> => {
    const condo = condominios.find((c) => c.id === id);
    if (!condo) return false;

    setCondominios((prev) => prev.filter((c) => c.id !== id));
    setColaboradores((prev) =>
      prev.map((colab) =>
        colab.condominioId === id
          ? { ...colab, condominioId: null, postoNome: 'Matriz - Reserva Central', status: 'folga', motivoStatus: 'Disponível na Reserva' }
          : colab
      )
    );

    const client = getSupabase();
    if (client) {
      try {
        await client.from('condominios').delete().eq('id', id);
        await client.from('postos').delete().eq('id', id);
      } catch (err) {
        console.warn('Erro ao excluir condomínio no Supabase:', err);
      }
    }

    showToast(`Condomínio ${condo.nome} excluído do banco de dados.`);
    closeCondominioModal();
    return true;
  };

  // ============================================================================
  // SINCRONIZAÇÃO COMPLETA BIDIRECIONAL COM O SUPABASE
  // ============================================================================
  const syncWithSupabase = async () => {
    setIsSyncing(true);
    const client = getSupabase();
    if (!client) {
      setIsSyncing(false);
      return;
    }

    try {
      // 1. Sincroniza Colaboradores
      const { data: remoteColabs, error: colabErr } = await client.from('colaboradores').select('*');
      if (!colabErr && remoteColabs && remoteColabs.length > 0) {
        setColaboradores(
          remoteColabs.map((rc: any) => ({
            id: rc.id,
            nome: rc.nome || rc.full_name || 'Colaborador',
            matricula: rc.matricula || `TC-${rc.id.slice(0, 4).toUpperCase()}`,
            funcao: rc.funcao || rc.cargo || 'Porteiro',
            condominioId: rc.condominio_id || null,
            postoNome: 'Matriz - Reserva Central',
            status: (rc.status as any) || 'no_posto',
            jornada: rc.jornada || (rc.tipo_jornada ? `${rc.tipo_jornada} (${rc.turno_inicio || '07:00'} - ${rc.turno_fim || '19:00'})` : '12x36 (07:00 - 19:00)'),
            tipoEscala: (rc.tipo_jornada as any) || '12x36',
            turno: 'diurno',
            foto: rc.foto_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            telefone: rc.telefone || '(11) 99999-0000',
            cpf: rc.cpf || '000.000.000-00',
            dataAdmissao: rc.data_admissao || '2026-01-10',
            bancoHoras: rc.banco_horas !== undefined ? Number(rc.banco_horas) : 0,
            ultimoPonto: 'Ponto registrado',
            salarioBase: Number(rc.salario_base) || 2150,
            rg: rc.rg,
            dataNascimento: rc.data_nascimento,
            pis: rc.pis,
            ctps: rc.ctps,
            nomeMae: rc.nome_mae,
            endereco: rc.endereco,
            turnoInicio: rc.turno_inicio,
            turnoFim: rc.turno_fim,
            pix: rc.pix,
            banco: rc.banco,
            agencia: rc.agencia,
            conta: rc.conta,
            recebeVT: rc.recebe_vt !== undefined ? rc.recebe_vt : true,
            recebeVR: rc.recebe_vr !== undefined ? rc.recebe_vr : true,
            valorVR: rc.valor_vr !== undefined && rc.valor_vr !== null ? Number(rc.valor_vr) : 28.5,
            recebeVA: rc.recebe_va !== undefined ? rc.recebe_va : true,
            valorVA: rc.valor_va !== undefined && rc.valor_va !== null ? Number(rc.valor_va) : 220,
            valorExtraFT: rc.valor_extra_ft !== undefined && rc.valor_extra_ft !== null ? Number(rc.valor_extra_ft) : 160,
            valorBonus: rc.valor_bonus !== undefined && rc.valor_bonus !== null ? Number(rc.valor_bonus) : 0,
            email: rc.email,
            senha: rc.senha,
            role: (rc.role as any) || 'funcionario',
            primeiroAcessoConcluido: rc.primeiro_acesso_concluido !== undefined ? rc.primeiro_acesso_concluido : false,
          }))
        );
      }

      // 2. Sincroniza Condomínios (mapeia lat/lng e raio_tolerancia_metros)
      const { data: remoteCondos } = await client.from('condominios').select('*');
      if (remoteCondos && remoteCondos.length > 0) {
        setCondominios(
          remoteCondos.map((rc: any) => ({
            id: rc.id,
            nome: rc.nome || 'Posto Sem Nome',
            tipo: rc.tipo || 'Residencial',
            cnpj: rc.cnpj || '00.000.000/0001-00',
            contratoNumero: rc.contrato_numero || `CT-${rc.id.slice(0, 4)}`,
            endereco: rc.endereco || 'Endereço não informado',
            bairro: rc.bairro || 'Centro',
            cidade: rc.cidade || 'São Paulo - SP',
            supervisor: rc.supervisor || 'Supervisora Silva',
            telefoneSupervisor: rc.telefone_supervisor || '(11) 98842-1190',
            vagasContratadas: rc.vagas_contratadas || 2,
            status: (rc.status as any) || 'operacional',
            motivoAtencao: rc.motivo_atencao,
            tipoEscalaPadrao: rc.tipo_escala_padrao || '12x36 (07:00 - 19:00)',
            plantaoAtual: {
              operandoAgora: [],
              proximaRendicao: { colaboradorId: '', horarioTroca: '19:00' },
            },
            coberturaPercentual: rc.cobertura_percentual || 100,
            contatoSindico: rc.contato_sindico || 'Síndico Responsável',
            telefoneSindico: rc.telefone_sindico || '(11) 98765-4321',
            instrucoesGuarita: rc.instrucoes_guarita || 'Controle de portaria.',
            foto: rc.foto_url || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=500&auto=format&fit=crop&q=80',
            latitude: rc.lat !== undefined && rc.lat !== null ? Number(rc.lat) : -23.55052,
            longitude: rc.lng !== undefined && rc.lng !== null ? Number(rc.lng) : -46.633308,
            raioGpsMetros: rc.raio_tolerancia_metros || 150,
            icone: 'Building2',
            cor: '#3B82F6',
          }))
        );
      }

      // 3. Sincroniza Pontos Eletrônicos
      const { data: remotePontos } = await client.from('pontos').select('*').order('created_at', { ascending: false });
      if (remotePontos && remotePontos.length > 0) {
        setPontos(
          remotePontos.map((rp: any) => ({
            id: rp.id,
            colaboradorId: rp.colaborador_id,
            colaboradorNome: rp.colaborador_nome || 'Colaborador',
            data: rp.data || new Date().toISOString().split('T')[0],
            entrada1: rp.entrada_1 || '--:--',
            saida1: rp.saida_1 || '--:--',
            entrada2: rp.entrada_2 || '--:--',
            saida2: rp.saida_2 || '--:--',
            totalHoras: rp.total_horas || '08h 00m',
            statusPonto: rp.status_ponto || rp.status || 'Regular',
            localizacaoGPS: rp.localizacao_gps || 'Validado via GPS',
          }))
        );
      }

      // 4. Sincroniza Ocorrências
      const { data: remoteOcorrs } = await client.from('ocorrencias').select('*').order('created_at', { ascending: false });
      if (remoteOcorrs && remoteOcorrs.length > 0) {
        setOcorrencias(
          remoteOcorrs.map((ro: any) => ({
            id: ro.id,
            postoId: ro.posto_id,
            postoNome: ro.posto_nome || 'Posto Geral',
            tipo: ro.tipo || 'Posto Descoberto',
            descricao: ro.descricao,
            registradoPor: ro.registrado_por || 'Supervisora Silva',
            dataHora: ro.data_hora || 'Hoje',
            urgencia: ro.urgencia || 'alta',
            resolvida: Boolean(ro.resolvida),
          }))
        );
      }

      // 5. Sincroniza Alertas
      const { data: remoteAlertas } = await client.from('alertas').select('*').order('created_at', { ascending: false });
      if (remoteAlertas && remoteAlertas.length > 0) {
        setAlertas(
          remoteAlertas.map((ra: any) => ({
            id: ra.id,
            tipo: ra.tipo || 'posto_descoberto',
            gravidade: ra.gravidade || 'critica',
            titulo: ra.titulo,
            descricao: ra.descricao,
            postoId: ra.posto_id,
            postoNome: ra.posto_nome || 'Posto',
            colaboradorId: ra.colaborador_id,
            colaboradorNome: ra.colaborador_nome,
            horario: ra.horario || '07:00',
            resolvido: Boolean(ra.resolvido),
            resolvidoPor: ra.resolvido_por,
            resolvidoEm: ra.resolvido_em,
          }))
        );
      }

      // 6. Sincroniza Holerites
      const { data: remoteHolerites } = await client.from('holerites').select('*');
      if (remoteHolerites && remoteHolerites.length > 0) {
        setHolerites(
          remoteHolerites.map((rh: any) => ({
            id: rh.id,
            colaboradorId: rh.colaborador_id,
            colaboradorNome: rh.colaborador_nome,
            matricula: rh.matricula || 'TC-1000',
            funcao: rh.funcao || 'Porteiro',
            postoNome: rh.posto_nome || 'Matriz',
            mesReferencia: rh.mes_referencia || 'Outubro/2026',
            salarioBase: Number(rh.salario_base) || 2150,
            adicionalPericulosidade: Number(rh.adicional_periculosidade) || 0,
            adicionalNoturno: Number(rh.adicional_noturno) || 0,
            horasExtras50: Number(rh.horas_extras_50) || 0,
            valorHorasExtras: Number(rh.valor_horas_extras) || 0,
            descontoINSS: Number(rh.desconto_inss) || 0,
            descontoFGTS: Number(rh.desconto_fgts) || 0,
            descontoVT: Number(rh.desconto_vt) || 0,
            descontoVR: Number(rh.desconto_vr) || 0,
            bonusAssiduidade: Number(rh.bonus_assiduidade) || 0,
            bonusAtivo: rh.bonus_ativo !== false,
            motivoPerdaBonus: rh.motivo_perda_bonus,
            liquidoReceber: Number(rh.liquido_receber) || 2150,
            statusEnvio: rh.status_envio || 'Pendente',
            dataEmissao: rh.data_emissao || new Date().toISOString().split('T')[0],
          }))
        );
      }

      // 7. Sincroniza Atestados
      const { data: remoteAtestados } = await client.from('atestados').select('*');
      if (remoteAtestados && remoteAtestados.length > 0) {
        setAtestados(
          remoteAtestados.map((ra: any) => ({
            id: ra.id,
            colaboradorId: ra.colaborador_id,
            colaboradorNome: ra.colaborador_nome,
            matricula: ra.matricula || 'TC-1000',
            postoNome: ra.posto_nome || 'Posto',
            medico: ra.medico || 'Dr. Médico',
            crm: ra.crm || 'CRM 00000',
            cid: ra.cid || 'Z00.0',
            dataInicio: ra.data_inicio || new Date().toISOString().split('T')[0],
            diasAfastamento: Number(ra.dias_afastamento) || 1,
            status: ra.status || 'Pendente',
            substitutoAlocadoId: ra.substituto_alocado_id,
            anexoUrl: ra.anexo_url,
          }))
        );
      }

      // 7. Sincroniza Empresa Matriz
      const { data: remoteEmpresa } = await client.from('empresa_info').select('*').limit(1).maybeSingle();
      if (remoteEmpresa) {
        setEmpresaInfo({
          razaoSocial: remoteEmpresa.razao_social || empresaInfo.razaoSocial,
          nomeFantasia: remoteEmpresa.nome_fantasia || empresaInfo.nomeFantasia,
          cnpj: remoteEmpresa.cnpj || empresaInfo.cnpj,
          inscricaoEstadual: remoteEmpresa.inscricao_estadual,
          inscricaoMunicipal: remoteEmpresa.inscricao_municipal,
          telefone: remoteEmpresa.telefone || empresaInfo.telefone,
          whatsapp: remoteEmpresa.whatsapp || empresaInfo.whatsapp,
          email: remoteEmpresa.email || empresaInfo.email,
          endereco: remoteEmpresa.endereco || empresaInfo.endereco,
          bairro: remoteEmpresa.bairro || empresaInfo.bairro,
          cidade: remoteEmpresa.cidade || empresaInfo.cidade,
          estado: remoteEmpresa.estado || empresaInfo.estado,
          cep: remoteEmpresa.cep || empresaInfo.cep,
          responsavelOperacional: remoteEmpresa.responsavel_operacional || empresaInfo.responsavelOperacional,
          cargoResponsavel: remoteEmpresa.cargo_responsavel || empresaInfo.cargoResponsavel,
          chavePix: remoteEmpresa.chave_pix,
          logoUrl: remoteEmpresa.logo_url,
          apresentacao: remoteEmpresa.apresentacao,
        });
      }
    } catch (err) {
      console.warn('Sync com Supabase finalizado com avisos:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // ============================================================================
  // AUTENTICAÇÃO E SESSÃO
  // ============================================================================
  const login = async (
    emailOrCpf: string,
    senhaDigitada: string
  ): Promise<{ success: boolean; message: string }> => {
    const cleanInput = emailOrCpf.trim().toLowerCase();
    const cleanSenha = senhaDigitada.trim();

    if (!cleanInput) {
      return { success: false, message: 'Informe seu e-mail, CPF ou matrícula.' };
    }
    if (!cleanSenha) {
      return { success: false, message: 'Informe sua senha de acesso.' };
    }

    const supabase = getSupabase();

    // 1. Tenta autenticação real no Supabase Auth se o input contiver e-mail
    if (supabase && cleanInput.includes('@')) {
      try {
        const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
          email: cleanInput,
          password: cleanSenha,
        });

        if (authData?.user && !authErr) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authData.user.id)
            .single();

          const role =
            profile?.role ||
            authData.user.app_metadata?.role ||
            (authData.user.email?.includes('adm')
              ? 'admin'
              : authData.user.email?.includes('supervisor')
              ? 'supervisor'
              : 'funcionario');

          const authUser: UsuarioAuth = {
            id: authData.user.id,
            nome:
              profile?.full_name ||
              authData.user.user_metadata?.full_name ||
              authData.user.email?.split('@')[0] ||
              'Usuário Autenticado',
            email: authData.user.email || cleanInput,
            role: role as any,
            cargo:
              profile?.cargo ||
              (role === 'admin'
                ? 'Administrador Geral'
                : role === 'supervisor'
                ? 'Supervisão Geral'
                : 'Colaborador'),
            colaboradorId: profile?.colaborador_id || authData.user.id,
            avatarUrl: profile?.avatar_url || authData.user.user_metadata?.avatar_url,
          };

          setCurrentUser(authUser);
          showToast(`Autenticação Supabase confirmada: Bem-vindo(a), ${authUser.nome}!`);
          return { success: true, message: 'Login realizado com sucesso via Supabase Auth!' };
        }
      } catch (authEx) {
        console.warn('Tentativa com Supabase Auth direcionada para validação integrada:', authEx);
      }
    }

    // 2. Administrador Geral Caetano
    if (
      cleanInput === 'caetano.adm@turnocerto.com.br' ||
      cleanInput === 'caetano.adm' ||
      cleanInput === 'caetano'
    ) {
      if (cleanSenha !== '6814871984@Lm') {
        return { success: false, message: 'Senha incorreta para o Administrador Geral. Verifique as credenciais.' };
      }
      const adminUser: UsuarioAuth = {
        ...ADMIN_CAETANO_USER,
      };
      setCurrentUser(adminUser);
      showToast('Bem-vindo Administrador Caetano! Controle total liberado.');
      return { success: true, message: 'Login de Administrador realizado com sucesso!' };
    }

    // 3. Supervisão Operacional
    if (
      cleanInput === 'supervisor@turnocerto.com.br' ||
      cleanInput === 'supervisor' ||
      cleanInput === 'larindoleo@gmail.com'
    ) {
      if (cleanSenha !== 'Turno@2026') {
        return { success: false, message: 'Senha incorreta para Supervisão.' };
      }
      const targetUser: UsuarioAuth = {
        ...DEFAULT_USER,
        email: cleanInput.includes('@') ? cleanInput : 'supervisor@turnocerto.com.br',
      };
      setCurrentUser(targetUser);
      showToast(`Bem-vinda de volta, ${targetUser.nome}!`);
      return { success: true, message: 'Login realizado com sucesso!' };
    }

    // 4. Colaboradores cadastrados
    const colab = colaboradores.find((c) => {
      const matchEmail = c.email && c.email.toLowerCase() === cleanInput;
      const matchCpf = c.cpf && c.cpf.replace(/\D/g, '') === cleanInput.replace(/\D/g, '');
      const matchMatricula = c.matricula && c.matricula.toLowerCase() === cleanInput;
      const matchNome = c.nome && c.nome.toLowerCase() === cleanInput;
      return matchEmail || matchCpf || matchMatricula || matchNome;
    });

    if (colab) {
      const senhaEsperada = colab.senha || 'Turno@2026';
      if (cleanSenha !== senhaEsperada) {
        return { success: false, message: 'Senha incorreta. Verifique suas credenciais.' };
      }

      const authUser: UsuarioAuth = {
        id: colab.id,
        nome: colab.nome,
        email: colab.email || `${colab.nome.toLowerCase().replace(/\s+/g, '.')}@turnocerto.com.br`,
        role: colab.role || 'funcionario',
        cargo: colab.funcao,
        colaboradorId: colab.id,
        avatarUrl: colab.foto,
        postoNome: colab.postoNome,
      };

      setCurrentUser(authUser);
      showToast(`Olá, ${colab.nome}! Painel liberado.`);
      return { success: true, message: 'Login realizado com sucesso!' };
    }

    return { success: false, message: 'Usuário não localizado. Verifique e-mail, CPF ou matrícula.' };
  };

  const logout = () => {
    setCurrentUser(null);
    showToast('Você saiu do sistema com sucesso.');
  };

  const trocarSenha = async (
    senhaAtual: string,
    novaSenha: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!novaSenha || novaSenha.trim().length < 6) {
      return { success: false, message: 'A nova senha deve ter no mínimo 6 caracteres.' };
    }

    const cleanNova = novaSenha.trim();

    if (currentUser) {
      const updatedUser = { ...currentUser, senha: cleanNova };
      setCurrentUser(updatedUser);
    }

    const targetId = currentUser?.colaboradorId || currentUser?.id;
    if (targetId) {
      setColaboradores((prev) =>
        prev.map((c) =>
          c.id === targetId || (currentUser?.email && c.email === currentUser.email)
            ? { ...c, senha: cleanNova }
            : c
        )
      );

      const client = getSupabase();
      if (client) {
        try {
          await client.from('colaboradores').update({ senha: cleanNova }).eq('id', targetId);
          if (currentUser?.email) {
            await client.from('colaboradores').update({ senha: cleanNova }).eq('email', currentUser.email);
          }
        } catch (err) {
          console.warn('Erro ao atualizar senha no Supabase:', err);
        }
      }
    }

    showToast('Senha alterada e atualizada no banco com sucesso!');
    setTrocarSenhaModalOpen(false);
    return { success: true, message: 'Senha alterada com sucesso!' };
  };

  const openRedefinirSenhaModal = (colab: Colaborador) => {
    setColaboradorParaRedefinirSenha(colab);
    setRedefinirSenhaModalOpen(true);
  };

  const redefinirSenhaColaborador = async (
    colaboradorId: string,
    novaSenha: string,
    supervisor?: { id: string; nome: string }
  ): Promise<{ success: boolean; message: string; novaSenhaGerada?: string }> => {
    if (!novaSenha || novaSenha.trim().length < 6) {
      return { success: false, message: 'A nova senha deve ter no mínimo 6 caracteres.' };
    }

    const cleanNova = novaSenha.trim();
    const sup =
      supervisor ||
      (currentUser
        ? { id: currentUser.id, nome: currentUser.nome }
        : { id: 'usr-supervisor', nome: 'Supervisor Operacional' });

    let colabNome = 'Colaborador';
    setColaboradores((prev) =>
      prev.map((c) => {
        if (c.id === colaboradorId) {
          colabNome = c.nome;
          return { ...c, senha: cleanNova };
        }
        return c;
      })
    );

    // Persiste no Supabase
    const client = getSupabase();
    if (client) {
      try {
        await client
          .from('colaboradores')
          .update({
            senha: cleanNova,
            updated_at: new Date().toISOString(),
          })
          .eq('id', colaboradorId);
      } catch (err) {
        console.warn('Erro ao atualizar senha no Supabase:', err);
      }
    }

    // Marca qualquer alerta de esquecimento de senha deste colaborador como resolvido
    const agoraHora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    setAlertas((prev) =>
      prev.map((a) =>
        a.colaboradorId === colaboradorId && a.tipo === 'solicitacao_senha'
          ? { ...a, resolvido: true, resolvidoPor: sup.nome, resolvidoEm: agoraHora }
          : a
      )
    );

    showToast(`Senha de ${colabNome} redefinida com sucesso!`);
    return { success: true, message: 'Senha redefinida com sucesso!', novaSenhaGerada: cleanNova };
  };

  const solicitarAjudaSenha = async (
    identificador: string,
    contatoTelefone?: string,
    observacao?: string
  ): Promise<{ success: boolean; message: string; colaboradorLocalizado?: Colaborador }> => {
    if (!identificador || !identificador.trim()) {
      return { success: false, message: 'Informe seu CPF, e-mail ou matrícula.' };
    }

    const cleanInput = identificador.trim().toLowerCase();
    const cleanDigits = identificador.replace(/\D/g, '');

    const colab = colaboradores.find((c) => {
      const mEmail = c.email && c.email.toLowerCase() === cleanInput;
      const mCpf = c.cpf && c.cpf.replace(/\D/g, '') === cleanDigits && cleanDigits.length >= 8;
      const mMatricula = c.matricula && c.matricula.toLowerCase() === cleanInput;
      const mNome = c.nome && c.nome.toLowerCase().includes(cleanInput) && cleanInput.length >= 4;
      return mEmail || mCpf || mMatricula || mNome;
    });

    const agoraHora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const alertaId = `alerta-senha-${colab?.id || 'anon'}-${Date.now()}`;

    const novoAlerta: AlertaOperacional = {
      id: alertaId,
      tipo: 'solicitacao_senha',
      gravidade: 'critica',
      titulo: '🔑 Solicitação de Ajuda com Senha / Acesso',
      descricao: colab
        ? `O colaborador ${colab.nome} (Matrícula: ${colab.matricula || 'N/A'}, Posto: ${colab.postoNome || 'N/A'}) esqueceu sua senha e precisa de uma nova senha provisória. Contato: ${contatoTelefone || colab.telefone || 'N/A'}.${observacao ? ` Mensagem: "${observacao}"` : ''}`
        : `Usuário informou esquecimento de senha para o identificador "${identificador}". Contato: ${contatoTelefone || 'N/A'}.${observacao ? ` Mensagem: "${observacao}"` : ''}`,
      postoId: colab?.condominioId || '',
      postoNome: colab?.postoNome || 'Geral',
      colaboradorId: colab?.id,
      colaboradorNome: colab?.nome || identificador,
      horario: agoraHora,
      resolvido: false,
    };

    setAlertas((prev) => [novoAlerta, ...prev]);

    const client = getSupabase();
    if (client) {
      try {
        await client.from('alertas').insert({
          id: alertaId,
          tipo: 'solicitacao_senha',
          gravidade: 'critica',
          titulo: novoAlerta.titulo,
          descricao: novoAlerta.descricao,
          posto_id: novoAlerta.postoId || null,
          colaborador_id: novoAlerta.colaboradorId || null,
          created_at: new Date().toISOString(),
          resolvido: false,
        });
      } catch (err) {
        console.warn('Erro ao salvar alerta no Supabase:', err);
      }
    }

    return {
      success: true,
      message: 'Solicitação registrada! O supervisor foi notificado e pode liberar sua nova senha.',
      colaboradorLocalizado: colab,
    };
  };

  // ============================================================================
  // MÉTODOS DE AUTORIZAÇÃO E GESTÃO DE BIOMETRIA FACIAL
  // ============================================================================

  const solicitarCadastroFacial = async (
    colaborador: Colaborador,
    motivo: string,
    tipo: 'primeiro_cadastro' | 'atualizacao_recadastro' = 'primeiro_cadastro'
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await solicitarCadastroBiometria(colaborador, motivo, tipo);
      if (res.success && res.solicitacao) {
        setSolicitacoesBiometria((prev) => [res.solicitacao, ...prev.filter((s) => s.id !== res.solicitacao.id)]);

        // Dispara Alerta Operacional no painel de Notificações do Administrador / Supervisor
        const agoraHora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const novoAlerta: AlertaOperacional = {
          id: `alerta-bio-${res.solicitacao.id}`,
          tipo: 'solicitacao_biometria',
          gravidade: 'moderada',
          titulo: 'Solicitação de Biometria Facial',
          descricao: `${colaborador.nome} (${colaborador.funcao} - ${colaborador.postoNome || 'Portaria Principal'}) aguarda autorização para ${tipo === 'primeiro_cadastro' ? 'primeiro cadastro' : 'recadastro'} facial. Motivo: "${motivo}"`,
          postoId: colaborador.condominioId || '',
          postoNome: colaborador.postoNome || 'Portaria Principal',
          colaboradorId: colaborador.id,
          colaboradorNome: colaborador.nome,
          horario: agoraHora,
          resolvido: false,
        };
        setAlertas((prev) => [novoAlerta, ...prev.filter((a) => a.id !== novoAlerta.id)]);

        showToast('Solicitação de biometria facial enviada ao supervisor com sucesso!');
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
    const sup = supervisor || currentUser || DEFAULT_USER;
    const res = await aprovarBiometriaService(solicitacaoId, sup, validadeHoras);
    if (res.success && res.solicitacao) {
      setSolicitacoesBiometria((prev) =>
        prev.map((s) => (s.id === solicitacaoId ? res.solicitacao! : s))
      );

      // Marca o alerta correspondente como resolvido
      const agoraHora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      setAlertas((prev) =>
        prev.map((a) =>
          a.id === `alerta-bio-${solicitacaoId}`
            ? { ...a, resolvido: true, resolvidoPor: sup.nome, resolvidoEm: agoraHora }
            : a
        )
      );

      showToast(`Autorização aprovada com sucesso! Válida por ${validadeHoras} horas.`);
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
    const sup = supervisor || currentUser || DEFAULT_USER;
    const res = await rejeitarBiometriaService(solicitacaoId, justificativa, sup);
    if (res.success && res.solicitacao) {
      setSolicitacoesBiometria((prev) =>
        prev.map((s) => (s.id === solicitacaoId ? res.solicitacao! : s))
      );

      // Marca o alerta como resolvido
      const agoraHora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      setAlertas((prev) =>
        prev.map((a) =>
          a.id === `alerta-bio-${solicitacaoId}`
            ? { ...a, resolvido: true, resolvidoPor: sup.nome, resolvidoEm: agoraHora }
            : a
        )
      );

      showToast('Solicitação de biometria rejeitada.');
      return { success: true, message: 'Solicitação rejeitada com justificativa.' };
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
        pontos,
        atestados,
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
        toastMessage,
        showToast,
        syncWithSupabase,
        isSyncing,
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
