import React, { useState } from 'react';
import {
  Users,
  Umbrella,
  Building2,
  AlertTriangle,
  Search,
  SlidersHorizontal,
  ChevronRight,
  ArrowRight,
  Clock,
  CheckCircle2,
  Phone,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CondominioSelector } from '../CondominioSelector';

export const OperacaoTab: React.FC = () => {
  const {
    condominios,
    colaboradores,
    alertas,
    selectedCondominioId,
    openPosto360,
    openSubstituicaoModal,
    openEscalaModal,
    setNotificationModalOpen,
    setActiveTab,
    setFilterEquipeStatus,
  } = useApp();

  const [localSearch, setLocalSearch] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Filter based on selected condominium
  const filteredCondominios =
    selectedCondominioId === 'todos'
      ? condominios
      : condominios.filter((c) => c.id === selectedCondominioId);

  const filteredColaboradores =
    selectedCondominioId === 'todos'
      ? colaboradores
      : colaboradores.filter((c) => c.condominioId === selectedCondominioId);

  // Métricas 100% dinâmicas baseadas nos dados reais
  const metricFuncionarios = filteredColaboradores.filter((c) => c.status === 'no_posto').length;
  const metricFolgas = String(filteredColaboradores.filter((c) => c.status === 'folga').length).padStart(2, '0');
  const metricCondominios = filteredCondominios.length;
  const metricCobertura = filteredCondominios.length > 0
    ? Math.round(filteredCondominios.reduce((acc, c) => acc + (Number(c.coberturaPercentual) || 100), 0) / filteredCondominios.length)
    : 100;

  // Contagem de alertas e inconformidades reais
  const pendenciasCriticas = alertas.filter((a) => !a.resolvido).length;
  const postosDescobertosCount = condominios.filter((c) => c.status === 'critico').length;
  const faltasCount = colaboradores.filter((c) => c.status === 'falta').length;
  const hasAlertasCriticos = postosDescobertosCount > 0 || faltasCount > 0;

  // Search filter
  const searchResults = localSearch.trim()
    ? colaboradores.filter((c) => {
        const q = localSearch.toLowerCase();
        return (
          c.nome.toLowerCase().includes(q) ||
          c.funcao.toLowerCase().includes(q) ||
          c.postoNome.toLowerCase().includes(q) ||
          c.matricula.toLowerCase().includes(q)
        );
      })
    : [];

  // Donut chart stroke math
  const rDonut = 28;
  const cDonut = 2 * Math.PI * rDonut;
  const offsetDonut = cDonut - (metricCobertura / 100) * cDonut;

  // Format today's date for section 8
  const hoje = new Date();
  const diaNum = hoje.getDate();
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const mesNome = meses[hoje.getMonth()];

  return (
    <div className="space-y-4 pb-20 animate-in fade-in duration-200">
      {/* 2. CARD DE BOAS-VINDAS */}
      <section className="glass-panel rounded-3xl p-4 sm:p-5 flex items-center justify-between gap-4 border border-blue-500/20 shadow-lg shadow-black/40">
        <div className="flex items-center gap-3.5 min-w-0">
          {/* Avatar circular com indicador de status online verde */}
          <div className="relative shrink-0">
            <img
              src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80"
              alt="Supervisora"
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border-2 border-blue-500/40 shadow-md"
            />
            <span
              className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-400 ring-2 ring-[#0B132B] shadow-[0_0_8px_rgba(16,185,129,0.8)]"
              title="Online"
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400">Administração</span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-600/30 text-blue-300 border border-blue-500/40">
                Administrador
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white truncate mt-0.5">
              Bem-vinda, Supervisora!
            </h2>
            <p className="text-[11px] text-slate-400 truncate">
              Painel de Supervisão e Controle de Postos
            </p>
          </div>
        </div>

        <div className="hidden sm:flex flex-col items-end shrink-0">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">Status Geral</span>
          <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Operação Estável
          </span>
        </div>
      </section>

      {/* 2. SELETOR GLOBAL DE UNIDADE (DROPDOWN LARGO) */}
      <section>
        <CondominioSelector />
      </section>

      {/* 3. GRID DE INDICADORES PRINCIPAIS (4 CARDS DE MÉTRICAS) */}
      <section>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Card 1: Funcionários */}
          <div className="glass-panel glass-panel-hover rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 flex flex-col justify-between border border-slate-700/60 shadow-md">
            <div className="flex items-center justify-between text-slate-400">
              <div className="w-8 h-8 rounded-xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Users className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-0.5">
                ↑ 98%
              </span>
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-white tabular-nums block">
                {metricFuncionarios}
              </span>
              <p className="text-[11px] text-slate-300 font-medium mt-0.5 truncate">
                Funcionários no Posto
              </p>
            </div>
          </div>

          {/* Card 2: Folgas */}
          <div className="glass-panel glass-panel-hover rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 flex flex-col justify-between border border-slate-700/60 shadow-md">
            <div className="flex items-center justify-between text-slate-400">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Umbrella className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-0.5">
                ↑ 6%
              </span>
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-white tabular-nums block">
                {metricFolgas}
              </span>
              <p className="text-[11px] text-slate-300 font-medium mt-0.5 truncate">
                Funcionários de Folga
              </p>
            </div>
          </div>

          {/* Card 3: Condomínios Ativos */}
          <div className="glass-panel glass-panel-hover rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 flex flex-col justify-between border border-slate-700/60 shadow-md">
            <div className="flex items-center justify-between text-slate-400">
              <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Building2 className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-0.5">
                ↑ 100%
              </span>
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-white tabular-nums block">
                {metricCondominios}
              </span>
              <p className="text-[11px] text-slate-300 font-medium mt-0.5 truncate">
                Condomínios Ativos
              </p>
            </div>
          </div>

          {/* Card 4: Cobertura Operacional (Donut Chart) */}
          <div className="glass-panel glass-panel-hover rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 flex items-center justify-between gap-2 border border-slate-700/60 shadow-md">
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                Cobertura Operacional
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-bold font-mono text-white tabular-nums">
                  {metricCobertura}%
                </span>
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full mt-1.5">
                🟢 Excelente
              </span>
            </div>

            {/* Circular Donut SVG */}
            <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
                <circle
                  cx="32"
                  cy="32"
                  r={rDonut}
                  fill="transparent"
                  stroke="rgba(30, 41, 59, 0.9)"
                  strokeWidth="5.5"
                />
                <circle
                  cx="32"
                  cy="32"
                  r={rDonut}
                  fill="transparent"
                  stroke="#10B981"
                  strokeWidth="5.5"
                  strokeDasharray={cDonut}
                  strokeDashoffset={offsetDonut}
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <span className="absolute text-[11px] font-bold font-mono text-white">
                {metricCobertura}%
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. BANNER DE ALERTAS OPERACIONAIS CRÍTICOS (EXIBIDO APENAS SE HOUVER POSTO DESCOBERTO OU FALTA NO DIA) */}
      {hasAlertasCriticos && (
        <section className="animate-in slide-in-from-top-1 duration-200">
          <div className="rounded-3xl p-4 sm:p-5 bg-gradient-to-br from-[#200B13] via-[#1A0A12] to-[#12080E] border border-red-500/50 shadow-xl shadow-red-950/40 space-y-4">
            {/* Cabeçalho do Card */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-600/25 border border-red-500/40 flex items-center justify-center shrink-0 text-red-400">
                  <AlertTriangle className="w-5 h-5 text-red-400 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    Alertas Operacionais
                  </h3>
                  <p className="text-[11px] text-red-200/80">
                    Atenção para os itens abaixo:
                  </p>
                </div>
              </div>

              {/* Botão de Pendências */}
              <button
                onClick={() => setNotificationModalOpen(true)}
                className="px-3 py-1.5 rounded-full bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 hover:text-white text-xs font-bold transition-all active:scale-95 flex items-center gap-1 shrink-0"
              >
                <span>{pendenciasCriticas} pendências</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Divisor vertical separando as ocorrências críticas */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-red-900/40 divide-x divide-red-900/40">
              {/* Lado esquerdo: Posto Descoberto */}
              <div
                onClick={() => {
                  const targetPosto = condominios.find((c) => c.status === 'critico') || condominios[0];
                  if (targetPosto) openSubstituicaoModal(targetPosto);
                }}
                className="pr-2 cursor-pointer group"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-bold font-mono text-red-400 tabular-nums group-hover:scale-105 transition-transform">
                    {postosDescobertosCount}
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-white">
                    Posto Descoberto
                  </span>
                </div>
                <p className="text-[11px] text-red-300/80 mt-0.5 truncate">
                  {postosDescobertosCount > 0
                    ? (condominios.find((c) => c.status === 'critico')?.nome || 'Posto sem rendição')
                    : 'Nenhum posto descoberto'}
                </p>
                {postosDescobertosCount > 0 ? (
                  <span className="inline-block text-[10px] font-bold text-amber-400 group-hover:underline mt-1">
                    Substituir agora →
                  </span>
                ) : (
                  <span className="inline-block text-[10px] font-medium text-emerald-400 mt-1">
                    ✓ Postos cobertos
                  </span>
                )}
              </div>

              {/* Lado direito: Faltas no Dia */}
              <div
                onClick={() => {
                  const targetPosto = condominios.find((c) => c.status !== 'operacional') || condominios[0];
                  const targetColab = colaboradores.find((c) => c.status === 'falta');
                  if (targetPosto) openSubstituicaoModal(targetPosto, targetColab);
                }}
                className="pl-3 sm:pl-4 cursor-pointer group"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-bold font-mono text-amber-400 tabular-nums group-hover:scale-105 transition-transform">
                    {faltasCount}
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-white">
                    Faltas no Dia
                  </span>
                </div>
                <p className="text-[11px] text-red-300/80 mt-0.5 truncate">
                  {faltasCount > 0
                    ? (colaboradores.filter((c) => c.status === 'falta').map((c) => c.nome.split(' ')[0]).join(', ') || 'Colaboradores ausentes')
                    : 'Nenhuma falta registrada'}
                </p>
                {faltasCount > 0 ? (
                  <span className="inline-block text-[10px] font-bold text-amber-400 group-hover:underline mt-1">
                    Despachar volante →
                  </span>
                ) : (
                  <span className="inline-block text-[10px] font-medium text-emerald-400 mt-1">
                    ✓ Efetivo presente
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 5. SEÇÃO DE CONDOMÍNIOS (MINI-CARDS COM FOTOS DOS POSTOS) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span>🏢</span>
            <span>Condomínios</span>
          </h3>
          <button
            onClick={() => setActiveTab('postos')}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
          >
            <span>Ver todos</span>
            <span>-&gt;</span>
          </button>
        </div>

        {/* Lista Horizontal de Mini-Cards com Fotos Reais */}
        <div className="overflow-x-auto no-scrollbar -mx-4 px-4 py-1">
          <div className="flex items-center gap-3 min-w-max">
            {filteredCondominios.map((condo) => {
              const isOperacional = condo.status === 'operacional';
              const isCritico = condo.status === 'critico';

              return (
                <div
                  key={condo.id}
                  onClick={() => openPosto360(condo)}
                  className="relative w-44 sm:w-52 h-44 rounded-2xl sm:rounded-3xl overflow-hidden cursor-pointer group shadow-lg shadow-black/50 border border-slate-700/60 transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
                >
                  {/* Foto real do condomínio */}
                  <img
                    src={condo.foto || '/src/assets/images/condo_alvorada_1794108421387.jpg'}
                    alt={condo.nome}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />

                  {/* Gradiente escuro para legibilidade */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#060913] via-[#060913]/40 to-transparent" />

                  {/* Nome do condomínio por cima da foto */}
                  <div className="absolute top-2.5 left-2.5 right-2.5">
                    <span className="inline-block px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-md text-[10px] font-mono text-slate-300 border border-white/10">
                      {condo.vagasContratadas} vagas
                    </span>
                  </div>

                  {/* Conteúdo inferior com nome e status em badge */}
                  <div className="absolute bottom-3 left-3 right-3 space-y-1.5">
                    <h4 className="text-xs sm:text-sm font-bold text-white truncate drop-shadow-md">
                      {condo.nome}
                    </h4>

                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-md ${
                          isOperacional
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : isCritico
                            ? 'bg-red-500/30 text-red-300 border border-red-500/50'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        }`}
                      >
                        {isOperacional ? '🟢 Operacional' : isCritico ? '🔴 Posto Vazio' : '🟡 Atenção'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 6. SEÇÃO DE RESUMO DE EQUIPE (GRÁFICOS EM ROSCA / DONUT) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span>👥</span>
            <span>Equipe</span>
          </h3>
          <button
            onClick={() => setActiveTab('equipe')}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
          >
            <span>Ver escala</span>
            <span>-&gt;</span>
          </button>
        </div>

        {/* 4 mini gráficos em rosca coloridos lado a lado */}
        <div className="grid grid-cols-4 gap-2">
          {/* Donut 1: Ativos */}
          <div
            onClick={() => {
              setFilterEquipeStatus('no_posto');
              setActiveTab('equipe');
            }}
            className="glass-panel rounded-2xl p-2.5 sm:p-3 flex flex-col items-center text-center cursor-pointer hover:border-emerald-500/40 transition-all border border-slate-700/60 shadow-md"
          >
            <div className="relative w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="18" fill="transparent" stroke="#1E293B" strokeWidth="4" />
                <circle
                  cx="24"
                  cy="24"
                  r="18"
                  fill="transparent"
                  stroke="#10B981"
                  strokeWidth="4"
                  strokeDasharray="113"
                  strokeDashoffset={colaboradores.length > 0 ? 113 - (colaboradores.filter((c) => c.status === 'no_posto').length / colaboradores.length) * 113 : 113}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-xs sm:text-sm font-bold font-mono text-white">
                {colaboradores.filter((c) => c.status === 'no_posto').length}
              </span>
            </div>
            <span className="text-[11px] font-semibold text-emerald-400 mt-1.5">
              Ativos
            </span>
          </div>

          {/* Donut 2: Faltas */}
          <div
            onClick={() => {
              setFilterEquipeStatus('falta');
              setActiveTab('equipe');
            }}
            className="glass-panel rounded-2xl p-2.5 sm:p-3 flex flex-col items-center text-center cursor-pointer hover:border-red-500/40 transition-all border border-slate-700/60 shadow-md"
          >
            <div className="relative w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="18" fill="transparent" stroke="#1E293B" strokeWidth="4" />
                <circle
                  cx="24"
                  cy="24"
                  r="18"
                  fill="transparent"
                  stroke="#EF4444"
                  strokeWidth="4"
                  strokeDasharray="113"
                  strokeDashoffset={colaboradores.length > 0 ? 113 - (colaboradores.filter((c) => c.status === 'falta').length / colaboradores.length) * 113 : 113}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-xs sm:text-sm font-bold font-mono text-white">
                {colaboradores.filter((c) => c.status === 'falta').length}
              </span>
            </div>
            <span className="text-[11px] font-semibold text-red-400 mt-1.5">
              Faltas
            </span>
          </div>

          {/* Donut 3: Folga */}
          <div
            onClick={() => {
              setFilterEquipeStatus('folga');
              setActiveTab('equipe');
            }}
            className="glass-panel rounded-2xl p-2.5 sm:p-3 flex flex-col items-center text-center cursor-pointer hover:border-amber-500/40 transition-all border border-slate-700/60 shadow-md"
          >
            <div className="relative w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="18" fill="transparent" stroke="#1E293B" strokeWidth="4" />
                <circle
                  cx="24"
                  cy="24"
                  r="18"
                  fill="transparent"
                  stroke="#F59E0B"
                  strokeWidth="4"
                  strokeDasharray="113"
                  strokeDashoffset={colaboradores.length > 0 ? 113 - (colaboradores.filter((c) => c.status === 'folga').length / colaboradores.length) * 113 : 113}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-xs sm:text-sm font-bold font-mono text-white">
                {colaboradores.filter((c) => c.status === 'folga').length}
              </span>
            </div>
            <span className="text-[11px] font-semibold text-amber-400 mt-1.5">
              Folga
            </span>
          </div>

          {/* Donut 4: Reserva */}
          <div
            onClick={() => {
              setFilterEquipeStatus('todos');
              setActiveTab('equipe');
            }}
            className="glass-panel rounded-2xl p-2.5 sm:p-3 flex flex-col items-center text-center cursor-pointer hover:border-blue-500/40 transition-all border border-slate-700/60 shadow-md"
          >
            <div className="relative w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="18" fill="transparent" stroke="#1E293B" strokeWidth="4" />
                <circle
                  cx="24"
                  cy="24"
                  r="18"
                  fill="transparent"
                  stroke="#3B82F6"
                  strokeWidth="4"
                  strokeDasharray="113"
                  strokeDashoffset={colaboradores.length > 0 ? 113 - (colaboradores.filter((c) => !c.condominioId).length / colaboradores.length) * 113 : 113}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-xs sm:text-sm font-bold font-mono text-white">
                {colaboradores.filter((c) => !c.condominioId).length}
              </span>
            </div>
            <span className="text-[11px] font-semibold text-blue-400 mt-1.5">
              Reserva
            </span>
          </div>
        </div>
      </section>

      {/* 7. BARRA DE BUSCA GLOBAL E FILTROS RÁPIDOS */}
      <section className="space-y-2.5">
        <div className="flex items-center gap-2">
          {/* Input estilo barra com ícone de lupa */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="🔍 Buscar colaboradores ou postos..."
              className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[#0B132B]/90 border border-slate-700/70 text-white placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:border-blue-500 transition-colors shadow-md"
            />
          </div>

          {/* Botão de Filtros Avançados: Ícone estilizado em azul com borda nítida */}
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all active:scale-95 shrink-0 ${
              showAdvancedFilters
                ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/30'
                : 'bg-blue-600/15 border-blue-500/40 text-blue-400 hover:bg-blue-600/25'
            }`}
            title="Filtros Avançados"
            aria-label="Filtros Avançados"
          >
            <SlidersHorizontal className="w-5 h-5" />
          </button>
        </div>

        {/* Painel expandido de Filtros Avançados */}
        {showAdvancedFilters && (
          <div className="p-3.5 rounded-2xl glass-panel border border-blue-500/30 space-y-2 animate-in fade-in slide-in-from-top-1 text-xs">
            <span className="font-bold text-white text-xs block">Filtros Operacionais:</span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setFilterEquipeStatus('todos');
                  setActiveTab('equipe');
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-200 hover:bg-blue-600 hover:text-white"
              >
                Ver todos na Equipe
              </button>
              <button
                onClick={() => {
                  setFilterEquipeStatus('no_posto');
                  setActiveTab('equipe');
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-950/40 text-emerald-300 border border-emerald-500/30"
              >
                Apenas em Posto
              </button>
              <button
                onClick={() => {
                  setFilterEquipeStatus('falta');
                  setActiveTab('equipe');
                }}
                className="px-3 py-1.5 rounded-xl bg-red-950/40 text-red-300 border border-red-500/30"
              >
                Faltas e Vagas
              </button>
            </div>
          </div>
        )}

        {/* Resultados rápidos de pesquisa se digitado */}
        {localSearch.trim() && (
          <div className="p-3 rounded-2xl glass-panel border border-blue-500/30 space-y-2 max-h-60 overflow-y-auto no-scrollbar">
            <span className="text-[11px] text-slate-400 font-semibold block">
              Resultados da busca ({searchResults.length}):
            </span>
            {searchResults.length === 0 ? (
              <p className="text-xs text-slate-400 py-2 text-center">Nenhum resultado encontrado.</p>
            ) : (
              searchResults.map((colab) => (
                <div
                  key={colab.id}
                  onClick={() => {
                    const condo = condominios.find((c) => c.id === colab.condominioId);
                    if (condo) openPosto360(condo);
                  }}
                  className="p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-slate-800 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={colab.foto}
                      alt={colab.nome}
                      className="w-8 h-8 rounded-full object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{colab.nome}</p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {colab.funcao} · {colab.postoNome}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] text-blue-400 font-semibold shrink-0">
                    Ver posto →
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </section>

      {/* 8. SEÇÃO DE PLANTÕES E ESCALA DO DIA */}
      <section>
        <div className="glass-panel rounded-3xl p-4 sm:p-5 border border-slate-700/60 shadow-xl shadow-black/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Bloco esquerdo com data destacada em quadrado azul */}
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 border border-blue-400/40 shadow-lg shadow-blue-600/30 flex flex-col items-center justify-center text-white shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-100">
                Hoje
              </span>
              <span className="text-base sm:text-lg font-bold font-mono leading-none mt-0.5">
                {diaNum} {mesNome}
              </span>
            </div>

            {/* Bloco central com informações de horário */}
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-white">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>⏰ Plantão: 07h às 19h</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-300">
                <Users className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>👥 Funcionários Escalados: <strong className="text-white font-mono">{colaboradores.length}</strong></span>
              </div>
            </div>
          </div>

          {/* Bloco direito com status verde "Escala OK" e link "Ver detalhes ->" */}
          <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80 shrink-0">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 rounded-full shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Escala OK
            </span>

            <button
              onClick={() => {
                const targetPosto = condominios.find((c) => c.id === selectedCondominioId) || condominios[0];
                openEscalaModal(targetPosto);
              }}
              className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
            >
              <span>Ver detalhes</span>
              <span>-&gt;</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
