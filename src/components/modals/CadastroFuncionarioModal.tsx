import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  FileText,
  Building,
  CreditCard,
  Camera,
  Upload,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  KeyRound,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FuncaoColaborador, NovoFuncionarioPayload, StatusColaborador } from '../../types';

interface CadastroFuncionarioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&auto=format&fit=crop&q=80',
];

const BANCOS_BRASIL = [
  '001 - Banco do Brasil S.A.',
  '033 - Banco Santander (Brasil) S.A.',
  '104 - Caixa Econômica Federal',
  '237 - Banco Bradesco S.A.',
  '341 - Itaú Unibanco S.A.',
  '260 - Nu Pagamentos S.A. (Nubank)',
  '077 - Banco Inter S.A.',
  '336 - Banco C6 S.A.',
];

export const CadastroFuncionarioModal: React.FC<CadastroFuncionarioModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    condominios,
    cadastrarFuncionario,
    atualizarFuncionario,
    excluirFuncionario,
    colaboradorParaEditar,
    closeCadastroModal,
  } = useApp();

  const isEditing = !!colaboradorParaEditar;
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [status, setStatus] = useState<StatusColaborador>('no_posto');

  // CEP Lookup States
  const [cep, setCep] = useState<string>('');
  const [logradouro, setLogradouro] = useState<string>('');
  const [numero, setNumero] = useState<string>('');
  const [complemento, setComplemento] = useState<string>('');
  const [bairro, setBairro] = useState<string>('');
  const [cidadeUf, setCidadeUf] = useState<string>('');
  const [isLoadingCep, setIsLoadingCep] = useState<boolean>(false);
  const [cepError, setCepError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<NovoFuncionarioPayload>({
    // Etapa 1
    foto: PRESET_AVATARS[0],
    nome: '',
    cpf: '',
    rg: '',
    telefone: '',
    dataNascimento: '',
    email: '',
    role: 'funcionario',
    // Etapa 2
    pis: '',
    ctps: '',
    nomeMae: '',
    endereco: '',
    // Etapa 3
    condominioId: condominios[0]?.id || '',
    cargo: 'Porteiro',
    regimeEscala: '12x36',
    turnoInicio: '07:00',
    turnoFim: '19:00',
    dataAdmissao: new Date().toISOString().split('T')[0],
    salarioBase: 2150,
    // Etapa 4
    pix: '',
    banco: BANCOS_BRASIL[4], // Itaú
    agencia: '',
    conta: '',
    recebeVT: true,
    recebeVR: true,
    valorVR: 28.5,
    recebeVA: true,
    valorVA: 220.0,
    valorExtraFT: 160.0,
    valorBonus: 0,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Parse existing endereco into subcomponents if possible
  const parseAddress = (rawAddress: string) => {
    if (!rawAddress) return;
    // Expected format: "Logradouro, nº Numero - Compl, Bairro, Cidade/UF - CEP 00000-000" or raw
    const cepMatch = rawAddress.match(/\b\d{5}-?\d{3}\b/);
    if (cepMatch) {
      const c = cepMatch[0].replace(/\D/g, '');
      if (c.length === 8) {
        setCep(c.slice(0, 5) + '-' + c.slice(5));
      }
    }
  };

  useEffect(() => {
    if (colaboradorParaEditar) {
      setFormData({
        foto: colaboradorParaEditar.foto || PRESET_AVATARS[0],
        nome: colaboradorParaEditar.nome || '',
        cpf: colaboradorParaEditar.cpf || '',
        rg: colaboradorParaEditar.rg || '',
        telefone: colaboradorParaEditar.telefone || '',
        dataNascimento: colaboradorParaEditar.dataNascimento || '',
        pis: colaboradorParaEditar.pis || '',
        ctps: colaboradorParaEditar.ctps || '',
        nomeMae: colaboradorParaEditar.nomeMae || '',
        endereco: colaboradorParaEditar.endereco || '',
        condominioId: colaboradorParaEditar.condominioId || '',
        cargo: colaboradorParaEditar.funcao || 'Porteiro',
        regimeEscala: colaboradorParaEditar.tipoEscala || '12x36',
        turnoInicio: colaboradorParaEditar.turnoInicio || '07:00',
        turnoFim: colaboradorParaEditar.turnoFim || '19:00',
        dataAdmissao: colaboradorParaEditar.dataAdmissao || new Date().toISOString().split('T')[0],
        salarioBase: colaboradorParaEditar.salarioBase || 2150,
        pix: colaboradorParaEditar.pix || '',
        banco: colaboradorParaEditar.banco || BANCOS_BRASIL[4],
        agencia: colaboradorParaEditar.agencia || '',
        conta: colaboradorParaEditar.conta || '',
        recebeVT: colaboradorParaEditar.recebeVT !== false,
        recebeVR: colaboradorParaEditar.recebeVR !== false,
        valorVR: colaboradorParaEditar.valorVR !== undefined ? colaboradorParaEditar.valorVR : 28.5,
        recebeVA: colaboradorParaEditar.recebeVA !== false,
        valorVA: colaboradorParaEditar.valorVA !== undefined ? colaboradorParaEditar.valorVA : 220.0,
        valorExtraFT: colaboradorParaEditar.valorExtraFT !== undefined ? colaboradorParaEditar.valorExtraFT : 160.0,
        valorBonus: colaboradorParaEditar.valorBonus || 0,
        email: colaboradorParaEditar.email || '',
        role: colaboradorParaEditar.role || 'funcionario',
      });
      setStatus(colaboradorParaEditar.status || 'no_posto');
      parseAddress(colaboradorParaEditar.endereco || '');
    } else {
      setFormData({
        foto: PRESET_AVATARS[0],
        nome: '',
        cpf: '',
        rg: '',
        telefone: '',
        dataNascimento: '',
        email: '',
        role: 'funcionario',
        pis: '',
        ctps: '',
        nomeMae: '',
        endereco: '',
        condominioId: condominios[0]?.id || '',
        cargo: 'Porteiro',
        regimeEscala: '12x36',
        turnoInicio: '07:00',
        turnoFim: '19:00',
        dataAdmissao: new Date().toISOString().split('T')[0],
        salarioBase: 2150,
        pix: '',
        banco: BANCOS_BRASIL[4],
        agencia: '',
        conta: '',
        recebeVT: true,
        recebeVR: true,
        valorVR: 28.5,
        recebeVA: true,
        valorVA: 220.0,
        valorExtraFT: 160.0,
        valorBonus: 0,
      });
      setStatus('no_posto');
      setCep('');
      setLogradouro('');
      setNumero('');
      setComplemento('');
      setBairro('');
      setCidadeUf('');
      setCepError(null);
    }
    setCurrentStep(1);
    setConfirmDelete(false);
    setErrors({});
  }, [colaboradorParaEditar, isOpen]);

  // Sync composed address to formData.endereco
  const updateComposedAddress = (
    c = cep,
    log = logradouro,
    num = numero,
    comp = complemento,
    bai = bairro,
    cid = cidadeUf
  ) => {
    const parts: string[] = [];
    if (log) {
      let street = log;
      if (num.trim()) street += `, nº ${num.trim()}`;
      else street += ', s/n';
      if (comp.trim()) street += ` (${comp.trim()})`;
      parts.push(street);
    }
    if (bai) parts.push(bai);
    if (cid) parts.push(cid);
    if (c) parts.push(`CEP ${c}`);

    const full = parts.join(' - ');
    setFormData((prev) => ({ ...prev, endereco: full }));
  };

  if (!isOpen) return null;

  // Formatters & Masks
  const handleCpfChange = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 11);
    const masked = raw
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    setFormData((prev) => ({ ...prev, cpf: masked }));
  };

  const handlePhoneChange = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 11);
    const masked = raw
      .replace(/^(\d{2})(\d)/g, '($1) $2')
      .replace(/(\d{5})(\d{4})$/, '$1-$2');
    setFormData((prev) => ({ ...prev, telefone: masked }));
  };

  const handlePisChange = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 11);
    const masked = raw
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{5})(\d)/, '$1.$2.$3')
      .replace(/(\d{2})$/, '-$1');
    setFormData((prev) => ({ ...prev, pis: masked }));
  };

  // CEP Mask and ViaCEP Auto Fetch
  const handleCepChange = async (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 8);
    const masked = raw.length > 5 ? `${raw.slice(0, 5)}-${raw.slice(5)}` : raw;
    setCep(masked);
    setCepError(null);

    if (raw.length === 8) {
      setIsLoadingCep(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
        const data = await response.json();
        if (data.erro) {
          setCepError('CEP não encontrado. Preencha manualmente.');
        } else {
          const newLog = data.logradouro || '';
          const newBairro = data.bairro || '';
          const newCid = `${data.localidade || ''} - ${data.uf || ''}`;
          setLogradouro(newLog);
          setBairro(newBairro);
          setCidadeUf(newCid);
          setCepError(null);
          updateComposedAddress(masked, newLog, numero, complemento, newBairro, newCid);
        }
      } catch (err) {
        setCepError('Não foi possível consultar o CEP automaticamente.');
      } finally {
        setIsLoadingCep(false);
      }
    }
  };

  const handleNumeroChange = (val: string) => {
    setNumero(val);
    updateComposedAddress(cep, logradouro, val, complemento, bairro, cidadeUf);
  };

  const handleComplementoChange = (val: string) => {
    setComplemento(val);
    updateComposedAddress(cep, logradouro, numero, val, bairro, cidadeUf);
  };

  // Image Upload handler
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setFormData((prev) => ({ ...prev, foto: reader.result as string }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Step Validation (Etapa 1 é rápida; Etapas 2, 3 e 4 são 100% opcionais para agilizar o cadastro)
  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.nome.trim()) newErrors.nome = 'Nome completo é obrigatório';
      if (!formData.cpf.trim() || formData.cpf.replace(/\D/g, '').length < 11)
        newErrors.cpf = 'CPF válido (11 dígitos) é obrigatório';
    }
    // Etapas 2, 3 e 4: Todos os campos são opcionais por solicitação do usuário, podendo ser ajustados depois em Editar.

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const goToStep = (targetStep: number) => {
    // If navigating forward from step 1, validate step 1
    if (targetStep > 1 && !validateStep(1)) {
      return;
    }
    setCurrentStep(Math.max(1, Math.min(4, targetStep)));
  };

  const handleNext = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 4));
    }
  };

  const handlePrev = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(1)) {
      setCurrentStep(1);
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing && colaboradorParaEditar) {
        await atualizarFuncionario(colaboradorParaEditar.id, {
          nome: formData.nome,
          foto: formData.foto,
          cpf: formData.cpf,
          rg: formData.rg,
          telefone: formData.telefone,
          dataNascimento: formData.dataNascimento,
          pis: formData.pis,
          ctps: formData.ctps,
          nomeMae: formData.nomeMae,
          endereco: formData.endereco,
          condominioId: formData.condominioId || null,
          funcao: formData.cargo,
          tipoEscala: formData.regimeEscala,
          turnoInicio: formData.turnoInicio,
          turnoFim: formData.turnoFim,
          dataAdmissao: formData.dataAdmissao,
          salarioBase: Number(formData.salarioBase),
          pix: formData.pix,
          banco: formData.banco,
          agencia: formData.agencia,
          conta: formData.conta,
          recebeVT: formData.recebeVT,
          recebeVR: formData.recebeVR,
          valorVR: formData.valorVR,
          recebeVA: formData.recebeVA,
          valorVA: formData.valorVA,
          valorExtraFT: formData.valorExtraFT,
          valorBonus: formData.valorBonus,
          status: status,
        });
      } else {
        await cadastrarFuncionario(formData);
      }
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!colaboradorParaEditar) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setIsSubmitting(true);
    try {
      await excluirFuncionario(colaboradorParaEditar.id);
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
      <div className="w-full sm:max-w-2xl max-h-[94vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-[#080E22] border border-blue-500/30 shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-250">
        {/* Header do Stepper Modal */}
        <div className="relative px-5 py-4 border-b border-slate-800/80 bg-slate-900/80 shrink-0">
          {/* Mobile drag handle affordance */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 bg-slate-700 rounded-full sm:hidden" />

          <div className="flex items-center justify-between mt-1 sm:mt-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  {isEditing ? 'Editar Colaborador' : 'Cadastro de Funcionário'}
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {isEditing ? colaboradorParaEditar?.matricula : 'eSocial & CLT'}
                  </span>
                </h2>
                <p className="text-[11px] text-slate-400">
                  Etapa {currentStep} de 4 · {isEditing ? `Atualizando dados cadastrais` : 'Cadastro Rápido (Preencha o essencial e complete quando quiser)'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Stepper Interactive Tab Bar */}
          <div className="mt-4">
            <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] font-semibold mb-2">
              <button
                type="button"
                onClick={() => goToStep(1)}
                className={`py-1.5 px-1 rounded-xl transition-all cursor-pointer flex flex-col items-center gap-0.5 border ${
                  currentStep === 1
                    ? 'bg-blue-600/25 border-blue-500/60 text-white shadow-sm ring-1 ring-blue-500/40'
                    : currentStep > 1
                    ? 'bg-slate-900/80 border-slate-700/60 text-blue-300 hover:text-white'
                    : 'bg-slate-900/40 border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
              >
                <span className="font-bold">1. Identidade</span>
                <span className="text-[9px] text-blue-400 font-normal">Obrigatório</span>
              </button>

              <button
                type="button"
                onClick={() => goToStep(2)}
                className={`py-1.5 px-1 rounded-xl transition-all cursor-pointer flex flex-col items-center gap-0.5 border ${
                  currentStep === 2
                    ? 'bg-blue-600/25 border-blue-500/60 text-white shadow-sm ring-1 ring-blue-500/40'
                    : currentStep > 2
                    ? 'bg-slate-900/80 border-slate-700/60 text-blue-300 hover:text-white'
                    : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span className="font-bold">2. Endereço</span>
                <span className="text-[9px] text-emerald-400 font-normal">ViaCEP</span>
              </button>

              <button
                type="button"
                onClick={() => goToStep(3)}
                className={`py-1.5 px-1 rounded-xl transition-all cursor-pointer flex flex-col items-center gap-0.5 border ${
                  currentStep === 3
                    ? 'bg-blue-600/25 border-blue-500/60 text-white shadow-sm ring-1 ring-blue-500/40'
                    : currentStep > 3
                    ? 'bg-slate-900/80 border-slate-700/60 text-blue-300 hover:text-white'
                    : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span className="font-bold">3. Posto</span>
                <span className="text-[9px] text-purple-400 font-normal">Escala</span>
              </button>

              <button
                type="button"
                onClick={() => goToStep(4)}
                className={`py-1.5 px-1 rounded-xl transition-all cursor-pointer flex flex-col items-center gap-0.5 border ${
                  currentStep === 4
                    ? 'bg-blue-600/25 border-blue-500/60 text-white shadow-sm ring-1 ring-blue-500/40'
                    : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span className="font-bold">4. Bancário</span>
                <span className="text-[9px] text-emerald-400 font-normal">Pix & VT</span>
              </button>
            </div>

            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden flex">
              <div
                className="bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${(currentStep / 4) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Formulário com Scroll Suave */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 no-scrollbar space-y-4 text-xs">
          {/* ========================================================================= */}
          {/* ETAPA 1: Identidade & Foto Facial */}
          {/* ========================================================================= */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-3.5 rounded-2xl bg-blue-950/20 border border-blue-500/25 flex items-start gap-3 text-slate-300">
                <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-white text-xs">Reconhecimento Facial e Ponto Digital</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    A foto cadastrada é utilizada na portaria virtual, geocerca e conferência biométrica da folha de pagamento.
                  </p>
                </div>
              </div>

              {/* Captura / Seleção de Foto */}
              <div className="glass-panel rounded-2xl p-4 border border-slate-700/60 flex flex-col sm:flex-row items-center gap-4">
                <div className="relative group shrink-0">
                  <img
                    src={formData.foto}
                    alt="Foto do Funcionário"
                    className="w-20 h-20 rounded-2xl object-cover border-2 border-blue-500/50 shadow-lg"
                  />
                  <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Camera className="w-5 h-5 text-white" />
                  </div>
                </div>

                <div className="flex-1 space-y-2 text-center sm:text-left">
                  <span className="text-xs font-bold text-white block">Foto de Identificação</span>
                  <p className="text-[11px] text-slate-400">
                    Selecione um dos avatares corporativos ou envie uma foto do colaborador:
                  </p>
                  
                  {/* Preset Avatar Picker */}
                  <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
                    {PRESET_AVATARS.map((av, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, foto: av }))}
                        className={`w-8 h-8 rounded-full overflow-hidden border-2 transition-transform active:scale-95 ${
                          formData.foto === av ? 'border-blue-400 scale-110' : 'border-transparent opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img src={av} alt="Opção" className="w-full h-full object-cover" />
                      </button>
                    ))}

                    <label className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold cursor-pointer border border-slate-700 ml-1">
                      <Upload className="w-3 h-3 text-blue-400" />
                      <span>Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageFileChange}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Campos: Nome, CPF, RG, Telefone, Data Nasc */}
              <div className="space-y-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Nome Completo <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: Carlos Eduardo de Oliveira"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs"
                  />
                  {errors.nome && <p className="text-red-400 text-[10px] mt-1">{errors.nome}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      CPF <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.cpf}
                      onChange={(e) => handleCpfChange(e.target.value)}
                      placeholder="000.000.000-00"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-xs"
                    />
                    {errors.cpf && <p className="text-red-400 text-[10px] mt-1">{errors.cpf}</p>}
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      RG / Órgão Emissor <span className="text-slate-500 font-normal text-[10px]">(Opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.rg}
                      onChange={(e) => setFormData({ ...formData, rg: e.target.value })}
                      placeholder="Ex: MG-18.490.112 SSP/MG"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Telefone / WhatsApp <span className="text-slate-500 font-normal text-[10px]">(Opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.telefone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      placeholder="(11) 98765-4321"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Data de Nascimento <span className="text-slate-500 font-normal text-[10px]">(Opcional)</span>
                    </label>
                    <input
                      type="date"
                      value={formData.dataNascimento}
                      onChange={(e) => setFormData({ ...formData, dataNascimento: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs"
                    />
                  </div>
                </div>

                {/* Seção de Credenciais de Acesso ao Sistema */}
                <div className="pt-3 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-blue-400" />
                      <span>Credenciais de Acesso ao TurnoCerto</span>
                    </span>
                    <span className="text-[10px] text-slate-400">Login e senha do colaborador</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-slate-300 font-semibold text-xs">
                          E-mail para Login
                        </label>
                        {formData.nome && (
                          <button
                            type="button"
                            onClick={() => {
                              const cleanNome = formData.nome.toLowerCase().trim().replace(/\s+/g, '.');
                              setFormData({ ...formData, email: `${cleanNome}@turnocerto.com.br` });
                            }}
                            className="text-[10px] text-blue-400 hover:underline cursor-pointer"
                          >
                            Gerar e-mail
                          </button>
                        )}
                      </div>
                      <input
                        type="email"
                        value={formData.email || ''}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="Ex: colaborador@turnocerto.com.br"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs font-mono"
                      />
                    </div>

                    <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-500/30 flex items-start gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <div className="text-[11px] text-slate-300">
                        <strong className="text-white block">Acesso Seguro (Supabase Auth):</strong>
                        O acesso ao painel é gerenciado de forma criptografada pelo Supabase Auth. Nenhuma senha é armazenada em texto simples no banco de dados.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 2: Documentação Legal & eSocial */}
          {/* ========================================================================= */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-white text-xs flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    Documentação & Endereço
                  </p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 border border-emerald-500/20 font-medium">
                    Campos Opcionais
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Preencha o CEP para preencher a rua e bairro automaticamente. Você pode salvar agora e complementar depois.
                </p>
              </div>

              {/* Bloco de Endereço Inteligente com Busca Automática por CEP */}
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-blue-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-slate-200 font-bold text-xs flex items-center gap-1.5">
                    <span>📍 Endereço Residencial (Busca por CEP)</span>
                  </label>
                  <span className="text-[10px] text-slate-400">ViaCEP Automático</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="sm:col-span-1">
                    <label className="block text-slate-300 font-semibold mb-1 text-[11px]">
                      CEP
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={cep}
                        onChange={(e) => handleCepChange(e.target.value)}
                        placeholder="00000-000"
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-xs"
                      />
                      {isLoadingCep && (
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                          <span className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin inline-block" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-300 font-semibold mb-1 text-[11px]">
                      Logradouro / Rua (Automático)
                    </label>
                    <input
                      type="text"
                      value={logradouro}
                      onChange={(e) => {
                        setLogradouro(e.target.value);
                        updateComposedAddress(cep, e.target.value, numero, complemento, bairro, cidadeUf);
                      }}
                      placeholder="Preenchido ao digitar o CEP"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 text-xs"
                    />
                  </div>
                </div>

                {cepError && (
                  <p className="text-amber-400 text-[11px] bg-amber-950/30 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                    ⚠️ {cepError}
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1 text-[11px]">
                      Número da Casa / Apto
                    </label>
                    <input
                      type="text"
                      value={numero}
                      onChange={(e) => handleNumeroChange(e.target.value)}
                      placeholder="Ex: 1420 ou S/N"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1 text-[11px]">
                      Complemento (se houver)
                    </label>
                    <input
                      type="text"
                      value={complemento}
                      onChange={(e) => handleComplementoChange(e.target.value)}
                      placeholder="Ex: Bloco B Apto 42, Fundos"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs"
                    />
                  </div>
                </div>

                {(bairro || cidadeUf) && (
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                    <span>Bairro: <strong className="text-slate-300">{bairro || '-'}</strong></span>
                    <span>·</span>
                    <span>Cidade: <strong className="text-slate-300">{cidadeUf || '-'}</strong></span>
                  </div>
                )}

                <div>
                  <label className="block text-slate-400 font-normal mb-1 text-[10px]">
                    Endereço Completo Formatado (gravado no eSocial):
                  </label>
                  <textarea
                    rows={2}
                    value={formData.endereco}
                    onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                    placeholder="Endereço consolidado gerado automaticamente"
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-950/50 border border-slate-800 text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500 text-xs"
                  />
                </div>
              </div>

              {/* Documentação eSocial Opcional */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Número PIS/PASEP/NIT <span className="text-slate-500 font-normal text-[10px]">(Opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.pis}
                    onChange={(e) => handlePisChange(e.target.value)}
                    placeholder="123.45678.90-1"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    CTPS Digital (Nº / Série) <span className="text-slate-500 font-normal text-[10px]">(Opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.ctps}
                    onChange={(e) => setFormData({ ...formData, ctps: e.target.value })}
                    placeholder="Ex: CTPS 0049102 Série 001-SP"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Nome Completo da Mãe <span className="text-slate-500 font-normal text-[10px]">(Opcional)</span>
                </label>
                <input
                  type="text"
                  value={formData.nomeMae}
                  onChange={(e) => setFormData({ ...formData, nomeMae: e.target.value })}
                  placeholder="Ex: Maria das Graças de Oliveira"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs"
                />
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 3: Posto de Trabalho & Escala */}
          {/* ========================================================================= */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-white text-xs flex items-center gap-1.5">
                    <Building className="w-4 h-4 text-purple-400" />
                    Alocação Operacional e Jornada
                  </p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-purple-400 border border-purple-500/20 font-medium">
                    Campos Opcionais
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Defina o condomínio onde o colaborador prestará serviço ou deixe em branco para vincular automaticamente à Reserva Central.
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Condomínio / Unidade de Lotação <span className="text-slate-500 font-normal text-[10px]">(Opcional)</span>
                </label>
                <select
                  value={formData.condominioId}
                  onChange={(e) => setFormData({ ...formData, condominioId: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500 text-xs"
                >
                  <option value="">Matriz - Reserva Operacional / Volante</option>
                  {condominios.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} ({c.vagasContratadas} vagas contratadas · {c.bairro})
                    </option>
                  ))}
                </select>
              </div>

              {/* Status do Colaborador (quando editando) */}
              {isEditing && (
                <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                  <label className="block text-slate-300 font-semibold text-xs">
                    Status Operacional Atual no Posto
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(['no_posto', 'folga', 'falta', 'afastado'] as StatusColaborador[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setStatus(st)}
                        className={`p-2 rounded-xl text-xs font-semibold border transition-all ${
                          status === st
                            ? st === 'no_posto'
                              ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300 shadow-sm'
                              : st === 'folga'
                              ? 'bg-blue-600/30 border-blue-500 text-blue-300 shadow-sm'
                              : st === 'falta'
                              ? 'bg-red-600/30 border-red-500 text-red-300 shadow-sm'
                              : 'bg-purple-600/30 border-purple-500 text-purple-300 shadow-sm'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {st === 'no_posto' ? 'No Posto' : st === 'folga' ? 'Folga' : st === 'falta' ? 'Falta' : 'Afastado'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Cargo / Função <span className="text-slate-500 font-normal text-[10px]">(Padrão: Porteiro)</span>
                  </label>
                  <select
                    value={formData.cargo}
                    onChange={(e) =>
                      setFormData({ ...formData, cargo: e.target.value as FuncaoColaborador })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500 text-xs"
                  >
                    <option value="Porteiro">Porteiro</option>
                    <option value="Porteiro Líder">Porteiro Líder</option>
                    <option value="Controlador de Acesso">Controlador de Acesso</option>
                    <option value="Vigilante Patrimonial">Vigilante Patrimonial</option>
                    <option value="Auxiliar de Limpeza">Auxiliar de Limpeza</option>
                    <option value="Zelador">Zelador</option>
                    <option value="Supervisor Operacional">Supervisor Operacional</option>
                    <option value="Volante de Cobertura">Volante de Cobertura</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Regime de Escala <span className="text-slate-500 font-normal text-[10px]">(Padrão: 12x36)</span>
                  </label>
                  <select
                    value={formData.regimeEscala}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        regimeEscala: e.target.value as '12x36' | '6x1' | '5x2',
                      })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500 text-xs"
                  >
                    <option value="12x36">12x36 (Plantão 12h de trabalho por 36h de descanso)</option>
                    <option value="6x1">6x1 Comercial (6 dias trabalhados por 1 folga)</option>
                    <option value="5x2">5x2 Administrativo (Segunda a Sexta-feira)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Horário de Início</label>
                  <input
                    type="time"
                    value={formData.turnoInicio}
                    onChange={(e) => setFormData({ ...formData, turnoInicio: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Horário de Término</label>
                  <input
                    type="time"
                    value={formData.turnoFim}
                    onChange={(e) => setFormData({ ...formData, turnoFim: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Data de Admissão <span className="text-slate-500 font-normal text-[10px]">(Opcional)</span>
                  </label>
                  <input
                    type="date"
                    value={formData.dataAdmissao}
                    onChange={(e) => setFormData({ ...formData, dataAdmissao: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Salário Base (R$) <span className="text-slate-500 font-normal text-[10px]">(Opcional)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.salarioBase}
                    onChange={(e) => setFormData({ ...formData, salarioBase: parseFloat(e.target.value) || 0 })}
                    placeholder="2150.00"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 4: Dados Bancários, Pix & Holerite */}
          {/* ========================================================================= */}
          {currentStep === 4 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-white text-xs flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-emerald-400" />
                    Pagamento da Folha & Benefícios
                  </p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 border border-emerald-500/20 font-medium">
                    Campos Opcionais
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Dados para crédito salarial mensal e vales no Holerite RH. Pode ser preenchido ou ajustado a qualquer momento em Editar.
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Chave Pix <span className="text-slate-500 font-normal text-[10px]">(Opcional)</span>
                </label>
                <input
                  type="text"
                  value={formData.pix}
                  onChange={(e) => setFormData({ ...formData, pix: e.target.value })}
                  placeholder="CPF, E-mail, Celular ou Chave Aleatória"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Instituição Bancária</label>
                <select
                  value={formData.banco}
                  onChange={(e) => setFormData({ ...formData, banco: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500 text-xs"
                >
                  {BANCOS_BRASIL.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Agência</label>
                  <input
                    type="text"
                    value={formData.agencia}
                    onChange={(e) => setFormData({ ...formData, agencia: e.target.value })}
                    placeholder="Ex: 0142"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Conta (com dígito)</label>
                  <input
                    type="text"
                    value={formData.conta}
                    onChange={(e) => setFormData({ ...formData, conta: e.target.value })}
                    placeholder="Ex: 58241-9"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-xs"
                  />
                </div>
              </div>

              {/* Opção Vale Transporte */}
              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="font-semibold text-white block text-xs">
                    Opção de Vale Transporte (VT)
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Colaborador optante pelo benefício legal com desconto regulamentar de 6% no holerite.
                  </span>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={formData.recebeVT}
                    onChange={(e) => setFormData({ ...formData, recebeVT: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
                </label>
              </div>

              {/* Bloco de Benefícios e Adicionais: VR, VA (VL), Extra FT e Bônus */}
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-700/60 space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                  <span className="font-bold text-white text-xs flex items-center gap-1.5">
                    🍽️ Benefícios & Remuneração Variável
                  </span>
                  <span className="text-[10px] text-slate-400">Holerite RH & Ponto</span>
                </div>

                {/* Vale Refeição (VR) & Vale Alimentação (VA/VL) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Vale Refeição (VR) */}
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-200 font-semibold text-xs">Vale Refeição (VR)</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.recebeVR}
                          onChange={(e) => setFormData({ ...formData, recebeVR: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500" />
                      </label>
                    </div>
                    {formData.recebeVR && (
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">Valor por Turno / Dia (R$)</label>
                        <input
                          type="number"
                          step="0.50"
                          value={formData.valorVR}
                          onChange={(e) => setFormData({ ...formData, valorVR: parseFloat(e.target.value) || 0 })}
                          placeholder="28.50"
                          className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    )}
                  </div>

                  {/* Vale Alimentação (VA / VL) */}
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-200 font-semibold text-xs">Vale Alimentação (VA / VL)</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.recebeVA}
                          onChange={(e) => setFormData({ ...formData, recebeVA: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
                      </label>
                    </div>
                    {formData.recebeVA && (
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">Cesta Básica / Mensal (R$)</label>
                        <input
                          type="number"
                          step="10.00"
                          value={formData.valorVA}
                          onChange={(e) => setFormData({ ...formData, valorVA: parseFloat(e.target.value) || 0 })}
                          placeholder="220.00"
                          className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Extra (FT) e Bônus / Gratificação */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1 text-xs">
                      Valor do Plantão Extra / FT (R$)
                    </label>
                    <input
                      type="number"
                      step="10.00"
                      value={formData.valorExtraFT}
                      onChange={(e) => setFormData({ ...formData, valorExtraFT: parseFloat(e.target.value) || 0 })}
                      placeholder="160.00"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-xs"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Diária paga em caso de dobra ou cobertura de falta</span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-300 font-semibold text-xs">
                        Bônus / Assiduidade Integral (R$)
                      </label>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium">
                        Regra: Sem Faltas e Sem Atestados
                      </span>
                    </div>
                    <input
                      type="number"
                      step="50.00"
                      value={formData.valorBonus}
                      onChange={(e) => setFormData({ ...formData, valorBonus: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-xs"
                    />
                    <div className="mt-1 flex items-start gap-1.5 text-[10px] text-amber-400/90 bg-amber-950/20 border border-amber-500/20 p-2 rounded-lg">
                      <span className="shrink-0 font-bold">⚠️ Regra Automática:</span>
                      <span>
                        Se o colaborador registrar <strong>falta no turno</strong> ou possuir <strong>atestado médico</strong> no mês, o bônus será cancelado automaticamente e não será somado ao holerite líquido.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Resumo de Confirmação */}
              <div className="p-3 rounded-2xl bg-blue-950/20 border border-blue-500/30 text-[11px] text-blue-200 space-y-1">
                <span className="font-bold text-white block">Resumo do Cadastro:</span>
                <p>
                  • <strong>{formData.nome || 'Nome pendente'}</strong> — {formData.cargo}
                </p>
                <p>
                  • Salário Base: <strong>R$ {Number(formData.salarioBase || 0).toFixed(2)}</strong> ({formData.regimeEscala})
                </p>
                <p>
                  • Benefícios: {formData.recebeVT ? 'VT ' : ''}{formData.recebeVR ? `· VR (R$ ${Number(formData.valorVR || 0).toFixed(2)}/dia) ` : ''}{formData.recebeVA ? `· VA (R$ ${Number(formData.valorVA || 0).toFixed(2)}/mês) ` : ''}{Number(formData.valorExtraFT || 0) > 0 ? `· FT (R$ ${Number(formData.valorExtraFT || 0).toFixed(2)}) ` : ''}{Number(formData.valorBonus || 0) > 0 ? `· Bônus (R$ ${Number(formData.valorBonus || 0).toFixed(2)})` : ''}
                </p>
                <p>
                  • Lotação: <strong>{condominios.find((c) => c.id === formData.condominioId)?.nome || 'Reserva Técnica'}</strong>
                </p>
              </div>
            </div>
          )}

          {/* Footer Controls */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs flex items-center gap-1.5 transition-colors active:scale-95"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Voltar</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-medium text-xs transition-colors"
                >
                  Cancelar
                </button>
              )}

              {isEditing && (
                confirmDelete ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-2.5 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
                    >
                      Não
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleDelete}
                      className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                    >
                      Confirmar Exclusão
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/50 border border-red-500/30 text-red-400 hover:text-red-300 text-xs font-semibold transition-colors cursor-pointer"
                    title="Excluir Colaborador"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Excluir</span>
                  </button>
                )
              )}
            </div>

            {currentStep < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center gap-1.5 transition-all active:scale-95 ml-auto"
              >
                <span>Avançar</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-400 hover:to-blue-500 text-white font-bold text-xs shadow-xl shadow-emerald-600/25 flex items-center gap-2 transition-all active:scale-95 ml-auto disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Salvar & Cadastrar'}</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
