import { useState, useRef, useEffect } from 'react';
import {
  User,
  Phone,
  MapPin,
  Calendar,
  FileText,
  Upload,
  AlertCircle,
  Loader2,
  CheckCircle2,
  XCircle,
  Copy,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// ── Masks ──────────────────────────────────────────────────────────────────
function maskCPF(v: string) {
  return v
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function maskCEP(v: string) {
  return v
    .replace(/\D/g, '')
    .slice(0, 8)
    .replace(/(\d{5})(\d)/, '$1-$2');
}

function maskPhone(v: string) {
  return v
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

// ── CPF Validation ─────────────────────────────────────────────────────────
function validateCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += parseInt(digits[i]) * (len + 1 - i);
    const rem = (sum * 10) % 11;
    return rem === 10 || rem === 11 ? 0 : rem;
  };
  return calc(9) === parseInt(digits[9]) && calc(10) === parseInt(digits[10]);
}

// ── Types ──────────────────────────────────────────────────────────────────
interface Endereco {
  cep: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  complemento: string;
}

interface FormData {
  nomeResponsavel: string;
  cpfResponsavel: string;
  celularResponsavel: string;
  enderecoResponsavel: Endereco;
  nomeAluno: string;
  dataNascimento: string;
  cpfAluno: string;
  primeiraEscola: boolean;
  ultimaSerie: string;
  nomeEscolaAnterior: string;
  enderecoAluno: Endereco;
  nomePai: string;
  cpfPai: string;
  celularPai: string;
  nomeMae: string;
  cpfMae: string;
  celularMae: string;
  documentos: File[];
}

type Errors = Partial<Record<string, string>>;

const emptyEndereco = (): Endereco => ({
  cep: '', rua: '', numero: '', bairro: '', cidade: '', estado: '', complemento: '',
});

function calcAge(birthDate: string): number {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

const GRADES = [
  { group: 'Ensino Infantil', options: ['Maternal I', 'Maternal II', 'Jardim I', 'Jardim II'] },
  { group: 'Fundamental I',   options: ['1º ano', '2º ano', '3º ano', '4º ano', '5º ano'] },
  { group: 'Fundamental II',  options: ['6º ano', '7º ano', '8º ano', '9º ano'] },
  { group: 'Ensino Médio',    options: ['1º ano ', '2º ano ', '3º ano '] },
] as const;

// Séries a partir das quais "nome da escola anterior" aparece
const SHOW_PREV_SCHOOL_FROM = new Set([
  'Maternal II', 'Jardim I', 'Jardim II',
  '1º ano', '2º ano', '3º ano', '4º ano', '5º ano',
  '6º ano', '7º ano', '8º ano', '9º ano',
  '1º ano ', '2º ano ', '3º ano ',
]);

// ── Helpers ────────────────────────────────────────────────────────────────
function inputCls(hasIcon: boolean, error?: string) {
  return [
    'w-full py-3 pr-4 rounded-lg border text-sm transition-colors',
    hasIcon ? 'pl-10' : 'pl-3',
    error
      ? 'border-red-400 focus:ring-red-300 bg-red-50'
      : 'border-gray-200 focus:ring-[#003876] bg-white',
    'focus:outline-none focus:ring-2 focus:border-transparent',
  ].join(' ');
}

// ── Field Wrapper ──────────────────────────────────────────────────────────
function Field({
  label, required, error, icon: Icon, children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none z-10" />
        )}
        {children}
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
          <XCircle className="w-3 h-3" /> {error}
        </p>
      )}
    </div>
  );
}

// ── Address Block (defined OUTSIDE Matricula to preserve focus) ────────────
interface AddressBlockProps {
  end: Endereco;
  endKey: 'enderecoResponsavel' | 'enderecoAluno';
  errors: Errors;
  isLoading: boolean;
  cepOk: boolean | undefined;
  onCEPChange: (value: string) => void;
  onFieldChange: (field: keyof Endereco, value: string) => void;
}

function AddressBlock({
  end, endKey, errors, isLoading, cepOk, onCEPChange, onFieldChange,
}: AddressBlockProps) {
  const numeroRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cepOk === true) numeroRef.current?.focus();
  }, [cepOk]);

  return (
    <div className="space-y-4">
      <Field label="CEP" required icon={MapPin} error={errors[`${endKey}.cep`]}>
        <input
          type="text"
          inputMode="numeric"
          placeholder="00000-000"
          maxLength={9}
          className={inputCls(true, errors[`${endKey}.cep`])}
          value={end.cep}
          onChange={(e) => onCEPChange(e.target.value)}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading && <Loader2 className="w-4 h-4 text-[#003876] animate-spin" />}
          {!isLoading && cepOk === true && <CheckCircle2 className="w-4 h-4 text-green-500" />}
          {!isLoading && cepOk === false && <XCircle className="w-4 h-4 text-red-500" />}
        </span>
      </Field>

      <Field label="Rua / Logradouro" required error={errors[`${endKey}.rua`]}>
        <input
          type="text"
          className={inputCls(false, errors[`${endKey}.rua`])}
          value={end.rua}
          onChange={(e) => onFieldChange('rua', e.target.value)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Número" required error={errors[`${endKey}.numero`]}>
          <input
            ref={numeroRef}
            type="text"
            placeholder="Ex: 99"
            className={inputCls(false, errors[`${endKey}.numero`])}
            value={end.numero}
            onChange={(e) => onFieldChange('numero', e.target.value)}
          />
        </Field>
        <Field label="Complemento">
          <input
            type="text"
            placeholder="Apto, bloco... (opcional)"
            className={inputCls(false)}
            value={end.complemento}
            onChange={(e) => onFieldChange('complemento', e.target.value)}
          />
        </Field>
      </div>

      <Field label="Bairro" required error={errors[`${endKey}.bairro`]}>
        <input
          type="text"
          className={inputCls(false, errors[`${endKey}.bairro`])}
          value={end.bairro}
          onChange={(e) => onFieldChange('bairro', e.target.value)}
        />
      </Field>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <Field label="Cidade" required error={errors[`${endKey}.cidade`]}>
            <input
              type="text"
              className={inputCls(false, errors[`${endKey}.cidade`])}
              value={end.cidade}
              onChange={(e) => onFieldChange('cidade', e.target.value)}
            />
          </Field>
        </div>
        <Field label="Estado" required error={errors[`${endKey}.estado`]}>
          <input
            type="text"
            maxLength={2}
            placeholder="UF"
            className={inputCls(false, errors[`${endKey}.estado`])}
            value={end.estado}
            onChange={(e) => onFieldChange('estado', e.target.value.toUpperCase())}
          />
        </Field>
      </div>
    </div>
  );
}

// ── CPF Parent Field (defined OUTSIDE Matricula to preserve focus) ─────────
interface CPFParentFieldProps {
  parent: 'mae' | 'pai';
  nomeValue: string;
  cpfValue: string;
  celularValue: string;
  nomeError?: string;
  cpfError?: string;
  celularError?: string;
  onNomeChange: (v: string) => void;
  onCpfChange: (v: string) => void;
  onCpfBlur: () => void;
  onCelularChange: (v: string) => void;
  onUsarResponsavel: () => void;
}

function CPFParentField({
  parent, nomeValue, cpfValue, celularValue,
  nomeError, cpfError, celularError,
  onNomeChange, onCpfChange, onCpfBlur, onCelularChange, onUsarResponsavel,
}: CPFParentFieldProps) {
  const label = parent === 'mae' ? 'Mãe' : 'Pai';
  const artigo = parent === 'mae' ? 'a' : 'o';

  return (
    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-[#003876]">{label}</span>
        <button
          type="button"
          onClick={onUsarResponsavel}
          className="inline-flex items-center gap-1.5 text-xs text-[#003876] border border-[#003876]/30 bg-white px-3 py-1 rounded-full hover:bg-[#003876] hover:text-white transition-colors"
        >
          <Copy className="w-3 h-3" /> Usar dados do responsável
        </button>
      </div>

      <Field label={`Nome completo d${artigo} ${label}`} required error={nomeError}>
        <input
          type="text"
          className={inputCls(false, nomeError)}
          value={nomeValue}
          onChange={(e) => onNomeChange(e.target.value)}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label={`CPF d${artigo} ${label}`} required icon={FileText} error={cpfError}>
          <input
            type="text"
            inputMode="numeric"
            placeholder="000.000.000-00"
            maxLength={14}
            className={inputCls(true, cpfError)}
            value={cpfValue}
            onChange={(e) => onCpfChange(maskCPF(e.target.value))}
            onBlur={onCpfBlur}
          />
        </Field>

        <Field label={`Celular d${artigo} ${label}`} required icon={Phone} error={celularError}>
          <input
            type="text"
            inputMode="numeric"
            placeholder="(00) 00000-0000"
            maxLength={15}
            className={inputCls(true, celularError)}
            value={celularValue}
            onChange={(e) => onCelularChange(maskPhone(e.target.value))}
          />
        </Field>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function Matricula() {
  const [activeTab, setActiveTab] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [cepLoading, setCepLoading] = useState<'responsavel' | 'aluno' | null>(null);
  const [cepStatus, setCepStatus] = useState<{ responsavel?: boolean; aluno?: boolean }>({});
  const [responsavelUsedBy, setResponsavelUsedBy] = useState<'mae' | 'pai' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<'success' | 'error' | null>(null);

  const [formData, setFormData] = useState<FormData>({
    nomeResponsavel: '',
    cpfResponsavel: '',
    celularResponsavel: '',
    enderecoResponsavel: emptyEndereco(),
    nomeAluno: '',
    dataNascimento: '',
    cpfAluno: '',
    primeiraEscola: false,
    ultimaSerie: '',
    nomeEscolaAnterior: '',
    enderecoAluno: emptyEndereco(),
    nomePai: '',
    cpfPai: '',
    celularPai: '',
    nomeMae: '',
    cpfMae: '',
    celularMae: '',
    documentos: [],
  });

  const setField = (name: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((e) => ({ ...e, [name]: undefined }));
  };

  const setEndereco = (
    prefix: 'enderecoResponsavel' | 'enderecoAluno',
    field: keyof Endereco,
    value: string,
  ) => {
    setFormData((prev) => ({ ...prev, [prefix]: { ...prev[prefix], [field]: value } }));
    setErrors((e) => ({ ...e, [`${prefix}.${field}`]: undefined }));
  };

  const buscarCEP = async (cep: string, prefix: 'responsavel' | 'aluno') => {
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) return;
    const endKey = prefix === 'responsavel' ? 'enderecoResponsavel' : 'enderecoAluno';
    setCepLoading(prefix);
    setCepStatus((s) => ({ ...s, [prefix]: undefined }));
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data.erro) {
        setCepStatus((s) => ({ ...s, [prefix]: false }));
        setErrors((e) => ({ ...e, [`${endKey}.cep`]: 'CEP não encontrado' }));
      } else {
        setFormData((prev) => ({
          ...prev,
          [endKey]: {
            ...prev[endKey],
            cep,
            rua: data.logradouro || '',
            bairro: data.bairro || '',
            cidade: data.localidade || '',
            estado: data.uf || '',
          },
        }));
        setCepStatus((s) => ({ ...s, [prefix]: true }));
        setErrors((e) => ({ ...e, [`${endKey}.cep`]: undefined }));
      }
    } catch {
      setCepStatus((s) => ({ ...s, [prefix]: false }));
      setErrors((e) => ({ ...e, [`${endKey}.cep`]: 'Erro ao consultar CEP' }));
    } finally {
      setCepLoading(null);
    }
  };

  const handleCEPChange = (value: string, prefix: 'responsavel' | 'aluno') => {
    const masked = maskCEP(value);
    const endKey = prefix === 'responsavel' ? 'enderecoResponsavel' : 'enderecoAluno';
    setEndereco(endKey, 'cep', masked);
    setCepStatus((s) => ({ ...s, [prefix]: undefined }));
    if (masked.replace(/\D/g, '').length === 8) buscarCEP(masked, prefix);
  };

  const validateTab0 = (): boolean => {
    const errs: Errors = {};
    if (!formData.nomeResponsavel.trim()) errs.nomeResponsavel = 'Nome obrigatório';
    if (!formData.cpfResponsavel.trim()) errs.cpfResponsavel = 'CPF obrigatório';
    else if (!validateCPF(formData.cpfResponsavel)) errs.cpfResponsavel = 'CPF inválido';
    if (!formData.celularResponsavel.trim()) errs.celularResponsavel = 'Celular obrigatório';
    else if (formData.celularResponsavel.replace(/\D/g, '').length < 11)
      errs.celularResponsavel = 'Celular incompleto (DDD + 9 dígitos)';
    const end = formData.enderecoResponsavel;
    if (!end.cep.trim() || end.cep.replace(/\D/g, '').length < 8)
      errs['enderecoResponsavel.cep'] = 'CEP obrigatório';
    if (!end.rua.trim()) errs['enderecoResponsavel.rua'] = 'Rua obrigatória';
    if (!end.numero.trim()) errs['enderecoResponsavel.numero'] = 'Número obrigatório';
    if (!end.bairro.trim()) errs['enderecoResponsavel.bairro'] = 'Bairro obrigatório';
    if (!end.cidade.trim()) errs['enderecoResponsavel.cidade'] = 'Cidade obrigatória';
    if (!end.estado.trim()) errs['enderecoResponsavel.estado'] = 'Estado obrigatório';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateTab1 = (): boolean => {
    const errs: Errors = {};
    if (!formData.nomeAluno.trim()) errs.nomeAluno = 'Nome obrigatório';
    if (!formData.dataNascimento) errs.dataNascimento = 'Data de nascimento obrigatória';
    if (!formData.primeiraEscola && !formData.ultimaSerie) errs.ultimaSerie = 'Selecione a última série cursada';
    if (!formData.primeiraEscola && SHOW_PREV_SCHOOL_FROM.has(formData.ultimaSerie) && !formData.nomeEscolaAnterior.trim())
      errs.nomeEscolaAnterior = 'Nome da escola anterior obrigatório';
    if (formData.cpfAluno.trim() && !validateCPF(formData.cpfAluno))
      errs.cpfAluno = 'CPF inválido';
    const end = formData.enderecoAluno;
    if (!end.cep.trim() || end.cep.replace(/\D/g, '').length < 8)
      errs['enderecoAluno.cep'] = 'CEP obrigatório';
    if (!end.rua.trim()) errs['enderecoAluno.rua'] = 'Rua obrigatória';
    if (!end.numero.trim()) errs['enderecoAluno.numero'] = 'Número obrigatório';
    if (!end.bairro.trim()) errs['enderecoAluno.bairro'] = 'Bairro obrigatório';
    if (!end.cidade.trim()) errs['enderecoAluno.cidade'] = 'Cidade obrigatória';
    if (!end.estado.trim()) errs['enderecoAluno.estado'] = 'Estado obrigatório';
    if (!formData.nomeMae.trim()) errs.nomeMae = 'Nome da mãe obrigatório';
    if (!formData.cpfMae.trim()) errs.cpfMae = 'CPF da mãe obrigatório';
    else if (!validateCPF(formData.cpfMae)) errs.cpfMae = 'CPF inválido';
    if (!formData.celularMae.trim()) errs.celularMae = 'Celular obrigatório';
    else if (formData.celularMae.replace(/\D/g, '').length < 11) errs.celularMae = 'Celular incompleto';
    if (!formData.nomePai.trim()) errs.nomePai = 'Nome do pai obrigatório';
    if (!formData.cpfPai.trim()) errs.cpfPai = 'CPF do pai obrigatório';
    else if (!validateCPF(formData.cpfPai)) errs.cpfPai = 'CPF inválido';
    if (!formData.celularPai.trim()) errs.celularPai = 'Celular obrigatório';
    else if (formData.celularPai.replace(/\D/g, '').length < 11) errs.celularPai = 'Celular incompleto';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (activeTab === 0 && !validateTab0()) return;
    if (activeTab === 1 && !validateTab1()) return;
    setActiveTab((t) => t + 1);
  };

  const usarDadosResponsavel = (parent: 'mae' | 'pai') => {
    const cpfField = parent === 'mae' ? 'cpfMae' : 'cpfPai';
    const nomeField = parent === 'mae' ? 'nomeMae' : 'nomePai';
    const other = parent === 'mae' ? 'pai' : 'mae';
    const otherCpf = other === 'mae' ? 'cpfMae' : 'cpfPai';
    const otherNome = other === 'mae' ? 'nomeMae' : 'nomePai';

    const celularField = parent === 'mae' ? 'celularMae' : 'celularPai';
    const otherCelular = other === 'mae' ? 'celularMae' : 'celularPai';

    setFormData((prev) => {
      const next = {
        ...prev,
        [nomeField]:    prev.nomeResponsavel,
        [cpfField]:     prev.cpfResponsavel,
        [celularField]: prev.celularResponsavel,
      };
      if (responsavelUsedBy === other) {
        next[otherNome]    = '';
        next[otherCpf]     = '';
        next[otherCelular] = '';
      }
      return next;
    });
    setErrors((e) => ({ ...e, [cpfField]: undefined, [nomeField]: undefined, [celularField]: undefined }));
    setResponsavelUsedBy(parent);
  };

  const usarEnderecoResponsavel = () => {
    setFormData((prev) => ({
      ...prev,
      enderecoAluno: { ...prev.enderecoResponsavel },
    }));
    setCepStatus((s) => ({ ...s, aluno: s.responsavel }));
    setErrors((e) => {
      const next = { ...e };
      (['cep', 'rua', 'numero', 'bairro', 'cidade', 'estado'] as const).forEach((f) => {
        delete next[`enderecoAluno.${f}`];
      });
      return next;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(
      (f) =>
        ['image/jpeg', 'image/png', 'application/pdf'].includes(f.type) &&
        f.size <= 5 * 1024 * 1024,
    );
    setFormData((prev) => ({ ...prev, documentos: [...prev.documentos, ...files] }));
  };

  const removeFile = (i: number) =>
    setFormData((prev) => ({
      ...prev,
      documentos: prev.documentos.filter((_, idx) => idx !== i),
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateTab1()) { setActiveTab(1); return; }

    setSubmitting(true);
    setSubmitResult(null);

    try {
      // 1. Inserir matrícula
      const { data: enrollment, error: enrollmentError } = await supabase
        .from('enrollments')
        .insert({
          guardian_name:         formData.nomeResponsavel,
          guardian_cpf:          formData.cpfResponsavel,
          guardian_phone:        formData.celularResponsavel,
          guardian_zip_code:     formData.enderecoResponsavel.cep,
          guardian_street:       formData.enderecoResponsavel.rua,
          guardian_number:       formData.enderecoResponsavel.numero,
          guardian_complement:   formData.enderecoResponsavel.complemento || null,
          guardian_neighborhood: formData.enderecoResponsavel.bairro,
          guardian_city:         formData.enderecoResponsavel.cidade,
          guardian_state:        formData.enderecoResponsavel.estado,
          student_name:          formData.nomeAluno,
          student_birth_date:    formData.dataNascimento,
          student_cpf:           formData.cpfAluno || null,
          first_school:          formData.primeiraEscola,
          last_grade:            formData.primeiraEscola ? null : (formData.ultimaSerie || null),
          previous_school_name:  formData.primeiraEscola ? null : (formData.nomeEscolaAnterior || null),
          student_zip_code:      formData.enderecoAluno.cep,
          student_street:        formData.enderecoAluno.rua,
          student_number:        formData.enderecoAluno.numero,
          student_complement:    formData.enderecoAluno.complemento || null,
          student_neighborhood:  formData.enderecoAluno.bairro,
          student_city:          formData.enderecoAluno.cidade,
          student_state:         formData.enderecoAluno.estado,
          father_name:           formData.nomePai,
          father_cpf:            formData.cpfPai,
          father_phone:          formData.celularPai,
          mother_name:           formData.nomeMae,
          mother_cpf:            formData.cpfMae,
          mother_phone:          formData.celularMae,
        })
        .select('id')
        .single();

      if (enrollmentError) throw enrollmentError;

      // 2. Upload de documentos
      for (const file of formData.documentos) {
        const storagePath = `${enrollment.id}/${Date.now()}_${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from('enrollment-documents')
          .upload(storagePath, file, { contentType: file.type });

        if (uploadError) throw uploadError;

        const { error: docError } = await supabase
          .from('enrollment_documents')
          .insert({
            enrollment_id: enrollment.id,
            file_name:     file.name,
            storage_path:  storagePath,
            mime_type:     file.type,
            file_size:     file.size,
          });

        if (docError) throw docError;
      }

      setSubmitResult('success');
    } catch (err) {
      console.error('Erro ao enviar matrícula:', err);
      setSubmitResult('error');
    } finally {
      setSubmitting(false);
    }
  };

  const tabs = ['Dados do Responsável', 'Dados do Aluno', 'Documentação'];

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold text-[#003876] mb-3">Matrícula 2026</h1>
            <p className="text-gray-500 mb-6">
              A inscrição deve ser feita por um responsável legal do estudante.
            </p>
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-sm text-left">
              <p className="font-semibold mb-2 flex items-center gap-2 text-[#003876]">
                <AlertCircle className="w-4 h-4" /> Tenha em mãos:
              </p>
              <ul className="list-disc list-inside space-y-1 text-gray-600">
                <li>Certidão de Nascimento do candidato</li>
                <li>Declaração de Escolaridade da escola de origem</li>
                <li>Cópia do Boletim Final e Parcial</li>
              </ul>
              <p className="mt-3 text-xs text-gray-400">
                Arquivos: JPG, PNG, PDF — máx. 5 MB por arquivo
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex mb-8 bg-white rounded-xl shadow-sm overflow-hidden">
            {tabs.map((tab, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { if (i < activeTab) setActiveTab(i); }}
                className={[
                  'flex-1 py-4 text-sm font-medium transition-all relative',
                  activeTab === i ? 'text-[#003876] bg-white' :
                  i < activeTab ? 'text-gray-400 hover:text-gray-600 cursor-pointer' :
                  'text-gray-300 cursor-default',
                ].join(' ')}
              >
                <span className="flex items-center justify-center gap-2">
                  <span className={[
                    'w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold',
                    activeTab === i ? 'bg-[#003876] text-white' :
                    i < activeTab ? 'bg-green-500 text-white' :
                    'bg-gray-200 text-gray-400',
                  ].join(' ')}>
                    {i < activeTab ? '✓' : i + 1}
                  </span>
                  <span className="hidden sm:inline">{tab}</span>
                </span>
                <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${activeTab === i ? 'bg-[#003876]' : 'bg-transparent'}`} />
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-8">

            {/* ── Tab 0: Responsável ── */}
            <div className={activeTab === 0 ? 'block' : 'hidden'}>
              <h2 className="text-lg font-bold text-[#003876] mb-6 pb-2 border-b border-gray-100">
                Dados do Responsável
              </h2>
              <div className="space-y-5">
                <Field label="Nome completo" required icon={User} error={errors.nomeResponsavel}>
                  <input
                    type="text"
                    placeholder="Nome completo do responsável"
                    className={inputCls(true, errors.nomeResponsavel)}
                    value={formData.nomeResponsavel}
                    onChange={(e) => setField('nomeResponsavel', e.target.value)}
                  />
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Field label="CPF" required icon={FileText} error={errors.cpfResponsavel}>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="000.000.000-00"
                      maxLength={14}
                      className={inputCls(true, errors.cpfResponsavel)}
                      value={formData.cpfResponsavel}
                      onChange={(e) => setField('cpfResponsavel', maskCPF(e.target.value))}
                      onBlur={() => {
                        if (formData.cpfResponsavel && !validateCPF(formData.cpfResponsavel))
                          setErrors((e) => ({ ...e, cpfResponsavel: 'CPF inválido' }));
                      }}
                    />
                  </Field>

                  <Field label="Celular" required icon={Phone} error={errors.celularResponsavel}>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="(00) 00000-0000"
                      maxLength={15}
                      className={inputCls(true, errors.celularResponsavel)}
                      value={formData.celularResponsavel}
                      onChange={(e) => setField('celularResponsavel', maskPhone(e.target.value))}
                    />
                  </Field>
                </div>

                <div className="pt-2">
                  <p className="text-sm font-semibold text-[#003876] mb-3">Endereço</p>
                  <AddressBlock
                    end={formData.enderecoResponsavel}
                    endKey="enderecoResponsavel"
                    errors={errors}
                    isLoading={cepLoading === 'responsavel'}
                    cepOk={cepStatus.responsavel}
                    onCEPChange={(v) => handleCEPChange(v, 'responsavel')}
                    onFieldChange={(field, value) => setEndereco('enderecoResponsavel', field, value)}
                  />
                </div>
              </div>
            </div>

            {/* ── Tab 1: Aluno ── */}
            <div className={activeTab === 1 ? 'block' : 'hidden'}>
              <h2 className="text-lg font-bold text-[#003876] mb-6 pb-2 border-b border-gray-100">
                Dados do Aluno
              </h2>
              <div className="space-y-5">
                <Field label="Nome completo do aluno" required icon={User} error={errors.nomeAluno}>
                  <input
                    type="text"
                    placeholder="Nome completo"
                    className={inputCls(true, errors.nomeAluno)}
                    value={formData.nomeAluno}
                    onChange={(e) => setField('nomeAluno', e.target.value)}
                  />
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Field label="Data de Nascimento" required icon={Calendar} error={errors.dataNascimento}>
                    <input
                      type="date"
                      className={inputCls(true, errors.dataNascimento)}
                      value={formData.dataNascimento}
                      onChange={(e) => setField('dataNascimento', e.target.value)}
                    />
                  </Field>

                  <Field label="CPF do aluno (se houver)" icon={FileText} error={errors.cpfAluno}>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="000.000.000-00"
                      maxLength={14}
                      className={inputCls(true, errors.cpfAluno)}
                      value={formData.cpfAluno}
                      onChange={(e) => setField('cpfAluno', maskCPF(e.target.value))}
                      onBlur={() => {
                        if (formData.cpfAluno && !validateCPF(formData.cpfAluno))
                          setErrors((e) => ({ ...e, cpfAluno: 'CPF inválido' }));
                      }}
                    />
                  </Field>
                </div>

                {/* ── Dados Educacionais ── */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-4">
                  <p className="text-sm font-semibold text-[#003876]">Dados Educacionais</p>

                  {/* Toggle primeira escola */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Primeira escola da criança</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (!formData.primeiraEscola) {
                          // tentando ativar
                          if (!formData.dataNascimento) {
                            setErrors((e) => ({ ...e, primeiraEscola: 'Preencha a data de nascimento antes de continuar' }));
                            return;
                          }
                          if (calcAge(formData.dataNascimento) < 2) {
                            setErrors((e) => ({ ...e, primeiraEscola: 'A criança precisa ter pelo menos 2 anos completos para se matricular' }));
                            return;
                          }
                          setFormData((p) => ({ ...p, primeiraEscola: true, ultimaSerie: '', nomeEscolaAnterior: '' }));
                          setErrors((e) => ({ ...e, primeiraEscola: undefined, ultimaSerie: undefined, nomeEscolaAnterior: undefined }));
                        } else {
                          setFormData((p) => ({ ...p, primeiraEscola: false }));
                          setErrors((e) => ({ ...e, primeiraEscola: undefined }));
                        }
                      }}
                      className={[
                        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none',
                        formData.primeiraEscola ? 'bg-[#003876]' : 'bg-gray-200',
                      ].join(' ')}
                      role="switch"
                      aria-checked={formData.primeiraEscola}
                    >
                      <span
                        className={[
                          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform',
                          formData.primeiraEscola ? 'translate-x-5' : 'translate-x-0',
                        ].join(' ')}
                      />
                    </button>
                  </div>
                  {errors.primeiraEscola && (
                    <p className="text-xs text-red-500 flex items-center gap-1 -mt-2">
                      <XCircle className="w-3 h-3" /> {errors.primeiraEscola}
                    </p>
                  )}

                  {/* Série + escola anterior */}
                  {!formData.primeiraEscola && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Última série completa" required error={errors.ultimaSerie}>
                        <select
                          className={inputCls(false, errors.ultimaSerie) + ' cursor-pointer'}
                          value={formData.ultimaSerie}
                          onChange={(e) => {
                            setFormData((p) => ({ ...p, ultimaSerie: e.target.value, nomeEscolaAnterior: '' }));
                            setErrors((ev) => ({ ...ev, ultimaSerie: undefined, nomeEscolaAnterior: undefined }));
                          }}
                        >
                          <option value="">Selecione...</option>
                          {GRADES.map(({ group, options }) => (
                            <optgroup key={group} label={group}>
                              {options.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </Field>

                      {SHOW_PREV_SCHOOL_FROM.has(formData.ultimaSerie) && (
                        <Field label="Nome da escola anterior" required error={errors.nomeEscolaAnterior}>
                          <input
                            type="text"
                            placeholder="Ex: Escola Municipal..."
                            className={inputCls(false, errors.nomeEscolaAnterior)}
                            value={formData.nomeEscolaAnterior}
                            onChange={(e) => {
                              setFormData((p) => ({ ...p, nomeEscolaAnterior: e.target.value }));
                              setErrors((ev) => ({ ...ev, nomeEscolaAnterior: undefined }));
                            }}
                          />
                        </Field>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-[#003876]">Endereço do Aluno</p>
                    <button
                      type="button"
                      onClick={usarEnderecoResponsavel}
                      className="inline-flex items-center gap-1.5 text-xs text-[#003876] border border-[#003876]/30 bg-white px-3 py-1 rounded-full hover:bg-[#003876] hover:text-white transition-colors"
                    >
                      <Copy className="w-3 h-3" /> Usar endereço do responsável
                    </button>
                  </div>
                  <AddressBlock
                    end={formData.enderecoAluno}
                    endKey="enderecoAluno"
                    errors={errors}
                    isLoading={cepLoading === 'aluno'}
                    cepOk={cepStatus.aluno}
                    onCEPChange={(v) => handleCEPChange(v, 'aluno')}
                    onFieldChange={(field, value) => setEndereco('enderecoAluno', field, value)}
                  />
                </div>

                <div className="pt-4">
                  <p className="text-sm font-semibold text-[#003876] mb-3">Dados dos Pais</p>
                  <div className="space-y-4">
                    <CPFParentField
                      parent="mae"
                      nomeValue={formData.nomeMae}
                      cpfValue={formData.cpfMae}
                      celularValue={formData.celularMae}
                      nomeError={errors.nomeMae}
                      cpfError={errors.cpfMae}
                      celularError={errors.celularMae}
                      onNomeChange={(v) => { setFormData((p) => ({ ...p, nomeMae: v })); setErrors((e) => ({ ...e, nomeMae: undefined })); }}
                      onCpfChange={(v) => { setFormData((p) => ({ ...p, cpfMae: v })); setErrors((e) => ({ ...e, cpfMae: undefined })); }}
                      onCpfBlur={() => { if (formData.cpfMae && !validateCPF(formData.cpfMae)) setErrors((e) => ({ ...e, cpfMae: 'CPF inválido' })); }}
                      onCelularChange={(v) => { setFormData((p) => ({ ...p, celularMae: v })); setErrors((e) => ({ ...e, celularMae: undefined })); }}
                      onUsarResponsavel={() => usarDadosResponsavel('mae')}
                    />
                    <CPFParentField
                      parent="pai"
                      nomeValue={formData.nomePai}
                      cpfValue={formData.cpfPai}
                      celularValue={formData.celularPai}
                      nomeError={errors.nomePai}
                      cpfError={errors.cpfPai}
                      celularError={errors.celularPai}
                      onNomeChange={(v) => { setFormData((p) => ({ ...p, nomePai: v })); setErrors((e) => ({ ...e, nomePai: undefined })); }}
                      onCpfChange={(v) => { setFormData((p) => ({ ...p, cpfPai: v })); setErrors((e) => ({ ...e, cpfPai: undefined })); }}
                      onCpfBlur={() => { if (formData.cpfPai && !validateCPF(formData.cpfPai)) setErrors((e) => ({ ...e, cpfPai: 'CPF inválido' })); }}
                      onCelularChange={(v) => { setFormData((p) => ({ ...p, celularPai: v })); setErrors((e) => ({ ...e, celularPai: undefined })); }}
                      onUsarResponsavel={() => usarDadosResponsavel('pai')}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Tab 2: Documentação ── */}
            <div className={activeTab === 2 ? 'block' : 'hidden'}>
              <h2 className="text-lg font-bold text-[#003876] mb-6 pb-2 border-b border-gray-100">
                Documentação
              </h2>
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-[#003876] mt-0.5 shrink-0" />
                  <div className="text-sm text-[#003876]">
                    <p className="font-semibold mb-2">Documentos necessários:</p>
                    <ul className="list-disc list-inside space-y-1 text-gray-600">
                      <li>Certidão de Nascimento do Aluno</li>
                      <li>Declaração provisória ou histórico escolar</li>
                      <li>RG do responsável</li>
                    </ul>
                  </div>
                </div>

                <label className="block border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-[#003876]/40 hover:bg-gray-50 transition-colors">
                  <Upload className="mx-auto h-10 w-10 text-gray-300 mb-3" />
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    Clique ou arraste arquivos aqui
                  </p>
                  <p className="text-xs text-gray-400">JPG, PNG, PDF — máx. 5 MB</p>
                  <input type="file" className="sr-only" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} />
                </label>

                {formData.documentos.length > 0 && (
                  <ul className="space-y-2">
                    {formData.documentos.map((file, i) => (
                      <li key={i} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-4 py-2">
                        <span className="flex items-center gap-2 text-gray-700">
                          <FileText className="w-4 h-4 text-gray-400" />
                          {file.name}
                        </span>
                        <button type="button" onClick={() => removeFile(i)} className="text-red-400 hover:text-red-600 transition-colors ml-4">
                          <XCircle className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Submit feedback */}
            {submitResult === 'success' && (
              <div className="mt-6 flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Inscrição enviada com sucesso!</p>
                  <p className="mt-0.5 text-green-700">Em breve nossa equipe entrará em contato pelo celular informado.</p>
                </div>
              </div>
            )}
            {submitResult === 'error' && (
              <div className="mt-6 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
                <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Erro ao enviar a inscrição.</p>
                  <p className="mt-0.5 text-red-700">Verifique sua conexão e tente novamente.</p>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="mt-8 flex justify-between items-center pt-6 border-t border-gray-100">
              {activeTab > 0 ? (
                <button type="button" onClick={() => setActiveTab((t) => t - 1)} className="text-sm text-gray-500 hover:text-[#003876] transition-colors font-medium">
                  ← Voltar
                </button>
              ) : <span />}

              {activeTab < tabs.length - 1 ? (
                <button type="button" onClick={handleNext} className="bg-[#003876] text-white px-8 py-3 rounded-xl font-semibold hover:bg-[#002855] transition-colors">
                  Próximo →
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={submitting || submitResult === 'success'}
                  className="bg-[#ffd700] text-[#003876] px-8 py-3 rounded-xl font-bold hover:bg-[#ffe44d] transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                  ) : (
                    <>Enviar Inscrição <FileText className="w-4 h-4" /></>
                  )}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
