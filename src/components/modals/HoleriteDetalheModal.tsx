import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  CheckCircle2,
  Download,
  Printer,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { HoleriteRegistro, Colaborador } from '../../types';
import { useApp } from '../../context/AppContext';
import { downloadHoleritePDF, generateHoleritePdfBytes } from '../../services/documentService';
import {
  confirmarCienciaHolerite,
  CIENCIA_DECLARACAO_VERSAO,
} from '../../services/holeriteWorkflowService';

interface HoleriteDetalheModalProps {
  holerite: HoleriteRegistro;
  onClose: () => void;
}

export const HoleriteDetalheModal: React.FC<HoleriteDetalheModalProps> = ({ holerite, onClose }) => {
  const {
    colaboradores,
    pontos,
    atestados,
    empresaInfo,
    setHolerites,
    openHoleriteDetalhe,
    currentUser,
    showToast,
  } = useApp();

  const [isDownloading, setIsDownloading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [cienciaMsg, setCienciaMsg] = useState<string | null>(null);

  const colab: Colaborador =
    colaboradores.find((c) => c.id === holerite.colaboradorId || c.matricula === holerite.matricula) || {
      id: holerite.colaboradorId,
      nome: holerite.colaboradorNome,
      matricula: holerite.matricula,
      funcao: holerite.funcao as Colaborador['funcao'],
      condominioId: null,
      postoNome: holerite.postoNome,
      status: 'no_posto',
      jornada: '12x36',
      tipoEscala: '12x36',
      turno: 'diurno',
      foto: '',
      telefone: '',
      cpf: '',
      dataAdmissao: '',
      bancoHoras: 0,
      salarioBase: holerite.salarioBase,
    };

  const temFalta =
    colab.status === 'falta' ||
    pontos.some(
      (p) =>
        (p.colaboradorId === holerite.colaboradorId || p.colaboradorNome === holerite.colaboradorNome) &&
        p.statusPonto === 'Falta'
    );

  const temAtestado =
    colab.status === 'afastado' ||
    atestados.some(
      (a) =>
        a.colaboradorId === holerite.colaboradorId ||
        a.matricula === holerite.matricula ||
        a.colaboradorNome === holerite.colaboradorNome
    );

  const bonusConfigurado =
    holerite.bonusAssiduidade !== undefined ? holerite.bonusAssiduidade : colab.valorBonus || 0;

  const temPendencias = temFalta || temAtestado;
  const bonusEfetivo = !temPendencias && bonusConfigurado > 0 ? bonusConfigurado : 0;
  const motivoPerdaBonus =
    temFalta && temAtestado
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

  const totalDescontos = holerite.descontoINSS + holerite.descontoVT + holerite.descontoVR;
  const liquidoFinal = totalProventos - totalDescontos;

  const isColaboradorDono =
    currentUser?.colaboradorId === holerite.colaboradorId ||
    currentUser?.role === 'funcionario';
  const cienciaConfirmada = Boolean(holerite.cienciaConfirmadaEm || holerite.statusEnvio === 'Assinado');

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      const result = await downloadHoleritePDF(holerite, colab, empresaInfo);
      showToast(`PDF real gerado e baixado (${result.fileName}).`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar PDF.';
      showToast(msg);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleConfirmarCiencia = async () => {
    setIsConfirming(true);
    setCienciaMsg(null);
    try {
      let sha = holerite.pdfSha256;
      if (!sha) {
        const gen = await generateHoleritePdfBytes(holerite, colab, empresaInfo);
        sha = gen.sha256;
      }
      const res = await confirmarCienciaHolerite(holerite, sha);
      if (res.success) {
        const updated: HoleriteRegistro = {
          ...holerite,
          statusEnvio: 'Assinado',
          pdfSha256: sha,
          cienciaConfirmadaEm: res.confirmadoEm || new Date().toISOString(),
          cienciaUsuarioId: currentUser?.id,
          cienciaDeclaracaoVersao: CIENCIA_DECLARACAO_VERSAO,
        };
        setHolerites((prev) => prev.map((h) => (h.id === holerite.id ? updated : h)));
        openHoleriteDetalhe(updated);
        showToast(res.message);
      } else {
        setCienciaMsg(res.message);
      }
    } finally {
      setIsConfirming(false);
    }
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
              <h2 className="text-sm font-bold text-white">
                Demonstrativo de Pagamento (v{holerite.versao || 1})
              </h2>
              <p className="text-[11px] text-slate-400">
                Competência: {holerite.mesReferencia}
                {holerite.statusPublicacao ? ` · ${holerite.statusPublicacao.toUpperCase()}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 text-xs font-mono no-scrollbar">
          {holerite.motivoRetificacao && (
            <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-200 font-sans text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block">Versão Retificada (v{holerite.versao || 2})</strong>
                <span>Motivo: {holerite.motivoRetificacao}</span>
              </div>
            </div>
          )}

          {/* Cabeçalho da Empresa Real */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-700/80 space-y-2">
            <div className="flex justify-between border-b border-slate-800 pb-2 gap-3">
              <div>
                <span className="font-bold text-white text-xs block uppercase">
                  {empresaInfo.razaoSocial || 'Empresa Empregadora'}
                </span>
                <span className="text-[10px] text-slate-400">
                  CNPJ: {empresaInfo.cnpj || 'Não informado'}
                  {empresaInfo.cidade ? ` · ${empresaInfo.cidade}/${empresaInfo.estado}` : ''}
                </span>
              </div>
              <div className="text-right shrink-0">
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

          {/* Verbas */}
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

                {holerite.adicionalNoturno > 0 && (
                  <tr>
                    <td className="p-2.5 text-slate-400">018</td>
                    <td className="p-2.5 font-sans">Adicional Noturno</td>
                    <td className="p-2.5 text-right">20%</td>
                    <td className="p-2.5 text-right tabular-nums font-semibold text-emerald-400">
                      R$ {holerite.adicionalNoturno.toFixed(2)}
                    </td>
                    <td className="p-2.5 text-right text-slate-500">-</td>
                  </tr>
                )}

                {(holerite.horasExtras50 > 0 || (holerite.plantoesFT && holerite.plantoesFT > 0) || holerite.valorHorasExtras > 0) && (
                  <tr>
                    <td className="p-2.5 text-slate-400">040</td>
                    <td className="p-2.5 font-sans">Plantão FT (Folga Trabalhada)</td>
                    <td className="p-2.5 text-right">{holerite.plantoesFT || 0} Plantões</td>
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
                            Ativo
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-sans font-bold">
                            Cancelado
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
              <span>Integridade SHA-256:</span>
              <strong className="block text-slate-200 truncate">
                {holerite.pdfSha256 ? holerite.pdfSha256.slice(0, 10) : 'Gerado no PDF'}
              </strong>
            </div>
          </div>

          {/* Registro Eletrônico de Recebimento e Ciência (Sem alegação falsa ICP-Brasil) */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5 font-sans">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-bold text-slate-200 block">
                    Registro Eletrônico de Recebimento e Ciência
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    Emitido em {holerite.dataEmissao}
                    {holerite.cienciaConfirmadaEm
                      ? ` · Ciência confirmada em ${new Date(holerite.cienciaConfirmadaEm).toLocaleString('pt-BR', {
                          timeZone: 'America/Sao_Paulo',
                        })}`
                      : ' · Aguardando confirmação de recebimento pelo colaborador'}
                  </span>
                </div>
              </div>

              {cienciaConfirmada ? (
                <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1 shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                  Recebimento Confirmado
                </span>
              ) : isColaboradorDono ? (
                <button
                  type="button"
                  disabled={isConfirming}
                  onClick={handleConfirmarCiencia}
                  className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs active:scale-95 cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {isConfirming ? 'Registrando...' : 'Confirmar recebimento e ciência'}
                </button>
              ) : (
                <span className="text-[11px] font-semibold text-amber-400 shrink-0">
                  Aguardando Colaborador
                </span>
              )}
            </div>

            <p className="text-[10px] text-slate-400 leading-snug border-t border-slate-800/80 pt-2">
              Aviso: A confirmação atesta apenas o recebimento e a ciência do demonstrativo pelo colaborador autenticado, não implica concordância com os valores lançados.
            </p>

            {cienciaMsg && (
              <p className="text-[11px] text-red-300 bg-red-950/40 border border-red-500/30 rounded-lg p-2">
                {cienciaMsg}
              </p>
            )}
          </div>
        </div>

        <div className="p-4 bg-slate-900/90 border-t border-slate-800 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-sans cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir
            </button>
            <button
              disabled={isDownloading}
              onClick={handleDownloadPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-sans font-semibold cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isDownloading ? 'Gerando PDF...' : 'Baixar PDF'}</span>
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-lg font-sans cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
