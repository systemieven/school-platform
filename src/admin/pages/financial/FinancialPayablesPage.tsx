/**
 * FinancialPayablesPage — Contas a Pagar (A/P, Fase 8.5)
 *
 * Despesas fixas e variáveis com parcelamento, recorrência e baixa com comprovante.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import type {
  FinancialPayable,
  FinancialAccountCategory,
  PayableStatus,
} from '../../types/admin.types';
import {
  PAYABLE_STATUS_LABELS,
  PAYABLE_STATUS_COLORS,
  PAYABLE_CREDITOR_TYPE_LABELS,
  PAYABLE_CATEGORY_TYPE_LABELS,
} from '../../types/admin.types';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import PermissionGate from '../../components/PermissionGate';
import { Drawer, DrawerCard } from '../../components/Drawer';
import {
  Loader2, Plus, TrendingDown, Check, Search,
  Pencil, Trash2, X, DollarSign, User, Calendar,
  ToggleLeft, ToggleRight, AlertTriangle, Building2,
} from 'lucide-react';
import { SelectDropdown } from '../../components/FormField';

// ── Fornecedor types (lightweight for search) ─────────────────────────────────
interface FornecedorLite {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj_cpf: string;
  prazo_pagamento_dias: number | null;
  forma_pagamento_preferencial: string | null;
  contas_bancarias: { banco_nome: string; tipo_chave_pix: string; chave_pix: string; is_default: boolean }[];
}

const PAYMENT_METHODS = [
  { value: '',             label: 'Não definida' },
  { value: 'cash',         label: 'Dinheiro' },
  { value: 'pix',          label: 'PIX' },
  { value: 'credit_card',  label: 'Cartão de Crédito' },
  { value: 'debit_card',   label: 'Cartão de Débito' },
  { value: 'transfer',     label: 'Transferência' },
  { value: 'boleto',       label: 'Boleto' },
  { value: 'other',        label: 'Outro' },
];

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}
function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
}

interface DrawerState {
  id?: string;
  creditor_name: string;
  creditor_type: string;
  fornecedor_id: string | null;
  amount: string;
  account_category_id: string;
  category_type: string;
  description: string;
  due_date: string;
  payment_method: string;
  total_installments: string;
  is_recurring: boolean;
  recurrence_interval: string;
  recurrence_end_date: string;
  alert_days_before: string;
  notes: string;
}

const emptyDrawer = (): DrawerState => ({
  creditor_name: '',
  creditor_type: 'supplier',
  fornecedor_id: null,
  amount: '',
  account_category_id: '',
  category_type: 'variable',
  description: '',
  due_date: new Date().toISOString().slice(0, 10),
  payment_method: '',
  total_installments: '1',
  is_recurring: false,
  recurrence_interval: '',
  recurrence_end_date: '',
  alert_days_before: '3',
  notes: '',
});

export default function FinancialPayablesPage() {
  const { profile } = useAdminAuth();
  const [items, setItems] = useState<FinancialPayable[]>([]);
  const [categories, setCategories] = useState<FinancialAccountCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PayableStatus | 'all'>('all');
  const [categoryTypeFilter, setCategoryTypeFilter] = useState<'all' | 'fixed' | 'variable'>('all');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<DrawerState>(emptyDrawer());
  const [isNew, setIsNew] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fornecedor search state
  const [fornSearch, setFornSearch] = useState('');
  const [fornResults, setFornResults] = useState<FornecedorLite[]>([]);
  const [fornLoading, setFornLoading] = useState(false);
  const [fornDropOpen, setFornDropOpen] = useState(false);
  const [selectedFornecedor, setSelectedFornecedor] = useState<FornecedorLite | null>(null);
  const fornTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [payItem, setPayItem] = useState<FinancialPayable | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('transfer');
  const [paySaving, setPaySaving] = useState(false);
  const [paySaved, setPaySaved] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [itemsRes, catRes] = await Promise.all([
      supabase
        .from('financial_payables')
        .select('*, account_category:financial_account_categories(name, type), fornecedor:fornecedores(razao_social,nome_fantasia)')
        .is('parent_id', null)
        .order('due_date', { ascending: true }),
      supabase
        .from('financial_account_categories')
        .select('*')
        .eq('type', 'despesa')
        .eq('is_active', true)
        .order('position'),
    ]);
    setItems((itemsRes.data ?? []) as unknown as FinancialPayable[]);
    setCategories((catRes.data ?? []) as FinancialAccountCategory[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter((item) => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (categoryTypeFilter !== 'all' && item.category_type !== categoryTypeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!item.creditor_name.toLowerCase().includes(q) && !item.description.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // KPIs
  const today = new Date().toISOString().slice(0, 10);
  const totalPending = items.filter((i) => i.status === 'pending').reduce((s, i) => s + Number(i.amount), 0);
  const totalOverdue = items.filter((i) => i.status === 'overdue').reduce((s, i) => s + Number(i.amount), 0);
  const totalPaid = items.filter((i) => i.status === 'paid').reduce((s, i) => s + Number(i.amount_paid), 0);
  const alertCount = items.filter((i) => {
    if (i.status !== 'pending') return false;
    const daysUntil = Math.floor((new Date(i.due_date).getTime() - new Date(today).getTime()) / 86400000);
    return daysUntil >= 0 && daysUntil <= i.alert_days_before;
  }).length;

  // Fornecedor lookup with debounce
  async function searchFornecedores(q: string) {
    if (!q.trim()) { setFornResults([]); setFornDropOpen(false); return; }
    setFornLoading(true);
    const { data } = await supabase
      .from('fornecedores')
      .select('id, razao_social, nome_fantasia, cnpj_cpf, prazo_pagamento_dias, forma_pagamento_preferencial, fornecedor_contas_bancarias(banco_nome,tipo_chave_pix,chave_pix,is_default)')
      .or(`razao_social.ilike.%${q}%,nome_fantasia.ilike.%${q}%,cnpj_cpf.ilike.%${q}%`)
      .eq('status', 'ativo')
      .limit(6);
    setFornResults((data ?? []).map((d: Record<string, unknown>) => ({
      ...(d as Omit<FornecedorLite, 'contas_bancarias'>),
      contas_bancarias: (d.fornecedor_contas_bancarias as FornecedorLite['contas_bancarias']) ?? [],
    })));
    setFornDropOpen(true);
    setFornLoading(false);
  }

  function onFornSearchChange(v: string) {
    setFornSearch(v);
    if (fornTimer.current) clearTimeout(fornTimer.current);
    fornTimer.current = setTimeout(() => searchFornecedores(v), 400);
  }

  function selectFornecedor(f: FornecedorLite) {
    setSelectedFornecedor(f);
    setFornSearch('');
    setFornDropOpen(false);
    // Apply supplier defaults
    const defaultConta = f.contas_bancarias.find((c) => c.is_default) ?? f.contas_bancarias[0];
    const pmMap: Record<string, string> = {
      pix: 'pix', boleto: 'boleto', transferencia: 'transfer', cartao: 'credit_card',
    };
    const pm = f.forma_pagamento_preferencial ? (pmMap[f.forma_pagamento_preferencial] ?? '') : (defaultConta?.tipo_chave_pix ? 'pix' : '');
    const dueDate = f.prazo_pagamento_dias
      ? new Date(Date.now() + f.prazo_pagamento_dias * 86400000).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    setForm((prev) => ({
      ...prev,
      fornecedor_id: f.id,
      creditor_name: f.nome_fantasia ?? f.razao_social,
      creditor_type: 'supplier',
      payment_method: pm,
      due_date: dueDate,
    }));
  }

  function clearFornecedor() {
    setSelectedFornecedor(null);
    setForm((prev) => ({ ...prev, fornecedor_id: null }));
  }

  function openNew() {
    setForm(emptyDrawer());
    setIsNew(true);
    setSelectedFornecedor(null);
    setFornSearch('');
    setFornDropOpen(false);
    setDrawerOpen(true);
  }

  function openEdit(item: FinancialPayable) {
    setForm({
      id: item.id,
      creditor_name: item.creditor_name,
      creditor_type: item.creditor_type,
      fornecedor_id: (item as FinancialPayable & { fornecedor_id?: string | null }).fornecedor_id ?? null,
      amount: String(item.amount),
      account_category_id: item.account_category_id ?? '',
      category_type: item.category_type,
      description: item.description,
      due_date: item.due_date,
      payment_method: item.payment_method ?? '',
      total_installments: String(item.total_installments ?? 1),
      is_recurring: item.is_recurring,
      recurrence_interval: item.recurrence_interval ?? '',
      recurrence_end_date: item.recurrence_end_date ?? '',
      alert_days_before: String(item.alert_days_before),
      notes: item.notes ?? '',
    });
    setIsNew(false);
    setSelectedFornecedor(null);
    setFornSearch('');
    setFornDropOpen(false);
    setDrawerOpen(true);
  }

  async function save() {
    if (!form.creditor_name.trim() || !form.amount || !form.description.trim() || !form.due_date) return;
    setSaving(true);
    const payload = {
      creditor_name: form.creditor_name.trim(),
      creditor_type: form.creditor_type,
      fornecedor_id: form.fornecedor_id ?? null,
      amount: Number(form.amount),
      account_category_id: form.account_category_id || null,
      category_type: form.category_type,
      description: form.description.trim(),
      due_date: form.due_date,
      payment_method: form.payment_method || null,
      total_installments: Number(form.total_installments) || 1,
      is_recurring: form.is_recurring,
      recurrence_interval: form.recurrence_interval || null,
      recurrence_end_date: form.recurrence_end_date || null,
      alert_days_before: Number(form.alert_days_before) || 3,
      notes: form.notes.trim() || null,
      created_by: profile?.id ?? null,
    };
    if (isNew) {
      const { data } = await supabase.from('financial_payables').insert(payload).select('id').single();
      if (data?.id && Number(form.total_installments) > 1) {
        await supabase.rpc('generate_payable_installments', { p_payable_id: data.id });
      }
      logAudit({ action: 'create', module: 'financial-payables', description: `A/P criado: ${payload.description}` });
    } else if (form.id) {
      await supabase.from('financial_payables').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', form.id);
      logAudit({ action: 'update', module: 'financial-payables', description: `A/P atualizado: ${payload.description}` });
    }
    setSaving(false);
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => { setSaved(false); setDrawerOpen(false); load(); }, 900);
  }

  async function deleteItem(id: string) {
    const item = items.find((i) => i.id === id);
    await supabase.from('financial_payables').delete().eq('id', id);
    logAudit({ action: 'delete', module: 'financial-payables', description: `A/P excluído: ${item?.description}` });
    setDeleteId(null);
    load();
  }

  async function payPayable() {
    if (!payItem || !payAmount || Number(payAmount) <= 0) return;
    setPaySaving(true);
    const amountPaid = Number(payAmount);
    await supabase.from('financial_payables').update({
      status: 'paid',
      amount_paid: amountPaid,
      payment_method: payMethod || null,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', payItem.id);
    logAudit({ action: 'update', module: 'financial-payables', description: `Baixa A/P: ${payItem.description}` });
    setPaySaving(false);
    setPaySaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => { setPaySaved(false); setPayItem(null); load(); }, 900);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <PermissionGate moduleKey="financial-payables">
      <div className="space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'A Pagar', value: totalPending, color: 'text-blue-600' },
            { label: 'Vencido', value: totalOverdue, color: 'text-red-500' },
            { label: 'Pago', value: totalPaid, color: 'text-emerald-600' },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-gray-50 dark:bg-gray-900/40 rounded-xl px-4 py-3">
              <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide">{kpi.label}</p>
              <p className={`text-sm font-bold mt-0.5 ${kpi.color}`}>{fmt(kpi.value)}</p>
            </div>
          ))}
        </div>

        {/* Alerta de vencimento próximo */}
        {alertCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              <strong>{alertCount}</strong> conta{alertCount !== 1 ? 's' : ''} vence{alertCount !== 1 ? 'm' : ''} nos próximos dias.
            </p>
          </div>
        )}

        {/* Filtros + ação */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-40">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary outline-none" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as PayableStatus | 'all')}
            className="px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:border-brand-primary outline-none">
            <option value="all">Todos os status</option>
            {(Object.entries(PAYABLE_STATUS_LABELS) as [PayableStatus, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select value={categoryTypeFilter} onChange={(e) => setCategoryTypeFilter(e.target.value as 'all' | 'fixed' | 'variable')}
            className="px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:border-brand-primary outline-none">
            <option value="all">Fixas e Variáveis</option>
            <option value="fixed">Despesas Fixas</option>
            <option value="variable">Despesas Variáveis</option>
          </select>
          <button onClick={openNew}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs bg-brand-primary text-white rounded-xl hover:bg-brand-primary-dark transition-colors font-medium">
            <Plus className="w-3 h-3" /> Nova Despesa
          </button>
        </div>

        {/* Lista */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <TrendingDown className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma conta a pagar encontrada.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((item) => {
              const daysUntil = Math.floor((new Date(item.due_date).getTime() - new Date(today).getTime()) / 86400000);
              const isNearDue = item.status === 'pending' && daysUntil >= 0 && daysUntil <= item.alert_days_before;
              return (
                <div key={item.id}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                    isNearDue
                      ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
                      : 'bg-gray-50 dark:bg-gray-900/40 border-gray-100 dark:border-gray-700'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{item.description}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PAYABLE_STATUS_COLORS[item.status]}`}>
                        {PAYABLE_STATUS_LABELS[item.status]}
                      </span>
                      <span className="text-[10px] text-gray-400">{PAYABLE_CATEGORY_TYPE_LABELS[item.category_type]}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {item.creditor_name} ({PAYABLE_CREDITOR_TYPE_LABELS[item.creditor_type]})
                      {' · Venc. '}{fmtDate(item.due_date)}
                      {isNearDue && <span className="ml-1 text-amber-600 font-semibold">· vence em {daysUntil}d</span>}
                      {(item as FinancialPayable & { fornecedor?: { razao_social: string; nome_fantasia: string | null } | null }).fornecedor && (
                        <span className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded text-[10px] font-medium">
                          <Building2 className="w-2.5 h-2.5" />
                          {(item as FinancialPayable & { fornecedor?: { razao_social: string; nome_fantasia: string | null } }).fornecedor?.nome_fantasia ?? (item as FinancialPayable & { fornecedor?: { razao_social: string; nome_fantasia: string | null } }).fornecedor?.razao_social}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-800 dark:text-white">{fmt(item.amount)}</p>
                    {item.total_installments && item.total_installments > 1 && (
                      <p className="text-[10px] text-gray-400">{item.total_installments}x</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {item.status !== 'paid' && item.status !== 'cancelled' && (
                      <button
                        onClick={() => { setPayItem(item); setPayAmount(String(item.amount)); setPayMethod('transfer'); }}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                        title="Registrar pagamento"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => openEdit(item)} className="p-1.5 text-gray-400 hover:text-brand-primary rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {deleteId === item.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => deleteItem(item.id)} className="px-2 py-1 text-[10px] bg-red-500 text-white rounded-lg">Excluir</button>
                        <button onClick={() => setDeleteId(null)} className="p-1 text-gray-400"><X className="w-3 h-3" /></button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteId(item.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Drawer: Criar / Editar A/P ── */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={isNew ? 'Nova Despesa' : 'Editar Despesa'}
        icon={TrendingDown}
        footer={
          <div className="flex gap-3">
            <button onClick={() => setDrawerOpen(false)} disabled={saving}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={save} disabled={!form.creditor_name.trim() || !form.amount || !form.description.trim() || saving}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${saved ? 'bg-emerald-500 text-white' : 'bg-brand-primary text-white hover:bg-brand-primary-dark disabled:opacity-50'}`}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Salvar'}
            </button>
          </div>
        }
      >
        <DrawerCard title="Credor" icon={User}>
          {/* Fornecedor search */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Fornecedor Cadastrado</label>
            {selectedFornecedor ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-brand-primary/5 border border-brand-primary/20 rounded-xl">
                <Building2 className="w-4 h-4 text-brand-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-brand-primary truncate">{selectedFornecedor.razao_social}</p>
                  <p className="text-[10px] text-gray-400">{selectedFornecedor.cnpj_cpf}</p>
                </div>
                <button type="button" onClick={clearFornecedor} className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                {fornLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 animate-spin" />}
                <input
                  value={fornSearch}
                  onChange={(e) => onFornSearchChange(e.target.value)}
                  onFocus={() => fornSearch && setFornDropOpen(true)}
                  placeholder="Buscar por nome ou CNPJ…"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary outline-none"
                />
                {fornDropOpen && fornResults.length > 0 && (
                  <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg overflow-hidden">
                    {fornResults.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => selectFornecedor(f)}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-left transition-colors"
                      >
                        <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                            {f.nome_fantasia ?? f.razao_social}
                          </p>
                          <p className="text-[10px] text-gray-400 truncate">{f.cnpj_cpf}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <p className="text-[10px] text-gray-400 mt-1">Opcional — vincula o lançamento ao cadastro de fornecedor.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Nome do Credor *</label>
            <input value={form.creditor_name} onChange={(e) => setForm({ ...form, creditor_name: e.target.value })} placeholder="Nome do fornecedor ou credor"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Tipo de Credor</label>
            <div className="grid grid-cols-3 gap-2">
              {(['supplier', 'employee', 'other'] as const).map((t) => (
                <button key={t} type="button" onClick={() => setForm({ ...form, creditor_type: t })}
                  className={`px-3 py-2 text-xs rounded-xl border transition-colors font-medium ${form.creditor_type === t ? 'border-brand-primary bg-brand-primary/10 text-brand-primary dark:bg-brand-primary/20' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300'}`}>
                  {PAYABLE_CREDITOR_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
        </DrawerCard>

        <DrawerCard title="Despesa" icon={DollarSign}>
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Descrição *</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex: Aluguel junho/2026"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Valor *</label>
              <input type="number" min={0.01} step={0.01} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0,00"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Vencimento *</label>
              <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:border-brand-primary outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Tipo</label>
              <div className="grid grid-cols-2 gap-1">
                {(['fixed', 'variable'] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setForm({ ...form, category_type: t })}
                    className={`px-2 py-2 text-xs rounded-xl border transition-colors font-medium ${form.category_type === t ? 'border-brand-primary bg-brand-primary/10 text-brand-primary dark:bg-brand-primary/20' : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:border-gray-300'}`}>
                    {PAYABLE_CATEGORY_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Parcelas</label>
              <input type="number" min={1} max={60} value={form.total_installments} onChange={(e) => setForm({ ...form, total_installments: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:border-brand-primary outline-none" />
            </div>
          </div>
          <SelectDropdown label="Categoria" value={form.account_category_id} onChange={(e) => setForm({ ...form, account_category_id: e.target.value })}>
            <option value="">Sem categoria</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectDropdown>
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Alertar com antecedência (dias)</label>
            <input type="number" min={0} max={30} value={form.alert_days_before} onChange={(e) => setForm({ ...form, alert_days_before: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:border-brand-primary outline-none" />
          </div>
        </DrawerCard>

        <DrawerCard title="Recorrência" icon={Calendar}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Despesa Recorrente</span>
            <button onClick={() => setForm({ ...form, is_recurring: !form.is_recurring })}>
              {form.is_recurring
                ? <ToggleRight className="w-7 h-7 text-emerald-500" />
                : <ToggleLeft className="w-7 h-7 text-gray-300 dark:text-gray-600" />}
            </button>
          </div>
          {form.is_recurring && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <SelectDropdown label="Intervalo" value={form.recurrence_interval} onChange={(e) => setForm({ ...form, recurrence_interval: e.target.value })}>
                <option value="monthly">Mensal</option>
                <option value="quarterly">Trimestral</option>
                <option value="yearly">Anual</option>
              </SelectDropdown>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Encerrar em</label>
                <input type="date" value={form.recurrence_end_date} onChange={(e) => setForm({ ...form, recurrence_end_date: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:border-brand-primary outline-none" />
              </div>
            </div>
          )}
        </DrawerCard>
      </Drawer>

      {/* ── Drawer: Baixa de pagamento ── */}
      <Drawer
        open={!!payItem}
        onClose={() => setPayItem(null)}
        title="Registrar Pagamento"
        icon={Check}
        footer={
          <div className="flex gap-3">
            <button onClick={() => setPayItem(null)} disabled={paySaving}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={payPayable} disabled={!payAmount || Number(payAmount) <= 0 || paySaving}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${paySaved ? 'bg-emerald-500 text-white' : 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50'}`}>
              {paySaving ? <Loader2 className="w-4 h-4 animate-spin" /> : paySaved ? <Check className="w-4 h-4" /> : <Check className="w-4 h-4" />}
              {paySaving ? 'Registrando…' : paySaved ? 'Registrado!' : 'Confirmar Pagamento'}
            </button>
          </div>
        }
      >
        {payItem && (
          <DrawerCard title="Pagamento" icon={DollarSign}>
            <p className="text-xs text-gray-500 dark:text-gray-400">{payItem.description} — <strong>{payItem.creditor_name}</strong></p>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Valor Pago *</label>
              <input type="number" min={0.01} step={0.01} value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none" />
            </div>
            <SelectDropdown label="Forma de Pagamento" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
              {PAYMENT_METHODS.filter((m) => m.value).map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </SelectDropdown>
          </DrawerCard>
        )}
      </Drawer>
    </PermissionGate>
  );
}
