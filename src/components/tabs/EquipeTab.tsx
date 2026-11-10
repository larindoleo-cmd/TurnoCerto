import React, { useState } from 'react';
import {
  Users,
  Search,
  Phone,
  MessageSquare,
  ShieldAlert,
  CheckCircle2,
  Filter,
  UserCheck,
  Calendar,
  AlertTriangle,
  FileText,
  UserPlus,
  RefreshCw,
  Pencil,
  Scan,
  KeyRound,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Colaborador, StatusColaborador } from '../../types';

export const EquipeTab: React.FC = () => {
  const {
    colaboradores,
    condominios,
    solicitacoesBiometria,
    aprovarSolicitacaoBiometria,
    rejeitarSolicitacaoBiometria,
    filterEquipeStatus,
    setFilterEquipeStatus,
    filterEquipeFuncao,
    setFilterEquipeFuncao,
    selectedCondominioId,
    setSelectedCondominioId,
    openSubstituicaoModal,
    openAlocarModal,
    setCadastroModalOpen,
    openEditarFuncionarioModal,
    openRedefinirSenhaModal,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');

  const biometriasPendentes = solicitacoesBiometria.filter((s) => s.status === 'pendente');

  // Status Filter Chips (Requested in Section 3)
  const statusChips = [
    { id: 'todos', label: 'Todos os Status', count: colaboradores.length },
    {
      id: 'no_posto',
      label: 'No Posto (Trabalhando)',
      count: colaboradores.filter((c) => c.status === 'no_posto').length,
    },
    {
      id: 'folga',
      label: 'De Folga',
      count: colaboradores.filter((c) => c.status === 'folga').length,
    },
    {
      id: 'falta',
      label: 'Em Falta / Vazio',
      count: colaboradores.filter((c) => c.status === 'falta').length,
    },
    {
      id: 'afastado',
      label: 'Afastados / Atestado',
      count: colaboradores.filter((c) => c.status === 'afastado').length,
    },
  ];

  // Distinct roles
  const roles = [
    'todas',
    'Porteiro Líder',
    'Porteiro',
    'Controlador de Acesso',
    'Vigilante Patrimonial',
    'Auxiliar de Limpeza',
    'Zelador',
    'Volante de Cobertura',
  ];

  // Filtering logic
  const filteredList = colaboradores.filter((c) => {
    // 1. Status Filter
    if (filterEquipeStatus !== 'todos' && c.status !== filterEquipeStatus) {
      return false;
    }

    // 2. Condominio Filter
    if (selectedCondominioId !== 'todos') {
      if (c.condominioId !== selectedCondominioId) return false;
    }

    // 3. Role Filter
    if (filterEquipeFuncao !== 'todas' && c.funcao !== filterEquipeFuncao) {
      return false;
    }

    // 4. Search Filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const match =
        c.nome.toLowerCase().includes(q) ||
        c.matricula.toLowerCase().includes(q) ||
        c.funcao.toLowerCase().includes(q) ||
        c.postoNome.toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });

  return (
    <div className="space-y-4 pb-20 animate-in fade-in duration-200">
      {/* Top Header & Quick Add */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Gestão da Equipe Operacional
          </h2>
          <p className="text-xs text-slate-400">
            {filteredList.length} colaborador(es) localizado(s)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => openAlocarModal()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl transition-all active:scale-95"
          >
            <UserPlus className="w-3.5 h-3.5 text-blue-400" />
            <span>Alocar</span>
          </button>

          <button
            onClick={() => setCadastroModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 rounded-xl shadow-lg shadow-blue-600/30 active:scale-95 transition-all"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ Novo Funcionário</span>
          </button>
        </div>
      </div>

      {/* 2.5 APROVAÇÕES PENDENTES DE BIOMETRIA FACIAL */}
      {biometriasPendentes.length > 0 && (
        <div className="rounded-2xl p-4 bg-gradient-to-br from-[#0B173E] via-[#09122D] to-[#070D22] border-2 border-cyan-500/50 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
              <Scan className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span>Solicitações de Biometria Facial Aguardando Liberação ({biometriasPendentes.length})</span>
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
              Ação Requerida
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {biometriasPendentes.map((sol) => (
              <div
                key={`tab-sol-${sol.id}`}
                className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <img
                      src={
                        sol.fotoPerfil ||
                        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80'
                      }
                      alt={sol.colaboradorNome}
                      className="w-10 h-10 rounded-xl object-cover border border-cyan-400/40 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <strong className="text-white text-xs truncate">{sol.colaboradorNome}</strong>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40 font-bold">
                          {sol.tipoSolicitacao === 'primeiro_cadastro' ? '1º Cadastro' : 'Recadastro'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 truncate">
                        {sol.colaboradorFuncao || 'Colaborador'} · {sol.colaboradorMatricula || 'N/A'}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        Posto: {sol.condominioNome || sol.postoNome || 'Portaria Principal'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
                  <span className="text-slate-400 text-[10px] uppercase font-semibold block">Justificativa:</span>
                  <p className="italic text-slate-200 mt-0.5">&quot;{sol.motivo}&quot;</p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/80">
                  <button
                    onClick={() => {
                      const just = prompt('Informe o motivo da rejeição:');
                      if (just?.trim()) rejeitarSolicitacaoBiometria(sol.id, just.trim());
                    }}
                    className="px-2.5 py-1 text-xs text-slate-400 hover:text-red-300 bg-slate-900 hover:bg-red-950/40 border border-slate-800 rounded-lg cursor-pointer"
                  >
                    Rejeitar
                  </button>
                  <button
                    onClick={() => aprovarSolicitacaoBiometria(sol.id)}
                    className="px-3 py-1 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 rounded-lg shadow-md active:scale-95 cursor-pointer flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Aprovar (Token 48h)</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Barra Superior de Filtros por Pílulas Deslizantes (Chips) */}
      <div className="overflow-x-auto no-scrollbar -mx-4 px-4 py-1">
        <div className="flex items-center gap-2 min-w-max">
          {statusChips.map((chip) => {
            const isActive = filterEquipeStatus === chip.id;
            return (
              <button
                key={chip.id}
                onClick={() => setFilterEquipeStatus(chip.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all active:scale-95 whitespace-nowrap min-h-[38px] ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold'
                    : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800'
                }`}
              >
                <span>{chip.label}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {chip.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Secondary Filters: Condomínio Selector & Função */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* Condomínio filter */}
        <div className="relative">
          <select
            value={selectedCondominioId}
            onChange={(e) => setSelectedCondominioId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-white text-xs focus:outline-none focus:border-blue-500"
          >
            <option value="todos">Todos os Condomínios / Postos</option>
            {condominios.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} ({c.vagasContratadas} vagas)
              </option>
            ))}
          </select>
        </div>

        {/* Função filter */}
        <div className="relative">
          <select
            value={filterEquipeFuncao}
            onChange={(e) => setFilterEquipeFuncao(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-white text-xs focus:outline-none focus:border-blue-500"
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {r === 'todas' ? 'Todas as Funções Operacionais' : r}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar colaborador por nome, matrícula ou posto..."
          className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700/60 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      {/* Collaborator Cards Feed */}
      <div className="space-y-3">
        {filteredList.length === 0 ? (
          <div className="p-8 text-center glass-panel rounded-2xl text-slate-400 space-y-2">
            <Users className="w-8 h-8 mx-auto text-slate-500" />
            <p className="text-sm font-semibold text-slate-200">Nenhum colaborador encontrado</p>
            <p className="text-xs">Tente ajustar os filtros de status, condomínio ou busca.</p>
          </div>
        ) : (
          filteredList.map((colab) => {
            const isNoPosto = colab.status === 'no_posto';
            const isFolga = colab.status === 'folga';
            const isFalta = colab.status === 'falta';
            const isAfastado = colab.status === 'afastado';
            const targetPosto = condominios.find((c) => c.id === colab.condominioId);

            return (
              <div
                key={colab.id}
                className="glass-panel rounded-2xl p-4 flex flex-col justify-between gap-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={colab.foto}
                      alt={colab.nome}
                      className="w-12 h-12 rounded-xl object-cover border border-slate-700 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white truncate">{colab.nome}</h3>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0">
                          {colab.matricula}
                        </span>
                      </div>
                      <p className="text-xs text-blue-400 font-medium truncate">{colab.funcao}</p>
                      <p className="text-[11px] text-slate-400 truncate">
                        Posto: <strong className="text-slate-300">{colab.postoNome}</strong>
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 ${
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
                </div>

                {colab.motivoStatus && (
                  <p className="text-xs text-amber-300 bg-amber-950/20 border border-amber-500/20 rounded-lg p-2">
                    {colab.motivoStatus}
                  </p>
                )}

                {/* Details Bar */}
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-slate-800/80">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Jornada</span>
                    <span className="text-slate-200 font-medium">{colab.jornada}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Último Registro</span>
                    <span className="text-slate-200 font-medium truncate block">
                      {colab.ultimoPonto || 'Aguardando batida'}
                    </span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <a
                      href={`tel:${colab.telefone.replace(/\D/g, '')}`}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs transition-colors"
                      title="Ligar para o colaborador"
                    >
                      <Phone className="w-3.5 h-3.5 text-blue-400" />
                      <span>Ligar</span>
                    </a>
                    <a
                      href={`https://wa.me/55${colab.telefone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs transition-colors"
                      title="Chamar no WhatsApp"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                      <span>WhatsApp</span>
                    </a>
                  </div>

                  <div className="flex items-center gap-1.5 ml-auto">
                    <button
                      onClick={() => openRedefinirSenhaModal(colab)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-semibold active:scale-95 transition-all cursor-pointer"
                      title="Redefinir senha de acesso deste colaborador"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                      <span>Senha</span>
                    </button>

                    <button
                      onClick={() => openEditarFuncionarioModal(colab)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold active:scale-95 transition-all"
                      title="Editar cadastro completo do colaborador"
                    >
                      <Pencil className="w-3.5 h-3.5 text-blue-400" />
                      <span>Editar</span>
                    </button>

                    {isFalta && (
                      <button
                        onClick={() => openSubstituicaoModal(targetPosto, colab)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-semibold active:scale-95 transition-all"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Substituir</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
