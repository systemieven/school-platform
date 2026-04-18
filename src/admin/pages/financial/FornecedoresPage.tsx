/**
 * FornecedoresPage — Módulo de Fornecedores (Fase 14.E)
 *
 * Listagem com filtros + drawer de cadastro/edição completo.
 * Integrado com contas bancárias (N:1) e verificação de duplicidade por CNPJ/CPF.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { useCepLookup } from '../../hooks/useCepLookup';
import { Drawer, DrawerCard } from '../../components/Drawer';
import PermissionGate from '../../components/PermissionGate';
import {
  Building2, Plus, Search, Loader2, Check, Pencil, Trash2,
  AlertTriangle, Phone, MapPin, CreditCard, X,
  TrendingDown,
} from 'lucide-react';
import { SelectDropdown } from '../../components/FormField';
import { Toggle } from '../../components/Toggle';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ContaBancaria {
  id?: string;
  banco_codigo: string;
  banco_nome: string;
  agencia: string;
  conta: string;
  tipo_conta: string;
  tipo_chave_pix: string;
  chave_pix: string;
  favorecido: string;
  is_default: boolean;
}

interface Fornecedor {
  id: string;
  tipo_pessoa: string;
  cnpj_cpf: string;
  razao_social: string;
  nome_fantasia: string | null;
  ie: string | null;
  im: string | null;
  suframa: string | null;
  optante_simples: boolean;
  email: string | null;
  email_financeiro: string | null;
  telefone: string | null;
  telefone_secundario: string | null;
  contato_nome: string | null;
  contato_telefone: string | null;
  site: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  pais: string;
  codigo_municipio_ibge: string | null;
  regime_tributario: string | null;
  cnae_principal: string | null;
  contribuinte_icms: string | null;
  prazo_pagamento_dias: number | null;
  forma_pagamento_preferencial: string | null;
  limite_credito: number | null;
  observacoes: string | null;
  categoria: string | null;
  tags: string[];
  status: string;
  payables_count?: number;
}

interface DrawerForm {
  id?: string;
  tipo_pessoa: string;
  cnpj_cpf: string;
  razao_social: string;
  nome_fantasia: string;
  ie: string;
  im: string;
  suframa: string;
  optante_simples: boolean;
  email: string;
  email_financeiro: string;
  telefone: string;
  telefone_secundario: string;
  contato_nome: string;
  contato_telefone: string;
  site: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  pais: string;
  codigo_municipio_ibge: string;
  regime_tributario: string;
  cnae_principal: string;
  contribuinte_icms: string;
  prazo_pagamento_dias: string;
  forma_pagamento_preferencial: string;
  limite_credito: string;
  observacoes: string;
  categoria: string;
  tags: string;
  status: string;
  contas: ContaBancaria[];
}

const emptyForm = (): DrawerForm => ({
  tipo_pessoa: 'juridica',
  cnpj_cpf: '',
  razao_social: '',
  nome_fantasia: '',
  ie: '',
  im: '',
  suframa: '',
  optante_simples: false,
  email: '',
  email_financeiro: '',
  telefone: '',
  telefone_secundario: '',
  contato_nome: '',
  contato_telefone: '',
  site: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  municipio: '',
  uf: '',
  pais: 'Brasil',
  codigo_municipio_ibge: '',
  regime_tributario: '',
  cnae_principal: '',
  contribuinte_icms: '',
  prazo_pagamento_dias: '30',
  forma_pagamento_preferencial: '',
  limite_credito: '',
  observacoes: '',
  categoria: '',
  tags: '',
  status: 'ativo',
  contas: [],
});

const emptyContaBancaria = (): ContaBancaria => ({
  banco_codigo: '',
  banco_nome: '',
  agencia: '',
  conta: '',
  tipo_conta: 'corrente',
  tipo_chave_pix: '',
  chave_pix: '',
  favorecido: '',
  is_default: false,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCnpjCpf(v: string): string {
  const d = v.replace(/\D/g, '');
  if (d.length <= 11) {
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

const STATUS_LABELS: Record<string, string> = {
  ativo: 'Ativo', inativo: 'Inativo', bloqueado: 'Bloqueado',
};
const STATUS_COLORS: Record<string, string> = {
  ativo: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  inativo: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  bloqueado: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const CATEGORIAS = [
  { value: '', label: 'Todas' },
  { value: 'material_escolar', label: 'Material Escolar' },
  { value: 'fardamento', label: 'Fardamento' },
  { value: 'alimentacao', label: 'Alimentação' },
  { value: 'servicos', label: 'Serviços' },
  { value: 'tecnologia', label: 'Tecnologia' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'outro', label: 'Outro' },
];

const REGIMES = [
  { value: '', label: 'Não informado' },
  { value: 'simples_nacional', label: 'Simples Nacional' },
  { value: 'lucro_presumido', label: 'Lucro Presumido' },
  { value: 'lucro_real', label: 'Lucro Real' },
  { value: 'mei', label: 'MEI' },
  { value: 'nao_contribuinte', label: 'Não Contribuinte' },
];

const FORMAS_PAGAMENTO = [
  { value: '', label: 'Não definida' },
  { value: 'pix', label: 'PIX' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'outro', label: 'Outro' },
];

const CONTRIBUINTE_OPTIONS = [
  { value: '', label: 'Não informado' },
  { value: 'contribuinte', label: 'Contribuinte' },
  { value: 'nao_contribuinte', label: 'Não Contribuinte' },
  { value: 'isento', label: 'Isento' },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function FornecedoresPage() {
  useAdminAuth();
  const { loading: cepLoading, lookup: cepLookup } = useCepLookup();

  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('');

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<DrawerForm>(emptyForm());
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Duplicate check
  const [dupCheck, setDupCheck] = useState<{ id: string; razao_social: string } | null>(null);
  const [dupLoading, setDupLoading] = useState(false);

  // CNPJ lookup (Nuvem Fiscal)
  const [cnpjLookupLoading, setCnpjLookupLoading] = useState(false);
  const [cnpjLookupError, setCnpjLookupError] = useState<string | null>(null);
  const [cnpjLookupDone, setCnpjLookupDone] = useState(false);
  const [lastLookupCnpj, setLastLookupCnpj] = useState('');

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('fornecedores')
      .select('*')
      .order('razao_social');
    setFornecedores((data as Fornecedor[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Filter ────────────────────────────────────────────────────────────────

  const filtered = fornecedores.filter((f) => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      f.razao_social.toLowerCase().includes(q) ||
      (f.nome_fantasia ?? '').toLowerCase().includes(q) ||
      f.cnpj_cpf.includes(q);
    const matchStatus = !filterStatus || f.status === filterStatus;
    const matchCat = !filterCategoria || f.categoria === filterCategoria;
    return matchSearch && matchStatus && matchCat;
  });

  // ── Open drawer ───────────────────────────────────────────────────────────

  const openNew = () => {
    setForm(emptyForm());
    setDupCheck(null);
    setCnpjLookupError(null);
    setCnpjLookupDone(false);
    setLastLookupCnpj('');
    setDeleteConfirm(false);
    setSaveState('idle');
    setDrawerOpen(true);
  };

  const openEdit = async (f: Fornecedor) => {
    // Load contas bancárias
    const { data: contas } = await supabase
      .from('fornecedor_contas_bancarias')
      .select('*')
      .eq('fornecedor_id', f.id)
      .order('is_default', { ascending: false });

    setForm({
      id: f.id,
      tipo_pessoa: f.tipo_pessoa,
      cnpj_cpf: f.cnpj_cpf,
      razao_social: f.razao_social,
      nome_fantasia: f.nome_fantasia ?? '',
      ie: f.ie ?? '',
      im: f.im ?? '',
      suframa: f.suframa ?? '',
      optante_simples: f.optante_simples,
      email: f.email ?? '',
      email_financeiro: f.email_financeiro ?? '',
      telefone: f.telefone ?? '',
      telefone_secundario: f.telefone_secundario ?? '',
      contato_nome: f.contato_nome ?? '',
      contato_telefone: f.contato_telefone ?? '',
      site: f.site ?? '',
      cep: f.cep ?? '',
      logradouro: f.logradouro ?? '',
      numero: f.numero ?? '',
      complemento: f.complemento ?? '',
      bairro: f.bairro ?? '',
      municipio: f.municipio ?? '',
      uf: f.uf ?? '',
      pais: f.pais,
      codigo_municipio_ibge: f.codigo_municipio_ibge ?? '',
      regime_tributario: f.regime_tributario ?? '',
      cnae_principal: f.cnae_principal ?? '',
      contribuinte_icms: f.contribuinte_icms ?? '',
      prazo_pagamento_dias: String(f.prazo_pagamento_dias ?? 30),
      forma_pagamento_preferencial: f.forma_pagamento_preferencial ?? '',
      limite_credito: f.limite_credito ? String(f.limite_credito) : '',
      observacoes: f.observacoes ?? '',
      categoria: f.categoria ?? '',
      tags: (f.tags ?? []).join(', '),
      status: f.status,
      contas: (contas as ContaBancaria[]) ?? [],
    });
    setDupCheck(null);
    setCnpjLookupError(null);
    setCnpjLookupDone(false);
    setLastLookupCnpj('');
    setDeleteConfirm(false);
    setSaveState('idle');
    setDrawerOpen(true);
  };

  // ── CNPJ lookup (Nuvem Fiscal) ────────────────────────────────────────────

  type NuvemCnpj = {
    razao_social?: string;
    nome_fantasia?: string;
    email?: string;
    telefones?: Array<{ ddd?: string; numero?: string }>;
    endereco?: {
      logradouro?: string;
      numero?: string;
      complemento?: string;
      bairro?: string;
      cep?: string;
      uf?: string;
      municipio?: { codigo_ibge?: string | number; descricao?: string };
    };
    atividade_principal?: { codigo?: string | number };
    simples?: { optante?: boolean };
  };

  const formatDoc = (raw: string, tipo: string): string => {
    const d = raw.replace(/\D/g, '');
    if (tipo === 'juridica') {
      // CNPJ: 00.000.000/0000-00
      if (d.length <= 2) return d;
      if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
      if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
      if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
      return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
    }
    // CPF: 000.000.000-00
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
  };

  const formatPhone = (ddd?: string, numero?: string): string => {
    const d = (ddd ?? '').replace(/\D/g, '');
    const n = (numero ?? '').replace(/\D/g, '');
    if (!d && !n) return '';
    if (n.length === 9) return `(${d}) ${n.slice(0, 5)}-${n.slice(5)}`;
    if (n.length === 8) return `(${d}) ${n.slice(0, 4)}-${n.slice(4)}`;
    return `(${d}) ${n}`;
  };

  const handleCnpjLookup = async (rawCnpj: string) => {
    const digits = rawCnpj.replace(/\D/g, '');
    if (digits.length !== 14) return;
    if (form.id) return; // só auto-preenche em novo cadastro
    setLastLookupCnpj(digits);
    setCnpjLookupError(null);
    setCnpjLookupDone(false);
    setCnpjLookupLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('cnpj-lookup', {
        body: { cnpj: digits },
      });
      if (error) {
        // tenta extrair mensagem do body
        let msg = error.message || 'Falha ao consultar CNPJ.';
        try {
          const ctx = (error as { context?: Response }).context;
          if (ctx) {
            const body = await ctx.clone().json();
            if (body?.error) msg = body.error;
          }
        } catch { /* ignore */ }
        setCnpjLookupError(msg);
        return;
      }
      if (!data?.ok) {
        setCnpjLookupError(data?.error ?? 'CNPJ não encontrado.');
        return;
      }
      const d = (data.data ?? {}) as NuvemCnpj;
      setForm((f) => ({
        ...f,
        razao_social: f.razao_social || (d.razao_social ?? ''),
        nome_fantasia: f.nome_fantasia || (d.nome_fantasia ?? ''),
        email: f.email || (d.email ?? ''),
        telefone: f.telefone || formatPhone(d.telefones?.[0]?.ddd, d.telefones?.[0]?.numero),
        telefone_secundario:
          f.telefone_secundario || formatPhone(d.telefones?.[1]?.ddd, d.telefones?.[1]?.numero),
        cep: f.cep || (d.endereco?.cep ?? ''),
        logradouro: f.logradouro || (d.endereco?.logradouro ?? ''),
        numero: f.numero || (d.endereco?.numero ?? ''),
        complemento: f.complemento || (d.endereco?.complemento ?? ''),
        bairro: f.bairro || (d.endereco?.bairro ?? ''),
        municipio: f.municipio || (d.endereco?.municipio?.descricao ?? ''),
        uf: f.uf || (d.endereco?.uf ?? ''),
        codigo_municipio_ibge:
          f.codigo_municipio_ibge || String(d.endereco?.municipio?.codigo_ibge ?? ''),
        cnae_principal: f.cnae_principal || String(d.atividade_principal?.codigo ?? ''),
        optante_simples: f.optante_simples || Boolean(d.simples?.optante),
      }));
      setCnpjLookupDone(true);
    } catch (e) {
      setCnpjLookupError(e instanceof Error ? e.message : 'Falha ao consultar CNPJ.');
    } finally {
      setCnpjLookupLoading(false);
    }
  };

  // ── Duplicate check ───────────────────────────────────────────────────────

  const checkDuplicate = async (cnpj: string) => {
    const digits = cnpj.replace(/\D/g, '');
    if (digits.length < 11) { setDupCheck(null); return; }
    if (form.id) return; // editing: skip check
    setDupLoading(true);
    const { data } = await supabase
      .from('fornecedores')
      .select('id, razao_social')
      .eq('cnpj_cpf', digits)
      .maybeSingle();
    setDupCheck(data ? { id: data.id, razao_social: data.razao_social } : null);
    setDupLoading(false);
  };

  // ── CEP lookup ────────────────────────────────────────────────────────────

  const handleCepBlur = async () => {
    const addr = await cepLookup(form.cep);
    if (addr) {
      setForm((f) => ({
        ...f,
        logradouro: addr.logradouro || f.logradouro,
        bairro: addr.bairro || f.bairro,
        municipio: addr.municipio || f.municipio,
        uf: addr.uf || f.uf,
        codigo_municipio_ibge: addr.codigo_municipio_ibge || f.codigo_municipio_ibge,
      }));
    }
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.cnpj_cpf.trim() || !form.razao_social.trim()) return;
    setSaveState('saving');

    const digits = form.cnpj_cpf.replace(/\D/g, '');
    const payload = {
      tipo_pessoa: form.tipo_pessoa,
      cnpj_cpf: digits,
      razao_social: form.razao_social.trim(),
      nome_fantasia: form.nome_fantasia.trim() || null,
      ie: form.ie.trim() || null,
      im: form.im.trim() || null,
      suframa: form.suframa.trim() || null,
      optante_simples: form.optante_simples,
      email: form.email.trim() || null,
      email_financeiro: form.email_financeiro.trim() || null,
      telefone: form.telefone.trim() || null,
      telefone_secundario: form.telefone_secundario.trim() || null,
      contato_nome: form.contato_nome.trim() || null,
      contato_telefone: form.contato_telefone.trim() || null,
      site: form.site.trim() || null,
      cep: form.cep.replace(/\D/g, '') || null,
      logradouro: form.logradouro.trim() || null,
      numero: form.numero.trim() || null,
      complemento: form.complemento.trim() || null,
      bairro: form.bairro.trim() || null,
      municipio: form.municipio.trim() || null,
      uf: form.uf.trim() || null,
      pais: form.pais.trim() || 'Brasil',
      codigo_municipio_ibge: form.codigo_municipio_ibge.trim() || null,
      regime_tributario: form.regime_tributario || null,
      cnae_principal: form.cnae_principal.trim() || null,
      contribuinte_icms: form.contribuinte_icms || null,
      prazo_pagamento_dias: parseInt(form.prazo_pagamento_dias) || 30,
      forma_pagamento_preferencial: form.forma_pagamento_preferencial || null,
      limite_credito: form.limite_credito ? parseFloat(form.limite_credito) : null,
      observacoes: form.observacoes.trim() || null,
      categoria: form.categoria || null,
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      status: form.status,
    };

    let fornecedorId = form.id;

    if (form.id) {
      const { error } = await supabase.from('fornecedores').update(payload).eq('id', form.id);
      if (error) { setSaveState('idle'); return; }
      await logAudit({ action: 'update', module: 'fornecedores', recordId: form.id, description: `Fornecedor atualizado: ${payload.razao_social}` });
    } else {
      const { data, error } = await supabase.from('fornecedores').insert(payload).select('id').single();
      if (error) { setSaveState('idle'); return; }
      fornecedorId = data.id;
      await logAudit({ action: 'create', module: 'fornecedores', recordId: fornecedorId!, description: `Fornecedor criado: ${payload.razao_social}` });
    }

    // Save contas bancárias
    if (fornecedorId) {
      // Delete removed accounts (those with id that are no longer in list)
      const existingIds = form.contas.filter((c) => c.id).map((c) => c.id!);
      if (form.id) {
        const { data: oldContas } = await supabase
          .from('fornecedor_contas_bancarias')
          .select('id')
          .eq('fornecedor_id', fornecedorId);
        const toDelete = (oldContas ?? [])
          .map((c: { id: string }) => c.id)
          .filter((id: string) => !existingIds.includes(id));
        if (toDelete.length > 0) {
          await supabase.from('fornecedor_contas_bancarias').delete().in('id', toDelete);
        }
      }

      for (const conta of form.contas) {
        const contaPayload = {
          fornecedor_id: fornecedorId,
          banco_codigo: conta.banco_codigo || null,
          banco_nome: conta.banco_nome || null,
          agencia: conta.agencia || null,
          conta: conta.conta || null,
          tipo_conta: conta.tipo_conta || null,
          tipo_chave_pix: conta.tipo_chave_pix || null,
          chave_pix: conta.chave_pix || null,
          favorecido: conta.favorecido || null,
          is_default: conta.is_default,
        };
        if (conta.id) {
          await supabase.from('fornecedor_contas_bancarias').update(contaPayload).eq('id', conta.id);
        } else {
          await supabase.from('fornecedor_contas_bancarias').insert(contaPayload);
        }
      }
    }

    setSaveState('saved');
    setTimeout(() => {
      setSaveState('idle');
      setDrawerOpen(false);
      load();
    }, 900);
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!form.id) return;
    await supabase.from('fornecedores').delete().eq('id', form.id);
    await logAudit({ action: 'delete', module: 'fornecedores', recordId: form.id, description: `Fornecedor excluído: ${form.razao_social}` });
    setDrawerOpen(false);
    load();
  };

  // ── Conta bancária helpers ────────────────────────────────────────────────

  const addConta = () => setForm((f) => ({ ...f, contas: [...f.contas, emptyContaBancaria()] }));

  const removeConta = (i: number) =>
    setForm((f) => ({ ...f, contas: f.contas.filter((_, idx) => idx !== i) }));

  const updateConta = (i: number, field: keyof ContaBancaria, value: string | boolean) => {
    setForm((f) => {
      const contas = [...f.contas];
      if (field === 'is_default' && value === true) {
        contas.forEach((c, idx) => { if (idx !== i) c.is_default = false; });
      }
      contas[i] = { ...contas[i], [field]: value };
      return { ...f, contas };
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const field = (label: string, key: keyof DrawerForm, opts?: {
    placeholder?: string; type?: string; required?: boolean;
  }) => (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
        {label}{opts?.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={opts?.type ?? 'text'}
        value={String(form[key] ?? '')}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={opts?.placeholder ?? ''}
        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
      />
    </div>
  );

  const select = (label: string, key: keyof DrawerForm, options: { value: string; label: string }[]) => (
    <SelectDropdown
      label={label}
      value={String(form[key] ?? '')}
      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </SelectDropdown>
  );

  return (
    <PermissionGate moduleKey="fornecedores" action="view">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-1 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Razão social, fantasia ou CNPJ…"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none"
            >
              <option value="">Todos os status</option>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
              <option value="bloqueado">Bloqueado</option>
            </select>
            <select
              value={filterCategoria}
              onChange={(e) => setFilterCategoria(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none"
            >
              {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <PermissionGate moduleKey="fornecedores" action="create">
            <button
              onClick={openNew}
              className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Building2 className="w-4 h-4" />
              Novo Fornecedor
            </button>
          </PermissionGate>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum fornecedor encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Fornecedor</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">CNPJ / CPF</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Categoria</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Contato</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Status</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">A/P</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map((f) => (
                  <tr
                    key={f.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors"
                    onClick={() => openEdit(f)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800 dark:text-white">{f.razao_social}</p>
                      {f.nome_fantasia && (
                        <p className="text-xs text-gray-400">{f.nome_fantasia}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-300">
                      {formatCnpjCpf(f.cnpj_cpf)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-xs capitalize">
                      {CATEGORIAS.find((c) => c.value === f.categoria)?.label ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {f.telefone && <p className="text-xs text-gray-500">{f.telefone}</p>}
                      {f.email && <p className="text-xs text-gray-400 truncate max-w-[160px]">{f.email}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[f.status] ?? ''}`}>
                        {STATUS_LABELS[f.status] ?? f.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {(f.payables_count ?? 0) > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                          <TrendingDown className="w-3 h-3" />
                          {f.payables_count}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Pencil className="w-4 h-4 text-gray-300 hover:text-brand-primary transition-colors" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Drawer */}
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={form.id ? 'Editar Fornecedor' : 'Novo Fornecedor'}
          icon={Building2}
          width="w-[640px]"
          footer={
            <div className="flex gap-2">
              {form.id && (
                <PermissionGate moduleKey="fornecedores" action="delete">
                  {deleteConfirm ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleDelete}
                        className="px-3 py-2 text-sm bg-red-500 text-white rounded-xl font-medium"
                      >
                        Confirmar exclusão
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(false)}
                        className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl text-gray-500"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(true)}
                      className="p-2 rounded-xl text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </PermissionGate>
              )}
              <div className="flex-1" />
              <button
                onClick={() => setDrawerOpen(false)}
                className="flex-1 px-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
              >
                Cancelar
              </button>
              <PermissionGate moduleKey="fornecedores" action={form.id ? 'edit' : 'create'}>
                <button
                  onClick={handleSave}
                  disabled={saveState === 'saving' || !form.cnpj_cpf || !form.razao_social}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    saveState === 'saved'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-brand-primary text-white hover:opacity-90 disabled:opacity-50'
                  }`}
                >
                  {saveState === 'saving' && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saveState === 'saved' && <Check className="w-4 h-4" />}
                  {saveState === 'idle' && <Building2 className="w-4 h-4" />}
                  {saveState === 'saving' ? 'Salvando…' : saveState === 'saved' ? 'Salvo!' : form.id ? 'Salvar' : 'Criar Fornecedor'}
                </button>
              </PermissionGate>
            </div>
          }
        >
          {/* Barra de progresso — busca de CNPJ em andamento */}
          {cnpjLookupLoading && (
            <div className="sticky top-0 z-10 -mx-5 -mt-5 mb-4 bg-brand-primary/5 border-b border-brand-primary/20">
              <div className="px-5 py-2 flex items-center gap-2 text-xs text-brand-primary">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Consultando CNPJ na Receita…</span>
              </div>
              <div className="h-0.5 bg-brand-primary/20 overflow-hidden">
                <div className="h-full w-1/3 bg-brand-primary animate-pulse" />
              </div>
            </div>
          )}

          <div className="space-y-4">

            {/* Identificação */}
            <DrawerCard title="Identificação" icon={Building2}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tipo de Pessoa</label>
                  <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600">
                    {[{ value: 'juridica', label: 'Jurídica' }, { value: 'fisica', label: 'Física' }].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setForm((f) => ({
                          ...f,
                          tipo_pessoa: opt.value,
                          ...(opt.value === 'fisica' ? {
                            nome_fantasia: '',
                            ie: '',
                            im: '',
                            suframa: '',
                            optante_simples: false,
                            regime_tributario: '',
                            cnae_principal: '',
                            contribuinte_icms: '',
                          } : {}),
                        }))}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${
                          form.tipo_pessoa === opt.value
                            ? 'bg-brand-primary text-white'
                            : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    {form.tipo_pessoa === 'juridica' ? 'CNPJ' : 'CPF'} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      value={formatDoc(form.cnpj_cpf, form.tipo_pessoa)}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, '');
                        const maxLen = form.tipo_pessoa === 'juridica' ? 14 : 11;
                        const trimmed = v.slice(0, maxLen);
                        setForm((f) => ({ ...f, cnpj_cpf: trimmed }));
                        if (trimmed !== lastLookupCnpj) {
                          setCnpjLookupDone(false);
                          setCnpjLookupError(null);
                        }
                        // Auto-lookup quando completa os 14 dígitos de CNPJ (novo cadastro)
                        if (
                          form.tipo_pessoa === 'juridica' &&
                          !form.id &&
                          trimmed.length === 14 &&
                          trimmed !== lastLookupCnpj &&
                          !cnpjLookupLoading
                        ) {
                          handleCnpjLookup(trimmed);
                        }
                      }}
                      onBlur={() => checkDuplicate(form.cnpj_cpf)}
                      inputMode="numeric"
                      placeholder={form.tipo_pessoa === 'juridica' ? '00.000.000/0001-00' : '000.000.000-00'}
                      className="w-full px-3 py-2 pr-8 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30 font-mono"
                    />
                    {(dupLoading || cnpjLookupLoading) && (
                      <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-brand-primary" />
                    )}
                    {!dupLoading && !cnpjLookupLoading && cnpjLookupDone && (
                      <Check className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                    )}
                  </div>
                  {cnpjLookupError && (
                    <div className="mt-1 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="flex-1 text-xs text-red-700 dark:text-red-400">{cnpjLookupError}</p>
                      <button onClick={() => setCnpjLookupError(null)}>
                        <X className="w-3 h-3 text-gray-400" />
                      </button>
                    </div>
                  )}
                  {dupCheck && (
                    <div className="mt-1 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                          Já existe: <strong>{dupCheck.razao_social}</strong>
                        </p>
                        <button
                          onClick={() => {
                            const existing = fornecedores.find((f) => f.id === dupCheck.id);
                            if (existing) openEdit(existing);
                          }}
                          className="text-xs text-brand-primary underline"
                        >
                          Abrir cadastro existente
                        </button>
                      </div>
                      <button onClick={() => setDupCheck(null)}>
                        <X className="w-3 h-3 text-gray-400" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {(() => { const isPJ = form.tipo_pessoa === 'juridica'; return (
              <>
                <div className={`grid mt-3 gap-3 ${isPJ ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {field(isPJ ? 'Razão Social' : 'Nome Completo', 'razao_social', { required: true })}
                  {isPJ && field('Nome Fantasia', 'nome_fantasia')}
                </div>

                {isPJ && (
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    {field('Inscrição Estadual', 'ie')}
                    {field('Inscrição Municipal', 'im')}
                    {field('SUFRAMA', 'suframa')}
                  </div>
                )}
              </>
              ); })()}
            </DrawerCard>

            {/* Contato */}
            <DrawerCard title="Contato" icon={Phone}>
              <div className="grid grid-cols-2 gap-3">
                {field('E-mail Principal', 'email', { type: 'email' })}
                {field('E-mail Financeiro', 'email_financeiro', { type: 'email' })}
                {field('Telefone', 'telefone')}
                {field('Telefone Secundário', 'telefone_secundario')}
                {field('Nome do Contato', 'contato_nome')}
                {field('Telefone do Contato', 'contato_telefone')}
              </div>
              <div className="mt-3">
                {field('Site', 'site', { placeholder: 'https://www.exemplo.com.br' })}
              </div>
            </DrawerCard>

            {/* Endereço */}
            <DrawerCard title="Endereço" icon={MapPin}>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    CEP {cepLoading && <span className="text-brand-primary">(buscando…)</span>}
                  </label>
                  <input
                    value={form.cep}
                    onChange={(e) => setForm((f) => ({ ...f, cep: e.target.value }))}
                    onBlur={handleCepBlur}
                    placeholder="00000-000"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                  />
                </div>
                <div className="col-span-2">
                  {field('Logradouro', 'logradouro')}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3">
                {field('Número', 'numero')}
                {field('Complemento', 'complemento')}
                {field('Bairro', 'bairro')}
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3">
                {field('Município', 'municipio')}
                {field('UF', 'uf', { placeholder: 'PE' })}
                {field('País', 'pais')}
              </div>
            </DrawerCard>

            {/* Dados Fiscais — PJ only */}
            {form.tipo_pessoa === 'juridica' && (
              <DrawerCard title="Dados Fiscais" icon={CreditCard}>
                <div className="grid grid-cols-3 gap-3">
                  {select('Regime Tributário', 'regime_tributario', REGIMES)}
                  {field('CNAE Principal', 'cnae_principal', { placeholder: '8599604' })}
                  {select('Contribuinte ICMS', 'contribuinte_icms', CONTRIBUINTE_OPTIONS)}
                </div>
                <div className="mt-3">
                  <Toggle
                    checked={form.optante_simples}
                    onChange={(v) => setForm((f) => ({ ...f, optante_simples: v }))}
                    label="Optante pelo Simples Nacional"
                    onColor="bg-emerald-500"
                  />
                </div>
              </DrawerCard>
            )}

            {/* Condições Comerciais */}
            <DrawerCard title="Condições Comerciais" icon={TrendingDown}>
              <div className="grid grid-cols-2 gap-3">
                {field('Prazo de Pagamento (dias)', 'prazo_pagamento_dias', { type: 'number', placeholder: '30' })}
                {select('Forma de Pagamento Preferencial', 'forma_pagamento_preferencial', FORMAS_PAGAMENTO)}
                {field('Limite de Crédito (R$)', 'limite_credito', { type: 'number' })}
                {select('Status', 'status', [
                  { value: 'ativo', label: 'Ativo' },
                  { value: 'inativo', label: 'Inativo' },
                  { value: 'bloqueado', label: 'Bloqueado' },
                ])}
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                {select('Categoria', 'categoria', CATEGORIAS)}
                {field('Tags (separadas por vírgula)', 'tags', { placeholder: 'uniforme, anual' })}
              </div>
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Observações</label>
                <textarea
                  value={form.observacoes}
                  onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30 resize-none"
                />
              </div>
            </DrawerCard>

            {/* Contas Bancárias */}
            <DrawerCard title="Contas Bancárias" icon={CreditCard}>
              <div className="space-y-3">
                {form.contas.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-2">Nenhuma conta cadastrada</p>
                )}
                {form.contas.map((conta, i) => (
                  <div key={i} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                        Conta {i + 1}{conta.is_default && ' · Padrão'}
                      </span>
                      <button onClick={() => removeConta(i)} className="text-gray-400 hover:text-red-500 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <input
                        value={conta.banco_nome}
                        onChange={(e) => updateConta(i, 'banco_nome', e.target.value)}
                        placeholder="Nome do banco"
                        className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none"
                      />
                      <input
                        value={conta.banco_codigo}
                        onChange={(e) => updateConta(i, 'banco_codigo', e.target.value)}
                        placeholder="Código do banco"
                        className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none"
                      />
                      <input
                        value={conta.agencia}
                        onChange={(e) => updateConta(i, 'agencia', e.target.value)}
                        placeholder="Agência"
                        className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none"
                      />
                      <input
                        value={conta.conta}
                        onChange={(e) => updateConta(i, 'conta', e.target.value)}
                        placeholder="Conta c/ dígito"
                        className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none"
                      />
                      <SelectDropdown
                        value={conta.tipo_conta}
                        onChange={(e) => updateConta(i, 'tipo_conta', e.target.value)}
                      >
                        <option value="corrente">Corrente</option>
                        <option value="poupanca">Poupança</option>
                        <option value="pagamento">Pagamento</option>
                      </SelectDropdown>
                      <SelectDropdown
                        value={conta.tipo_chave_pix}
                        onChange={(e) => updateConta(i, 'tipo_chave_pix', e.target.value)}
                      >
                        <option value="">Tipo chave PIX</option>
                        <option value="cpf_cnpj">CPF / CNPJ</option>
                        <option value="email">E-mail</option>
                        <option value="telefone">Telefone</option>
                        <option value="aleatoria">Chave Aleatória</option>
                      </SelectDropdown>
                      <input
                        value={conta.chave_pix}
                        onChange={(e) => updateConta(i, 'chave_pix', e.target.value)}
                        placeholder="Chave PIX"
                        className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none"
                      />
                      <input
                        value={conta.favorecido}
                        onChange={(e) => updateConta(i, 'favorecido', e.target.value)}
                        placeholder="Favorecido (se diferente)"
                        className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => updateConta(i, 'is_default', !conta.is_default)}
                        className={`w-8 h-4 rounded-full transition-colors relative ${conta.is_default ? 'bg-brand-primary' : 'bg-gray-200 dark:bg-gray-600'}`}
                      >
                        <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${conta.is_default ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                      <span className="text-xs text-gray-500">Conta padrão para pagamentos</span>
                    </div>
                  </div>
                ))}
                <button
                  onClick={addConta}
                  className="w-full flex items-center justify-center gap-2 py-2 text-xs text-brand-primary hover:bg-brand-primary/5 rounded-xl border border-dashed border-brand-primary/30 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar conta bancária
                </button>
              </div>
            </DrawerCard>

          </div>
        </Drawer>
      </div>
    </PermissionGate>
  );
}
