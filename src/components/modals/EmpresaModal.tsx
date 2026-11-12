import React, { useState, useEffect } from 'react';
import {
  X,
  Building2,
  FileText,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  Shield,
  CreditCard,
  UserCheck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { EmpresaInfo } from '../../types';

interface EmpresaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EmpresaModal: React.FC<EmpresaModalProps> = ({ isOpen, onClose }) => {
  const { empresaInfo, atualizarEmpresaInfo } = useApp();

  const [formData, setFormData] = useState<EmpresaInfo>({ ...empresaInfo });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setFormData({ ...empresaInfo });
  }, [empresaInfo, isOpen]);

  if (!isOpen) return null;

  const handleCnpjChange = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 14);
    const masked = raw
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
    setFormData((prev) => ({ ...prev, cnpj: masked }));
  };

  const handlePhoneChange = (val: string, field: 'telefone' | 'whatsapp') => {
    const raw = val.replace(/\D/g, '').slice(0, 11);
    const masked = raw
      .replace(/^(\d{2})(\d)/g, '($1) $2')
      .replace(/(\d{5})(\d{4})$/, '$1-$2');
    setFormData((prev) => ({ ...prev, [field]: masked }));
  };

  const handleCepChange = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 8);
    const masked = raw.replace(/^(\d{5})(\d)/, '$1-$2');
    setFormData((prev) => ({ ...prev, cep: masked }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      atualizarEmpresaInfo(formData);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full sm:max-w-xl max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-[#080E22] border border-blue-500/30 shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-250">
        {/* Header */}
        <div className="relative px-5 py-4 border-b border-slate-800/80 bg-slate-900/80 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Dados da Empresa Terceirizada
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Matriz
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Cadastro societário, fiscal e contatos para contratos e holerites
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 no-scrollbar space-y-4 text-xs">
          {/* Informações Societárias */}
          <div className="p-3.5 rounded-2xl bg-blue-950/20 border border-blue-500/25 flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-300">
              Esses dados são vinculados automaticamente nos cabeçalhos de relatórios, folhas de ponto, demonstrativos de pagamento e contratos com os condomínios clientes.
            </p>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Razão Social <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.razaoSocial}
              onChange={(e) => setFormData({ ...formData, razaoSocial: e.target.value })}
              placeholder="Ex: TurnoCerto Serviços Terceirizados & Segurança Ltda."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Nome Fantasia <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.nomeFantasia}
                onChange={(e) => setFormData({ ...formData, nomeFantasia: e.target.value })}
                placeholder="Ex: TurnoCerto Soluções"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                CNPJ da Matriz <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.cnpj}
                onChange={(e) => handleCnpjChange(e.target.value)}
                placeholder="00.000.000/0001-00"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Inscrição Estadual</label>
              <input
                type="text"
                value={formData.inscricaoEstadual || ''}
                onChange={(e) => setFormData({ ...formData, inscricaoEstadual: e.target.value })}
                placeholder="Ex: 114.928.304.110"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Inscrição Municipal</label>
              <input
                type="text"
                value={formData.inscricaoMunicipal || ''}
                onChange={(e) => setFormData({ ...formData, inscricaoMunicipal: e.target.value })}
                placeholder="Ex: 9.821.450-3"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-xs"
              />
            </div>
          </div>

          {/* Telefones e E-mail */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Telefone Central 24h <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.telefone}
                onChange={(e) => handlePhoneChange(e.target.value, 'telefone')}
                placeholder="(11) 3254-8900"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                WhatsApp Operacional (Supervisão)
              </label>
              <input
                type="text"
                value={formData.whatsapp}
                onChange={(e) => handlePhoneChange(e.target.value, 'whatsapp')}
                placeholder="(11) 98765-4321"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              E-mail Corporativo Principal <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="contato@turnocerto.com.br"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs"
            />
          </div>

          {/* Endereço da Sede */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Endereço da Sede / Matriz <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.endereco}
              onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
              placeholder="Av. Paulista, 1842 - 14º Andar, Cj. 142"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-slate-300 font-semibold mb-1">Bairro</label>
              <input
                type="text"
                value={formData.bairro}
                onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                placeholder="Bela Vista"
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Cidade</label>
              <input
                type="text"
                value={formData.cidade}
                onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                placeholder="São Paulo"
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">UF</label>
              <input
                type="text"
                maxLength={2}
                value={formData.estado}
                onChange={(e) => setFormData({ ...formData, estado: e.target.value.toUpperCase() })}
                placeholder="SP"
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono uppercase focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">CEP</label>
              <input
                type="text"
                value={formData.cep}
                onChange={(e) => handleCepChange(e.target.value)}
                placeholder="01310-200"
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Responsável Operacional e Chave Pix */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Responsável Operacional / Diretor
              </label>
              <input
                type="text"
                value={formData.responsavelOperacional}
                onChange={(e) => setFormData({ ...formData, responsavelOperacional: e.target.value })}
                placeholder="Ex: Marcio Toledo - Gerente de Operações"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Cargo / Função</label>
              <input
                type="text"
                value={formData.cargoResponsavel}
                onChange={(e) => setFormData({ ...formData, cargoResponsavel: e.target.value })}
                placeholder="Ex: Diretor de Operações e Segurança"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Chave Pix Corporativa da Empresa
            </label>
            <input
              type="text"
              value={formData.chavePix || ''}
              onChange={(e) => setFormData({ ...formData, chavePix: e.target.value })}
              placeholder="financeiro@turnocerto.com.br"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Apresentação Institucional / Missão
            </label>
            <textarea
              rows={2}
              value={formData.apresentacao || ''}
              onChange={(e) => setFormData({ ...formData, apresentacao: e.target.value })}
              placeholder="Breve descrição da empresa e escopo de atuação terceirizada..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs"
            />
          </div>

          {/* Parâmetros Operacionais de GPS e Escala */}
          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-blue-300">
              Parâmetros Operacionais de Ponto e Coberturas
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Limite Máximo de Precisão GPS (metros)
                </label>
                <input
                  type="number"
                  min={10}
                  max={500}
                  value={formData.maxGpsAccuracyM ?? 80}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maxGpsAccuracyM: Math.max(10, Math.min(500, Number(e.target.value) || 80)),
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  Leituras com precisão pior que ±{formData.maxGpsAccuracyM ?? 80}m ficam inconclusivas (padrão: 80m).
                </span>
              </div>

              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/80 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(formData.exigeAceiteCobertura)}
                  onChange={(e) =>
                    setFormData({ ...formData, exigeAceiteCobertura: e.target.checked })
                  }
                  className="mt-0.5 rounded border-slate-600 bg-slate-900 text-blue-600"
                />
                <div>
                  <span className="text-xs font-semibold text-white block">
                    Exigir aceite do colaborador em extras/coberturas
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Quando ativo, novas coberturas aguardam confirmação do funcionário no app.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Footer Controls */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs transition-colors"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Salvando...' : 'Salvar Dados da Empresa'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
