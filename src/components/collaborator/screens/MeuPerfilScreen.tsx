import React, { useState } from 'react';
import {
  User,
  Mail,
  Phone,
  Home,
  Briefcase,
  Key,
  Shield,
  LogOut,
  CheckCircle2,
  Lock,
  Info,
  Scan,
  Camera,
  Clock,
  AlertTriangle,
  Send,
  X,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Colaborador, CondominioPosto } from '../../../types';
import { useApp } from '../../../context/AppContext';
import { hasBiometriaCadastrada } from '../../../services/facialRecognitionService';

interface MeuPerfilScreenProps {
  colaborador: Colaborador;
  posto: CondominioPosto;
  onOpenAtivarBiometria?: () => void;
  onOpenFacialEnrollment?: () => void;
  onOpenTrocarSenha: () => void;
}

export const MeuPerfilScreen: React.FC<MeuPerfilScreenProps> = ({
  colaborador,
  posto,
  onOpenFacialEnrollment,
  onOpenTrocarSenha,
}) => {
  const {
    logout,
    showToast,
    solicitarCadastroFacial,
    obterAutorizacaoAtiva,
    obterUltimaSolicitacao,
  } = useApp();

  const [telefone, setTelefone] = useState(colaborador.telefone || '(11) 98765-4321');
  const [email, setEmail] = useState(colaborador.email || 'carlos.santos@turnocerto.com.br');
  const [endereco, setEndereco] = useState(colaborador.endereco || 'Rua das Flores, 142 - Apto 32, São Paulo - SP');
  const [isSaving, setIsSaving] = useState(false);

  // Modal para solicitar autorização ao supervisor
  const [modalSolicitacaoOpen, setModalSolicitacaoOpen] = useState(false);
  const [motivoSolicitacao, setMotivoSolicitacao] = useState('');
  const [tipoSolicitacao, setTipoSolicitacao] = useState<'primeiro_cadastro' | 'atualizacao_recadastro'>('primeiro_cadastro');
  const [isSendingSolicitacao, setIsSendingSolicitacao] = useState(false);

  // Checagens de estado biométrico
  const biometriaExiste = hasBiometriaCadastrada(colaborador.id);
  const authAtiva = obterAutorizacaoAtiva(colaborador.id);
  const ultimaSol = obterUltimaSolicitacao(colaborador.id);
  const isAguardandoSupervisor = ultimaSol?.status === 'pendente';

  const handleSalvarContatos = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      showToast('Dados de contato atualizados com sucesso!');
    }, 600);
  };

  const handleAbrirSolicitacao = (tipo: 'primeiro_cadastro' | 'atualizacao_recadastro') => {
    setTipoSolicitacao(tipo);
    setMotivoSolicitacao(
      tipo === 'primeiro_cadastro'
        ? 'Primeiro cadastro de biometria facial para liberação do ponto digital.'
        : 'Atualização biométrica facial por alteração de feição / nova foto.'
    );
    setModalSolicitacaoOpen(true);
  };

  const handleEnviarSolicitacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivoSolicitacao.trim()) {
      showToast('Informe o motivo da solicitação.');
      return;
    }

    setIsSendingSolicitacao(true);
    try {
      const res = await solicitarCadastroFacial(colaborador, motivoSolicitacao.trim(), tipoSolicitacao);
      if (res.success) {
        setModalSolicitacaoOpen(false);
      }
    } finally {
      setIsSendingSolicitacao(false);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* 1. Header do Perfil */}
      <div className="rounded-3xl bg-gradient-to-b from-[#0A1333] via-[#09102A] to-[#070B1F] border border-blue-500/30 p-5 shadow-2xl text-center space-y-3 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-36 h-36 bg-blue-500/10 rounded-full blur-3xl -z-10" />

        <div className="relative inline-block mx-auto">
          {colaborador.foto ? (
            <img
              src={colaborador.foto}
              alt={colaborador.nome}
              className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl object-cover border-2 border-blue-400/50 shadow-xl mx-auto"
            />
          ) : (
            <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl bg-gradient-to-br from-blue-600/35 to-indigo-700/45 border-2 border-blue-400/50 shadow-xl mx-auto flex items-center justify-center font-black text-2xl text-blue-100">
              {colaborador.nome
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((p) => p[0]?.toUpperCase() || '')
                .join('')}
            </div>
          )}
          <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-[#09102A] flex items-center justify-center text-white shadow-sm">
            <CheckCircle2 className="w-4 h-4" />
          </span>
        </div>

        <div>
          <h2 className="text-lg font-black text-white tracking-tight">
            {colaborador.nome}
          </h2>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="text-xs text-blue-300 font-mono font-bold">
              Matrícula: {colaborador.matricula}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
              Em serviço
            </span>
          </div>
        </div>
      </div>

      {/* 2. Informações Profissionais e Contratuais */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Briefcase className="w-4 h-4 text-blue-400" />
            <span>Dados Funcionais e Contratuais</span>
          </span>
          <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
            <Lock className="w-3 h-3 text-slate-500" />
            <span>Bloqueado para edição</span>
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs text-slate-300">
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Cargo / Função</span>
            <strong className="text-white text-xs mt-0.5 block">{colaborador.funcao}</strong>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Data de Admissão</span>
            <strong className="text-white text-xs mt-0.5 block">{colaborador.dataAdmissao || '15/02/2023'}</strong>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Condomínio Vinculado</span>
            <strong className="text-blue-300 text-xs mt-0.5 block truncate">{posto.nome}</strong>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Posto de Trabalho</span>
            <strong className="text-white text-xs mt-0.5 block truncate">{colaborador.postoNome || 'Portaria Principal'}</strong>
          </div>
          <div className="col-span-2">
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Jornada Homologada</span>
            <strong className="text-slate-200 text-xs mt-0.5 block">{colaborador.jornada || '12x36 · 07:00 às 19:00'}</strong>
          </div>
        </div>

        <p className="text-[10px] text-slate-500 flex items-center gap-1 pt-1 border-t border-slate-800/80">
          <Info className="w-3 h-3 text-blue-400 shrink-0" />
          <span>Alterações de posto, cargo ou jornada são controladas pelo supervisor via painel operacional.</span>
        </p>
      </div>

      {/* 3. MÓDULO EXCLUSIVO DE BIOMETRIA FACIAL (VETOR 128D) */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0B1536] via-[#09112C] to-[#070D22] border border-blue-500/35 p-4 space-y-3.5 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
          <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Scan className="w-4 h-4 text-blue-400" />
            <span>Biometria Facial (Vetor 128D)</span>
          </span>

          {/* Badge de Estado Biométrico */}
          {authAtiva ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1 animate-pulse">
              <CheckCircle2 className="w-3 h-3 text-cyan-400" />
              <span>AUTORIZADA PARA CADASTRO</span>
            </span>
          ) : isAguardandoSupervisor ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-400 animate-spin" />
              <span>AGUARDANDO SUPERVISOR</span>
            </span>
          ) : biometriaExiste ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>ATIVA E VALIDADA</span>
            </span>
          ) : (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
              NÃO CADASTRADA
            </span>
          )}
        </div>

        {/* Detalhes de Acordo com o Estado Atual */}
        {authAtiva ? (
          <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/30 space-y-2 text-xs">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block text-xs">Autorização Concedida pelo Supervisor</strong>
                <p className="text-slate-300 text-[11px] mt-0.5">
                  Sua câmera está liberada para captura biométrica com consenso de 5 amostras.
                </p>
                {(authAtiva.expiraEm || authAtiva.validadeAutorizacao) && (
                  <span className="text-[10px] text-cyan-300 font-mono block mt-1">
                    Válida até {new Date(authAtiva.expiraEm || authAtiva.validadeAutorizacao!).toLocaleString('pt-BR')}
                  </span>
                )}
              </div>
            </div>

            {onOpenFacialEnrollment && (
              <button
                onClick={onOpenFacialEnrollment}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/30 transition-all cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>CADASTRAR NOVA FACIAL AGORA</span>
              </button>
            )}
          </div>
        ) : isAguardandoSupervisor ? (
          <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 space-y-2 text-xs">
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-amber-200 block text-xs">Aguardando Autorização da Supervisão</strong>
                <p className="text-slate-300 text-[11px] mt-0.5">
                  Solicitação enviada em{' '}
                  <span className="font-mono text-amber-300">
                    {new Date(ultimaSol.criadoEm).toLocaleDateString('pt-BR')} às{' '}
                    {new Date(ultimaSol.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  . Assim que o supervisor aprovar, a câmera será liberada para captura facial.
                </p>
                <p className="text-[10px] text-slate-400 italic mt-1">&quot;{ultimaSol.motivo}&quot;</p>
              </div>
            </div>
          </div>
        ) : biometriaExiste ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-300 leading-relaxed">
              Sua biometria facial está homologada e vinculada à sua matrícula. O modelo de 128 dimensões com calibração anti-ruído valida suas marcações com alta confiabilidade.
            </p>

            <button
              onClick={() => handleAbrirSolicitacao('atualizacao_recadastro')}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
              <span>SOLICITAR NOVA BIOMETRIA (RECADASTRO)</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-300 leading-relaxed">
              Você ainda não possui biometria facial cadastrada no TurnoCerto. Para garantir a segurança dos registros, solicite a autorização ao supervisor do posto.
            </p>

            <button
              onClick={() => handleAbrirSolicitacao('primeiro_cadastro')}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-600/30 transition-all cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>SOLICITAR CADASTRO FACIAL</span>
            </button>
          </div>
        )}
      </div>

      {/* 4. Dados de Contato Pessoal (Editáveis) */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <User className="w-4 h-4 text-blue-400" />
            <span>Dados de Contato Pessoal</span>
          </span>
        </div>

        <form onSubmit={handleSalvarContatos} className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-400 font-medium mb-1">Telefone / WhatsApp</label>
            <div className="relative">
              <input
                type="text"
                required
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
              />
              <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">E-mail de Notificações</label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
              />
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">Endereço Residencial</label>
            <div className="relative">
              <input
                type="text"
                required
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-blue-500"
              />
              <Home className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/30 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? 'Salvando alterações...' : 'Salvar Dados de Contato'}
          </button>
        </form>
      </div>

      {/* 5. Segurança da Conta e Senha */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 space-y-2">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
          Segurança e Senha
        </h3>

        <button
          onClick={onOpenTrocarSenha}
          className="w-full p-3 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 text-left transition-colors flex items-center justify-between text-xs cursor-pointer group"
        >
          <div className="flex items-center gap-2.5">
            <Key className="w-4 h-4 text-blue-400" />
            <span className="text-slate-200 group-hover:text-white font-semibold">
              Alterar Minha Senha de Acesso
            </span>
          </div>
          <span className="text-[10px] text-slate-500">Alterar</span>
        </button>

        <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-500/20 text-xs text-slate-300 flex items-start gap-2.5">
          <Shield className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-[11px] space-y-0.5">
            <strong className="text-white block">Proteção de Dados & LGPD:</strong>
            <p className="text-slate-400">
              Seus vetores faciais são criptografados de forma unidirecional. O TurnoCerto não comercializa nem compartilha dados biométricos sensíveis com terceiros.
            </p>
          </div>
        </div>
      </div>

      {/* 6. Botão Sair da Conta */}
      <button
        onClick={() => logout()}
        className="w-full py-3.5 rounded-2xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 text-red-200 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer shadow-lg shadow-red-950/40"
      >
        <LogOut className="w-4 h-4 text-red-400" />
        <span>Sair do Aplicativo TurnoCerto</span>
      </button>

      {/* Modal de Envio de Solicitação de Biometria ao Supervisor */}
      {modalSolicitacaoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#09102A] text-slate-100 rounded-3xl p-5 border border-blue-500/35 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Scan className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-bold text-white">
                  {tipoSolicitacao === 'primeiro_cadastro'
                    ? 'Solicitar Primeiro Cadastro Facial'
                    : 'Solicitar Recadastro Facial'}
                </h3>
              </div>
              <button
                onClick={() => setModalSolicitacaoOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Informe ao supervisor o motivo pelo qual você precisa {tipoSolicitacao === 'primeiro_cadastro' ? 'cadastrar' : 'recadastrar'} sua biometria facial:
            </p>

            <form onSubmit={handleEnviarSolicitacao} className="space-y-3">
              <div>
                <textarea
                  rows={3}
                  required
                  value={motivoSolicitacao}
                  onChange={(e) => setMotivoSolicitacao(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-blue-500 resize-none"
                  placeholder="Descreva o motivo..."
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalSolicitacaoOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSendingSolicitacao}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingSolicitacao ? 'Enviando...' : 'Enviar Solicitação'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
