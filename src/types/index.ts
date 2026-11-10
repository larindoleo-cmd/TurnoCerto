export type TabType = 'operacao' | 'equipe' | 'postos' | 'matriz' | 'rh';

export type StatusColaborador = 'no_posto' | 'folga' | 'falta' | 'afastado';

export type FuncaoColaborador =
  | 'Porteiro Líder'
  | 'Porteiro'
  | 'Controlador de Acesso'
  | 'Vigilante Patrimonial'
  | 'Auxiliar de Limpeza'
  | 'Zelador'
  | 'Supervisor Operacional'
  | 'Volante de Cobertura';

export interface Colaborador {
  id: string;
  nome: string;
  matricula: string;
  funcao: FuncaoColaborador;
  condominioId: string | null;
  postoNome: string;
  status: StatusColaborador;
  jornada: string; // ex: '12x36 (07:00 - 19:00)'
  tipoEscala: '12x36' | '6x1' | '5x2';
  turno: 'diurno' | 'noturno' | 'comercial';
  foto: string;
  telefone: string;
  cpf: string;
  dataAdmissao: string;
  bancoHoras: number;
  ultimoPonto?: string;
  motivoStatus?: string;
  salarioBase: number;
  rg?: string;
  dataNascimento?: string;
  pis?: string;
  ctps?: string;
  nomeMae?: string;
  endereco?: string;
  turnoInicio?: string;
  turnoFim?: string;
  pix?: string;
  banco?: string;
  agencia?: string;
  conta?: string;
  recebeVT?: boolean;
  recebeVR?: boolean;
  valorVR?: number;
  recebeVA?: boolean;
  valorVA?: number;
  valorExtraFT?: number;
  plantoesFT?: number;
  valorBonus?: number;
  // Credenciais de Acesso ao Painel
  email?: string;
  senha?: string;
  role?: 'admin' | 'supervisor' | 'funcionario';
  primeiroAcessoConcluido?: boolean;
}

export interface NovoFuncionarioPayload {
  // Etapa 1
  foto: string;
  nome: string;
  cpf: string;
  rg: string;
  telefone: string;
  dataNascimento: string;
  // Credenciais de Acesso ao Painel do Colaborador
  email?: string;
  senha?: string;
  role?: 'admin' | 'supervisor' | 'funcionario';
  // Etapa 2
  pis: string;
  ctps: string;
  nomeMae: string;
  endereco: string;
  // Etapa 3
  condominioId: string;
  cargo: FuncaoColaborador;
  regimeEscala: '12x36' | '6x1' | '5x2';
  turnoInicio: string;
  turnoFim: string;
  dataAdmissao: string;
  salarioBase: number;
  // Etapa 4
  pix: string;
  banco: string;
  agencia: string;
  conta: string;
  recebeVT: boolean;
  recebeVR?: boolean;
  valorVR?: number;
  recebeVA?: boolean;
  valorVA?: number;
  valorExtraFT?: number;
  valorBonus?: number;
}

export interface CondominioPosto {
  id: string;
  nome: string;
  tipo: 'Residencial' | 'Comercial' | 'Industrial' | 'Condomínio de Casas';
  cnpj: string;
  contratoNumero: string;
  endereco: string;
  bairro: string;
  cidade: string;
  cep?: string;
  supervisor: string;
  telefoneSupervisor: string;
  vagasContratadas: number;
  status: 'operacional' | 'atencao' | 'critico';
  motivoAtencao?: string;
  tipoEscalaPadrao: string;
  plantaoAtual: {
    operandoAgora: string[]; // Colaborador IDs
    proximaRendicao: {
      colaboradorId: string;
      horarioTroca: string;
    };
  };
  coberturaPercentual: number;
  contatoSindico: string;
  telefoneSindico: string;
  instrucoesGuarita: string;
  foto?: string;
  latitude?: number;
  longitude?: number;
  raioGpsMetros?: number;
  metodoCalibracaoGps?: 'cep_endereco' | 'no_local' | 'manual';
  calibradoEm?: string;
  calibradoPrecisaoM?: number;
  icone?: string; // Nome do ícone Lucide (ex: 'Building2', 'Shield', 'TreePine', 'Landmark')
  cor?: string;   // Código hexadecimal da cor visual (ex: '#3B82F6')
}

export interface AlertaOperacional {
  id: string;
  tipo:
    | 'posto_descoberto'
    | 'falta'
    | 'atraso'
    | 'atestado_pendente'
    | 'tentativa_ponto_fora_posto'
    | 'ponto_posto_cobertura'
    | 'posto_divergente'
    | 'solicitacao_biometria';
  gravidade: 'critica' | 'moderada' | 'informativa';
  titulo: string;
  descricao: string;
  postoId: string;
  postoNome: string;
  colaboradorId?: string;
  colaboradorNome?: string;
  horario: string;
  resolvido: boolean;
  resolvidoPor?: string;
  resolvidoEm?: string;
  latitudeTentativa?: number;
  longitudeTentativa?: number;
  distanciaTentativaM?: number;
}

export interface Ocorrencia {
  id: string;
  postoId: string;
  postoNome: string;
  tipo: 'Posto Descoberto' | 'Atraso' | 'Falta de Material' | 'Manutenção em Portão' | 'Ronda' | 'Ponto Divergente';
  descricao: string;
  registradoPor: string;
  dataHora: string;
  urgencia: 'alta' | 'media' | 'baixa';
  resolvida: boolean;
}

export interface HoleriteRegistro {
  id: string;
  colaboradorId: string;
  colaboradorNome: string;
  matricula: string;
  funcao: string;
  postoNome: string;
  mesReferencia: string; // 'Outubro/2026'
  salarioBase: number;
  adicionalPericulosidade: number; // 30%
  adicionalNoturno: number;
  horasExtras50: number;
  valorHorasExtras: number;
  plantoesFT?: number; // Folga Trabalhada (contabilizada em plantões)
  valorFT?: number;
  descontoINSS: number;
  descontoFGTS: number; // 8% recolhido
  descontoVT: number;
  descontoVR: number;
  bonusAssiduidade?: number;
  bonusAtivo?: boolean;
  motivoPerdaBonus?: string;
  liquidoReceber: number;
  statusEnvio: 'Assinado' | 'Aguardando Assinatura' | 'Pendente';
  dataEmissao: string;
}

export interface PontoRegistro {
  id: string;
  colaboradorId: string;
  colaboradorNome: string;
  data: string;
  entrada1: string;
  saida1: string;
  entrada2: string;
  saida2: string;
  totalHoras: string;
  statusPonto: 'Regular' | 'Atraso' | 'Hora Extra' | 'Incompleto' | 'Falta';
  localizacaoGPS: string;
}

export interface AtestadoMedico {
  id: string;
  colaboradorId: string;
  colaboradorNome: string;
  matricula: string;
  postoNome: string;
  medico: string;
  crm: string;
  cid: string;
  dataInicio: string;
  diasAfastamento: number;
  status: 'Pendente' | 'Aprovado' | 'Recusado';
  substitutoAlocadoId?: string;
  anexoUrl?: string;
}

export interface EmpresaInfo {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  inscricaoEstadual?: string;
  inscricaoMunicipal?: string;
  telefone: string;
  whatsapp: string;
  email: string;
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  responsavelOperacional: string;
  cargoResponsavel: string;
  chavePix?: string;
  logoUrl?: string;
  apresentacao?: string;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConnected: boolean;
  lastSyncedAt?: string;
}

export interface UsuarioAuth {
  id: string;
  nome: string;
  email: string;
  role: 'admin' | 'supervisor' | 'funcionario';
  cargo?: string;
  colaboradorId?: string;
  avatarUrl?: string;
  postoNome?: string;
  senha?: string;
}

export type CollaboratorTabType =
  | 'meu_turno'
  | 'minha_escala'
  | 'meus_registros'
  | 'documentos'
  | 'meu_perfil';

export type TipoBatidaPonto =
  | 'entrada'
  | 'saida_intervalo'
  | 'retorno_intervalo'
  | 'saida';

export type StatusGeofence =
  | 'dentro_do_raio'
  | 'fora_do_raio'
  | 'gps_indisponivel'
  | 'pendente';

export interface PontoEvento {
  id: string;
  colaboradorId: string;
  colaboradorNome: string;
  authUserId?: string;
  condominioId?: string;
  condominioNome: string;
  postoNome: string;
  tipoEvento: TipoBatidaPonto;
  labelEvento: string;
  serverTimestamp: string;
  latitude?: number;
  longitude?: number;
  accuracyM?: number;
  geofenceStatus: StatusGeofence;
  distanceM?: number;
  credentialId?: string;
  fotoBiometriaUrl?: string;
  metodoAutenticacao: 'biometria_facial' | 'biometria_passkey' | 'autenticador_dispositivo' | 'excecao_autorizada';
  verificationStatus: 'confirmado' | 'pendente' | 'rejeitado';
  idempotencyKey: string;
  comprovanteNumero: string;
  motivoExcecao?: string;
  isCobertura?: boolean;
  postoOriginalId?: string;
  postoOriginalNome?: string;
  postoDetectadoNome?: string;
  condominioIcone?: string;
  condominioCor?: string;
  criadoEm: string;
}

export interface EmployeePasskey {
  id: string;
  authUserId: string;
  colaboradorId: string;
  credentialId: string;
  publicKey?: string;
  signCount: number;
  deviceLabel: string;
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
}

export interface ColaboradorDocumento {
  id: string;
  colaboradorId: string;
  titulo: string;
  tipo: 'RG' | 'CPF' | 'Comprovante Residência' | 'Carteira de Trabalho' | 'Declaração' | 'Contrato' | 'Outro';
  status: 'valido' | 'pendente' | 'solicitado' | 'recusado' | 'expirado';
  dataEmissao?: string;
  dataValidade?: string;
  arquivoUrl?: string;
  tamanhoKb?: number;
}

export interface SolicitacaoCorrecaoPonto {
  id: string;
  colaboradorId: string;
  colaboradorNome: string;
  dataPonto: string;
  tipoCorrecao: 'esquecimento' | 'divergencia_horario' | 'problema_dispositivo' | 'servico_externo';
  justificativa: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  criadoEm: string;
  respostaRH?: string;
}

export interface OcorrenciaColaborador {
  id: string;
  protocolo: string;
  colaboradorId: string;
  colaboradorNome: string;
  condominioId: string;
  condominioNome: string;
  postoNome: string;
  categoria:
    | 'Problema no Posto'
    | 'Atraso / Troca'
    | 'Equipamento'
    | 'Segurança'
    | 'Manutenção'
    | 'Divergência de Ponto'
    | 'Outro';
  descricao: string;
  fotoUrl?: string;
  dataHora: string;
  status: 'recebida' | 'em_analise' | 'aguardando_informacao' | 'concluida';
}

export interface NotificacaoColaborador {
  id: string;
  colaboradorId: string;
  titulo: string;
  mensagem: string;
  tipo: 'escala' | 'holerite' | 'documento' | 'ponto' | 'geral';
  dataHora: string;
  lida: boolean;
  linkDestino?: CollaboratorTabType;
}

export type StatusSolicitacaoBiometria = 'pendente' | 'aprovada' | 'rejeitada' | 'utilizada' | 'expirada';

export interface SolicitacaoBiometriaFacial {
  id: string;
  colaboradorId: string;
  colaboradorNome: string;
  colaboradorMatricula?: string;
  colaboradorFuncao?: string;
  condominioId?: string;
  condominioNome?: string;
  postoNome?: string;
  fotoPerfil?: string;
  tipoSolicitacao: 'primeiro_cadastro' | 'atualizacao_recadastro';
  motivo: string;
  status: StatusSolicitacaoBiometria;
  criadoEm: string;

  // Autorização do Supervisor
  supervisorId?: string;
  supervisorNome?: string;
  autorizadoEm?: string;
  validadeAutorizacao?: string; // ISO string
  expiraEm?: string; // Alias para compatibilidade
  tokenAutorizacao?: string;

  // Rejeição
  justificativaRejeicao?: string;
  rejeitadoEm?: string;

  // Conclusão
  utilizadoEm?: string;
  versaoModeloBiometrico?: string;
}

export interface HistoricoBiometriaFacial {
  id: string;
  colaboradorId: string;
  solicitacaoId?: string;
  supervisorId?: string;
  tipoEvento: 'solicitado' | 'aprovado' | 'rejeitado' | 'cadastrado' | 'revogado' | 'expirado';
  detalhes: string;
  versaoModelo: string;
  timestamp: string;
}
