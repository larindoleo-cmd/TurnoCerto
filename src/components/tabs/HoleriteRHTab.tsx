import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Clock,
  FileCheck2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Eye,
  ShieldCheck,
  Search,
  DollarSign,
  Calendar,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { HoleriteRegistro } from '../../types';

export const HoleriteRHTab: React.FC = () => {
  const {
    holerites,
    pontos,
    atestados,
    colaboradores,
    openHoleriteDetalhe,
    aprovarAtestado,
    recusarAtestado,
    assinarHolerite,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'holerites' | 'pontos' | 'atestados'>('holerites');
  const [search, setSearch] = useState('');

  const filteredHolerites = holerites.filter((h) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      h.colaboradorNome.toLowerCase().includes(q) ||
      h.matricula.toLowerCase().includes(q) ||
      h.postoNome.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4 pb-20 animate-in fade-in duration-200">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
          Departamento Pessoal & Holerite RH
        </h2>
        <p className="text-xs text-slate-400">
          Controle de ponto eletrônico, contracheques digitais e atestados médicos
        </p>
      </div>

      {/* Sub-navigation tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800">
        <button
          onClick={() => setActiveSubTab('holerites')}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeSubTab === 'holerites'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Holerites Digitais ({holerites.length})
        </button>
        <button
          onClick={() => setActiveSubTab('pontos')}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeSubTab === 'pontos'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Espelho de Ponto ({pontos.length})
        </button>
        <button
          onClick={() => setActiveSubTab('atestados')}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all relative ${
            activeSubTab === 'atestados'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Atestados Médicos
          {atestados.filter((a) => a.status === 'Pendente').length > 0 && (
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 ml-1.5" />
          )}
        </button>
      </div>

      {/* SUB-TAB 1: Holerites Digitais */}
      {activeSubTab === 'holerites' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar holerite por funcionário, matrícula ou posto..."
              className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700/60 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="space-y-2.5">
            {filteredHolerites.length === 0 ? (
              <div className="p-8 text-center glass-panel rounded-2xl text-slate-400 space-y-2">
                <FileSpreadsheet className="w-8 h-8 text-blue-400 mx-auto mb-1" />
                <p className="text-xs font-semibold text-slate-300">Nenhum contracheque digital encontrado</p>
                <p className="text-[11px] text-slate-500">
                  Os holerites são emitidos após o fechamento da folha de pagamento dos postos.
                </p>
              </div>
            ) : (
              filteredHolerites.map((hol) => {
                const colab = colaboradores.find(
                  (c) => c.id === hol.colaboradorId || c.matricula === hol.matricula
                );
                const temFalta =
                  colab?.status === 'falta' ||
                  pontos.some(
                    (p) =>
                      (p.colaboradorId === hol.colaboradorId || p.colaboradorNome === hol.colaboradorNome) &&
                      p.statusPonto === 'Falta'
                  );
                const temAtestado =
                  colab?.status === 'afastado' ||
                  atestados.some(
                    (a) =>
                      a.colaboradorId === hol.colaboradorId ||
                      a.matricula === hol.matricula ||
                      a.colaboradorNome === hol.colaboradorNome
                  );
                const bonusValor =
                  hol.bonusAssiduidade !== undefined
                    ? hol.bonusAssiduidade
                    : colab?.valorBonus || 0;
                const bonusPerdido = (temFalta || temAtestado) && bonusValor > 0;
                const bonusAplicado = !temFalta && !temAtestado && bonusValor > 0;
                const liquidoCalculado = hol.liquidoReceber + (bonusAplicado ? bonusValor : 0);

                return (
                  <div
                    key={hol.id}
                    onClick={() => openHoleriteDetalhe(hol)}
                    className="glass-panel glass-panel-hover rounded-2xl p-4 cursor-pointer flex flex-col justify-between gap-3 active:scale-[0.99] transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-bold text-white truncate">{hol.colaboradorNome}</h4>
                          <span className="text-[10px] text-slate-400 font-mono">{hol.matricula}</span>
                        </div>
                        <p className="text-xs text-blue-400 font-medium truncate">
                          {hol.funcao} · <span className="text-slate-400">{hol.postoNome}</span>
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] text-slate-400">Ref: {hol.mesReferencia}</span>
                          {bonusAplicado && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                              +Bônus R$ {bonusValor.toFixed(0)} (100% Assíduo)
                            </span>
                          )}
                          {bonusPerdido && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-semibold">
                              Bônus Cancelado ({temFalta ? 'Falta' : 'Atestado'})
                            </span>
                          )}
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 ${
                          hol.statusEnvio === 'Assinado'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {hol.statusEnvio}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-slate-800/80">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">Salário Base</span>
                        <span className="text-slate-200 font-mono font-medium">
                          R$ {hol.salarioBase.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">Periculosidade</span>
                        <span className="text-emerald-400 font-mono font-medium">
                          {hol.adicionalPericulosidade > 0 ? `+R$ ${hol.adicionalPericulosidade.toFixed(2)}` : 'R$ 0,00'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-blue-400 block uppercase font-bold">Líquido</span>
                        <span className="text-sm font-bold font-mono text-white">
                          R$ {liquidoCalculado.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-400 font-mono">
                        Emitido em {hol.dataEmissao}
                      </span>
                      <span className="text-[11px] font-semibold text-blue-400 flex items-center gap-1 hover:text-blue-300">
                        <Eye className="w-3.5 h-3.5" />
                        Ver Contracheque
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: Espelho de Ponto Eletrônico */}
      {activeSubTab === 'pontos' && (
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300">
            Registros biométricos e geolocalizados validados por inteligência geográfica (Geocerca).
          </div>

          <div className="space-y-2">
            {pontos.length === 0 ? (
              <div className="p-8 text-center glass-panel rounded-2xl text-slate-400 space-y-2">
                <Clock className="w-8 h-8 text-blue-400 mx-auto mb-1" />
                <p className="text-xs font-semibold text-slate-300">Nenhum registro de ponto encontrado</p>
                <p className="text-[11px] text-slate-500">
                  Os batimentos de ponto dos colaboradores aparecerão aqui conforme forem efetuados.
                </p>
              </div>
            ) : (
              pontos.map((pto) => (
                <div
                  key={pto.id}
                  className="glass-panel rounded-2xl p-3.5 flex flex-col justify-between gap-2.5 text-xs"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-white text-xs">{pto.colaboradorNome}</h4>
                      <p className="text-[11px] text-slate-400">{pto.data}</p>
                    </div>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                        pto.statusPonto === 'Regular'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : pto.statusPonto === 'Falta'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {pto.statusPonto}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-1 p-2 rounded-lg bg-slate-950/60 border border-slate-800 text-center font-mono text-[11px]">
                    <div>
                      <span className="text-[9px] text-slate-500 block">Entrada 1</span>
                      <strong className="text-white">{pto.entrada1}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 block">Saída 1</span>
                      <strong className="text-slate-300">{pto.saida1}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 block">Entrada 2</span>
                      <strong className="text-slate-300">{pto.entrada2}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 block">Saída 2</span>
                      <strong className="text-slate-300">{pto.saida2}</strong>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 font-mono truncate">
                    GPS: {pto.localizacaoGPS}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: Atestados Médicos */}
      {activeSubTab === 'atestados' && (
        <div className="space-y-3">
          {atestados.length === 0 ? (
            <div className="p-8 text-center glass-panel rounded-2xl text-slate-400">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-xs">Nenhum atestado médico registrado.</p>
            </div>
          ) : (
            atestados.map((atest) => {
              const isPendente = atest.status === 'Pendente';
              const isAprovado = atest.status === 'Aprovado';

              return (
                <div
                  key={atest.id}
                  className="glass-panel rounded-2xl p-4 flex flex-col justify-between gap-3 text-xs"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-white text-sm">{atest.colaboradorNome}</h4>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {atest.matricula}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{atest.postoNome}</p>
                    </div>

                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                        isAprovado
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : isPendente
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}
                    >
                      {atest.status}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                    <p className="text-slate-200">
                      <strong>Diagnóstico:</strong> {atest.cid}
                    </p>
                    <p className="text-slate-400">
                      <strong>Médico Emissor:</strong> {atest.medico} ({atest.crm})
                    </p>
                    <p className="text-slate-400">
                      <strong>Período:</strong> {atest.diasAfastamento} dias a partir de {atest.dataInicio}
                    </p>
                  </div>

                  {isPendente && (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
                      <button
                        onClick={() => recusarAtestado(atest.id)}
                        className="px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 font-semibold text-xs active:scale-95 transition-all"
                      >
                        Recusar
                      </button>
                      <button
                        onClick={() => aprovarAtestado(atest.id)}
                        className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs active:scale-95 transition-all shadow-md shadow-emerald-600/20"
                      >
                        Aprovar e Abonar Falta
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
