import React, { useState } from 'react';
import {
  Building2,
  Shield,
  FileCheck2,
  Users,
  Clock,
  Phone,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  RefreshCw,
  FileText,
  DollarSign,
  TrendingUp,
  Pencil,
  MapPin,
  Mail,
  CreditCard,
  Key,
  LogOut,
  Lock,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const MatrizTab: React.FC = () => {
  const {
    condominios,
    colaboradores,
    ocorrencias,
    openSubstituicaoModal,
    openOcorrenciaModal,
    empresaInfo,
    setEmpresaModalOpen,
    currentUser,
    logout,
    setTrocarSenhaModalOpen,
  } = useApp();

  // Banco de Reserva (Volantes de Cobertura)
  const volantes = colaboradores.filter(
    (c) => c.funcao === 'Volante de Cobertura' || c.condominioId === null
  );

  const totalVagas = condominios.reduce((acc, c) => acc + c.vagasContratadas, 0);
  const mediaCobertura =
    condominios.length > 0
      ? (condominios.reduce((acc, c) => acc + c.coberturaPercentual, 0) / condominios.length).toFixed(1)
      : '100.0';
  const faturamentoEstimadoNum = totalVagas * 4200; // Ticket médio contratual por vaga/posto
  const faturamentoEstimadoStr =
    faturamentoEstimadoNum > 0
      ? `R$ ${(faturamentoEstimadoNum / 1000).toFixed(1)}k`
      : 'R$ 0,00';

  return (
    <div className="space-y-4 pb-20 animate-in fade-in duration-200">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-400" />
          Matriz Administrativa & Governança
        </h2>
        <p className="text-xs text-slate-400">
          {empresaInfo.razaoSocial} · CNPJ: {empresaInfo.cnpj}
        </p>
      </div>

      {/* Dados Cadastrais da Empresa Terceirizada (Matriz) */}
      <section className="glass-panel rounded-2xl p-4 space-y-3 border border-blue-500/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-600/30 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white truncate">{empresaInfo.razaoSocial}</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                  Matriz Ativa
                </span>
              </div>
              <p className="text-xs text-blue-400 font-medium truncate">{empresaInfo.nomeFantasia}</p>
              <p className="text-[11px] text-slate-400 font-mono truncate">
                CNPJ: {empresaInfo.cnpj} {empresaInfo.inscricaoEstadual ? `· IE: ${empresaInfo.inscricaoEstadual}` : ''}
              </p>
            </div>
          </div>

          <button
            onClick={() => setEmpresaModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 hover:text-white text-xs font-bold transition-all active:scale-95 shrink-0 self-start sm:self-auto"
          >
            <Pencil className="w-3.5 h-3.5 text-blue-400" />
            <span>Editar Dados da Empresa</span>
          </button>
        </div>

        {/* Company Specs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-800/80 text-xs">
          <div className="space-y-1">
            <span className="text-slate-400 block text-[10px] uppercase font-semibold flex items-center gap-1">
              <MapPin className="w-3 h-3 text-blue-400" />
              Sede Administrativa
            </span>
            <p className="text-slate-200 font-medium">{empresaInfo.endereco}</p>
            <p className="text-slate-400 text-[11px]">
              {empresaInfo.bairro} · {empresaInfo.cidade} - {empresaInfo.estado} · CEP: {empresaInfo.cep}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-slate-400 block text-[10px] uppercase font-semibold flex items-center gap-1">
              <Phone className="w-3 h-3 text-emerald-400" />
              Canais & Atendimento 24h
            </span>
            <p className="text-slate-200 font-medium">Central: {empresaInfo.telefone}</p>
            <p className="text-emerald-400 text-[11px]">WhatsApp: {empresaInfo.whatsapp}</p>
            <p className="text-slate-400 text-[11px]">E-mail: {empresaInfo.email}</p>
          </div>

          <div className="space-y-1">
            <span className="text-slate-400 block text-[10px] uppercase font-semibold flex items-center gap-1">
              <Shield className="w-3 h-3 text-purple-400" />
              Diretoria & Dados Bancários
            </span>
            <p className="text-slate-200 font-medium">{empresaInfo.responsavelOperacional}</p>
            <p className="text-slate-400 text-[11px]">{empresaInfo.cargoResponsavel}</p>
            {empresaInfo.chavePix && (
              <p className="text-blue-300 font-mono text-[11px]">Pix: {empresaInfo.chavePix}</p>
            )}
          </div>
        </div>

        {empresaInfo.apresentacao && (
          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-300">
            <span className="font-semibold text-slate-400 block text-[10px] uppercase mb-0.5">
              Escopo Institucional & Governança:
            </span>
            {empresaInfo.apresentacao}
          </div>
        )}
      </section>

      {/* Corporate KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="glass-panel rounded-2xl p-3.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
            SLA de Cobertura
          </span>
          <span className="text-xl font-bold font-mono text-emerald-400 block mt-1 tabular-nums">
            {mediaCobertura}%
          </span>
          <span className="text-[10px] text-slate-400">Meta contratual: 98%</span>
        </div>

        <div className="glass-panel rounded-2xl p-3.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
            Vagas Gerenciadas
          </span>
          <span className="text-xl font-bold font-mono text-white block mt-1 tabular-nums">
            {totalVagas} postos
          </span>
          <span className="text-[10px] text-slate-400">{condominios.length} condomínios</span>
        </div>

        <div className="glass-panel rounded-2xl p-3.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
            Banco de Volantes
          </span>
          <span className="text-xl font-bold font-mono text-blue-400 block mt-1 tabular-nums">
            {volantes.length} prontos
          </span>
          <span className="text-[10px] text-slate-400">Reserva técnica</span>
        </div>

        <div className="glass-panel rounded-2xl p-3.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
            Faturamento Estimado
          </span>
          <span className="text-xl font-bold font-mono text-purple-400 block mt-1 tabular-nums">
            {faturamentoEstimadoStr}
          </span>
          <span className="text-[10px] text-slate-400">Competência mensal</span>
        </div>
      </div>

      {/* Banco de Reserva Operacional (Volantes Prontos para Despacho) */}
      <section className="glass-panel rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Banco de Reserva Técnica (Volantes)
              </h3>
              <p className="text-[11px] text-slate-400">
                Colaboradores prontos para despacho em caso de falta emergencial
              </p>
            </div>
          </div>

          <button
            onClick={() => openSubstituicaoModal()}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-semibold active:scale-95 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Despachar</span>
          </button>
        </div>

        <div className="space-y-2">
          {volantes.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-center text-slate-400 text-xs">
              Nenhum volante de cobertura cadastrado no banco de reserva técnica.
            </div>
          ) : (
            volantes.map((vol) => (
              <div
                key={vol.id}
                className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={vol.foto}
                    alt={vol.nome}
                    className="w-10 h-10 rounded-full object-cover border border-blue-500/40 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-white truncate">{vol.nome}</p>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300">
                        PRONTO
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      {vol.funcao} · Matrícula: {vol.matricula}
                    </p>
                    <p className="text-[10px] text-emerald-400 font-medium">
                      {vol.motivoStatus || 'Disponível na Base'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={`tel:${vol.telefone.replace(/\D/g, '')}`}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
                    title="Ligar para volante"
                  >
                    <Phone className="w-3.5 h-3.5 text-blue-400" />
                  </a>
                  <button
                    onClick={() => openSubstituicaoModal(undefined, vol)}
                    className="px-2.5 py-1 text-xs font-semibold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-lg active:scale-95 transition-all"
                  >
                    Acionar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Livro de Ocorrências Operacionais */}
      <section className="glass-panel rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-600/20 text-amber-400 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Livro de Ocorrências da Supervisão ({ocorrencias.length})
              </h3>
              <p className="text-[11px] text-slate-400">Registros em tempo real dos plantões</p>
            </div>
          </div>

          <button
            onClick={() => openOcorrenciaModal()}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300"
          >
            + Nova Ocorrência
          </button>
        </div>

        <div className="space-y-2">
          {ocorrencias.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-center text-slate-400 text-xs">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1.5" />
              Nenhuma ocorrência registrada no plantão atual.
            </div>
          ) : (
            ocorrencias.map((ocorr) => (
              <div
                key={ocorr.id}
                className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${
                        ocorr.urgencia === 'alta'
                          ? 'bg-red-500/20 text-red-400'
                          : ocorr.urgencia === 'media'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}
                    >
                      {ocorr.tipo}
                    </span>
                    <strong className="text-xs text-white">{ocorr.postoNome}</strong>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">{ocorr.dataHora}</span>
                </div>
                <p className="text-xs text-slate-300">{ocorr.descricao}</p>
                <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
                  Registrado por: {ocorr.registradoPor}
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Certidões e Conformidade Legal */}
      <section className="glass-panel rounded-2xl p-4 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <FileCheck2 className="w-4 h-4 text-emerald-400" />
          Conformidade e Documentação Legal (Compliance)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-200">CND Trabalhista & FGTS</p>
              <p className="text-[10px] text-slate-400">Regularidade fiscal vigente até 12/2026</p>
            </div>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>

          <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-200">PGR / PCMSO Ocupacional</p>
              <p className="text-[10px] text-slate-400">Exames ASO de toda a equipe em dia</p>
            </div>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
        </div>
      </section>

      {/* Segurança de Acesso e Gestão de Sessão */}
      <section className="glass-panel rounded-2xl p-4 space-y-3 border border-slate-700/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>Segurança e Sessão do Usuário</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {currentUser?.role === 'admin' ? 'Administrador' : currentUser?.role === 'supervisor' ? 'Supervisor' : 'Funcionário'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Logado como: <strong className="text-slate-200">{currentUser?.nome || 'Operador'}</strong> ({currentUser?.email || 'admin@turnocerto.com.br'})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTrocarSenhaModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 hover:text-white text-xs font-bold transition-all active:scale-95 cursor-pointer"
            >
              <Key className="w-3.5 h-3.5 text-blue-400" />
              <span>Trocar Senha</span>
            </button>

            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/50 border border-red-500/30 text-red-400 hover:text-red-200 text-xs font-bold transition-all active:scale-95 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Deslogar</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
