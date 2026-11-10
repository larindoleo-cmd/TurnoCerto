import React from 'react';
import { X, FileSpreadsheet, CheckCircle2, Download, Printer, ShieldCheck } from 'lucide-react';
import { HoleriteRegistro } from '../../types';
import { useApp } from '../../context/AppContext';

interface HoleriteDetalheModalProps {
  holerite: HoleriteRegistro;
  onClose: () => void;
}

export const HoleriteDetalheModal: React.FC<HoleriteDetalheModalProps> = ({ holerite, onClose }) => {
  const { assinarHolerite, colaboradores, pontos, atestados } = useApp();

  // Buscar dados do colaborador para verificar bônus e histórico
  const colab = colaboradores.find(
    (c) => c.id === holerite.colaboradorId || c.matricula === holerite.matricula
  );

  // Regra de Assiduidade: Verificar faltas e atestados
  const temFalta =
    colab?.status === 'falta' ||
    pontos.some(
      (p) =>
        (p.colaboradorId === holerite.colaboradorId || p.colaboradorNome === holerite.colaboradorNome) &&
        p.statusPonto === 'Falta'
    );

  const temAtestado =
    colab?.status === 'afastado' ||
    atestados.some(
      (a) =>
        a.colaboradorId === holerite.colaboradorId ||
        a.matricula === holerite.matricula ||
        a.colaboradorNome === holerite.colaboradorNome
    );

  const bonusConfigurado =
    holerite.bonusAssiduidade !== undefined
      ? holerite.bonusAssiduidade
      : colab?.valorBonus || 0;

  // Bônus só é somado se NÃO houver faltas e NÃO houver atestados
  const temPendencias = temFalta || temAtestado;
  const bonusEfetivo = !temPendencias && bonusConfigurado > 0 ? bonusConfigurado : 0;
  const motivoPerdaBonus = temFalta && temAtestado
    ? 'Falta injustificada e Atestado médico registrados no período'
    : temFalta
    ? 'Registro de falta no turno de trabalho'
    : temAtestado
    ? 'Atestado médico registrado no período'
    : undefined;

  const totalProventos =
    holerite.salarioBase +
    holerite.adicionalPericulosidade +
    holerite.adicionalNoturno +
    holerite.valorHorasExtras +
    bonusEfetivo;

  const totalDescontos =
    holerite.descontoINSS +
    holerite.descontoVT +
    holerite.descontoVR;

  const liquidoFinal = totalProventos - totalDescontos;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full sm:max-w-2xl max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-[#0B132B] border border-slate-700/60 shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-250">
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Demonstrativo de Pagamento (Holerite)</h2>
              <p className="text-[11px] text-slate-400">Competência: {holerite.mesReferencia}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Paper Document Representation */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs font-mono no-scrollbar">
          {/* Header of the paystub */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-700/80 space-y-2">
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <div>
                <span className="font-bold text-white text-xs block">TURNOCERTO SERVIÇOS TERCEIRIZADOS LTDA</span>
                <span className="text-[10px] text-slate-400">CNPJ: 42.109.876/0001-50 · INSC. EST: ISENTO</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">RECIBO DE PAGAMENTO</span>
                <span className="text-xs font-bold text-blue-400">{holerite.mesReferencia}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
              <div>
                <span className="text-slate-400">Colaborador: </span>
                <span className="text-white font-bold">{holerite.colaboradorNome}</span>
              </div>
              <div>
                <span className="text-slate-400">Matrícula: </span>
                <span className="text-white">{holerite.matricula}</span>
              </div>
              <div>
                <span className="text-slate-400">Cargo: </span>
                <span className="text-slate-200">{holerite.funcao}</span>
              </div>
              <div>
                <span className="text-slate-400">Posto: </span>
                <span className="text-slate-200">{holerite.postoNome}</span>
              </div>
            </div>
          </div>

          {/* Table of items (Proventos e Descontos) */}
          <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/50">
            <table className="w-full text-[11px] text-left">
              <thead className="bg-slate-800/80 text-slate-300 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-2.5">Cód.</th>
                  <th className="p-2.5">Descrição da Verba</th>
                  <th className="p-2.5 text-right">Referência</th>
                  <th className="p-2.5 text-right text-emerald-400">Vencimentos</th>
                  <th className="p-2.5 text-right text-red-400">Descontos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                <tr>
                  <td className="p-2.5 text-slate-400">001</td>
                  <td className="p-2.5 font-sans font-medium text-white">Salário Base Mensal</td>
                  <td className="p-2.5 text-right">30d</td>
                  <td className="p-2.5 text-right tabular-nums font-semibold">
                    R$ {holerite.salarioBase.toFixed(2)}
                  </td>
                  <td className="p-2.5 text-right text-slate-500">-</td>
                </tr>

                {holerite.adicionalPericulosidade > 0 && (
                  <tr>
                    <td className="p-2.5 text-slate-400">015</td>
                    <td className="p-2.5 font-sans">Adic. Periculosidade</td>
                    <td className="p-2.5 text-right">30%</td>
                    <td className="p-2.5 text-right tabular-nums font-semibold text-emerald-400">
                      R$ {holerite.adicionalPericulosidade.toFixed(2)}
                    </td>
                    <td className="p-2.5 text-right text-slate-500">-</td>
                  </tr>
                )}

                {(holerite.horasExtras50 > 0 || (holerite.plantoesFT && holerite.plantoesFT > 0)) && (
                  <tr>
                    <td className="p-2.5 text-slate-400">040</td>
                    <td className="p-2.5 font-sans">Plantão FT (Folga Trabalhada)</td>
                    <td className="p-2.5 text-right">{holerite.plantoesFT || Math.round(holerite.horasExtras50 / 6) || 2} Plantões</td>
                    <td className="p-2.5 text-right tabular-nums font-semibold text-emerald-400">
                      R$ {(holerite.valorFT || holerite.valorHorasExtras).toFixed(2)}
                    </td>
                    <td className="p-2.5 text-right text-slate-500">-</td>
                  </tr>
                )}

                {bonusConfigurado > 0 && (
                  <tr className={bonusEfetivo > 0 ? 'bg-emerald-950/20' : 'bg-red-950/20'}>
                    <td className="p-2.5 text-slate-400">070</td>
                    <td className="p-2.5 font-sans">
                      <div className="flex items-center gap-1.5">
                        <span className={bonusEfetivo > 0 ? 'text-emerald-300 font-semibold' : 'text-slate-400 line-through'}>
                          Bônus de Assiduidade
                        </span>
                        {bonusEfetivo > 0 ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-sans">
                            100% Pontual
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-sans font-bold">
                            Cancelado (Falta/Atestado)
                          </span>
                        )}
                      </div>
                      {motivoPerdaBonus && (
                        <span className="text-[10px] text-red-400 font-sans block mt-0.5">
                          Motivo: {motivoPerdaBonus}
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 text-right font-sans text-[10px] text-slate-400">
                      {bonusEfetivo > 0 ? 'Integral' : 'Perdido'}
                    </td>
                    <td className="p-2.5 text-right tabular-nums font-semibold text-emerald-400">
                      {bonusEfetivo > 0 ? `+R$ ${bonusEfetivo.toFixed(2)}` : 'R$ 0,00'}
                    </td>
                    <td className="p-2.5 text-right text-slate-500">-</td>
                  </tr>
                )}

                <tr>
                  <td className="p-2.5 text-slate-400">101</td>
                  <td className="p-2.5 font-sans">INSS Folha Mensal</td>
                  <td className="p-2.5 text-right">Tab.</td>
                  <td className="p-2.5 text-right text-slate-500">-</td>
                  <td className="p-2.5 text-right tabular-nums text-red-400 font-semibold">
                    R$ {holerite.descontoINSS.toFixed(2)}
                  </td>
                </tr>

                <tr>
                  <td className="p-2.5 text-slate-400">105</td>
                  <td className="p-2.5 font-sans">Vale Transporte (6%)</td>
                  <td className="p-2.5 text-right">6.00%</td>
                  <td className="p-2.5 text-right text-slate-500">-</td>
                  <td className="p-2.5 text-right tabular-nums text-red-400">
                    R$ {holerite.descontoVT.toFixed(2)}
                  </td>
                </tr>

                <tr>
                  <td className="p-2.5 text-slate-400">110</td>
                  <td className="p-2.5 font-sans">Vale Alimentação / Refeição</td>
                  <td className="p-2.5 text-right">Copart.</td>
                  <td className="p-2.5 text-right text-slate-500">-</td>
                  <td className="p-2.5 text-right tabular-nums text-red-400">
                    R$ {holerite.descontoVR.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Totals & Net Pay */}
          <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-900 border border-slate-800">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">Total Proventos</span>
              <span className="text-xs font-bold text-emerald-400 tabular-nums">
                R$ {totalProventos.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">Total Descontos</span>
              <span className="text-xs font-bold text-red-400 tabular-nums">
                R$ {totalDescontos.toFixed(2)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-blue-400 block uppercase font-bold">Líquido a Receber</span>
              <span className="text-sm font-bold text-white tabular-nums">
                R$ {liquidoFinal.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Legal bases (FGTS, Salário Contribuição) */}
          <div className="grid grid-cols-4 gap-2 text-[10px] p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-slate-400">
            <div>
              <span>Sal. Contr. INSS:</span>
              <strong className="block text-slate-200">R$ {holerite.salarioBase.toFixed(2)}</strong>
            </div>
            <div>
              <span>Base Cálc. FGTS:</span>
              <strong className="block text-slate-200">R$ {totalProventos.toFixed(2)}</strong>
            </div>
            <div>
              <span>FGTS do Mês (8%):</span>
              <strong className="block text-emerald-400">R$ {holerite.descontoFGTS.toFixed(2)}</strong>
            </div>
            <div>
              <span>Base Cálc. IRRF:</span>
              <strong className="block text-slate-200">Isento</strong>
            </div>
          </div>

          {/* Digital Signature status */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <div>
                <span className="text-xs font-bold text-slate-200 block">Assinatura Digital ICP-Brasil</span>
                <span className="text-[10px] text-slate-400">
                  Status: {holerite.statusEnvio} · Emitido em {holerite.dataEmissao}
                </span>
              </div>
            </div>
            {holerite.statusEnvio !== 'Assinado' ? (
              <button
                onClick={() => assinarHolerite(holerite.id)}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-sans font-semibold text-xs active:scale-95"
              >
                Assinar Digitalmente
              </button>
            ) : (
              <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1 font-sans">
                <CheckCircle2 className="w-4 h-4" />
                Válido Juridicamente
              </span>
            )}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-slate-900/90 border-t border-slate-800 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-sans"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir
            </button>
            <button
              onClick={() => alert(`Download do holerite ${holerite.mesReferencia} iniciado em PDF!`)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-sans"
            >
              <Download className="w-3.5 h-3.5" />
              PDF
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-lg font-sans"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
