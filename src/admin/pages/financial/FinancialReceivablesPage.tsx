/**
 * FinancialReceivablesPage — Contas a Receber (A/R Geral, Fase 8.5)
 *
 * Recebíveis de qualquer natureza (taxas, eventos, matrículas, avulsos).
 * Separado de financial_installments (mensalidades).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import type {
  FinancialReceivable,
  ReceivableStatus,
  FinancialAccountCategory,
} from '../../types/admin.types';
import {
  RECEIVABLE_STATUS_LABELS,
  RECEIVABLE_STATUS_COLORS,
} from '../../types/admin.types';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import PermissionGate from '../../components/PermissionGate';
import { Drawer, DrawerCard } from '../../components/Drawer';
import {
  Loader2, Plus, TrendingUp, Check, Search,
  Pencil, Trash2, X, DollarSign, User, Calendar,
  Tag, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { SelectDropdown } from '../../components/FormField';

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

const RECURRENCE_OPTIONS = [
  { value: '',          label: 'Sem recorrência' },
  { value: 'monthly',   label: 'Mensal' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'yearly',    label: 'Anual' },
];

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}
function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
}

interface DrawerState {
  id?: string;
  payer_name: string;
  amount: string;
  account_category_id: string;
  description: string;
  due_date: string;
  payment_method: string;
  late_fee_pct: string;
  interest_rate_pct: string;
  total_installments: string;
  is_recurring: boolean;
  recurrence_interval: string;
  recurrence_end_date: string;
  notes: string;
}

const emptyDrawer = (): DrawerState => ({
  payer_name: '',
  amount: '',
  account_category_id: '',
  description: '',
  due_date: new Date().toISOString().slice(0, 10),
  payment_method: '',
  late_fee_pct: '2',
  interest_rate_pct: '0.0333',
  total_installments: '1',
  is_recurring: false,
  recurrence_interval: '',
  recurrence_end_date: '',
  notes: '',
});

export default function FinancialReceivablesPage() {
  const { profile } = useAdminAuth();
  const [items, setItems] = useState<FinancialReceivable[]>([]);
  const [categories, setCategories] = useState<FinancialAccountCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReceivableStatus | 'all'>('all');

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<DrawerState>(emptyDrawer());
  const [isNew, setIsNew] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pay drawer
  const [payItem, setPayItem] = useState<FinancialReceivable | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('pix');
  const [paySaving, setPaySaving] = useState(false);
  const [paySaved, setPaySaved] = useState(false);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [itemsRes, catRes] = await Promise.all([
      supabase
        .from('financial_receivables')
        .select('*, student:students(full_name), account_category:financial_account_categories(name, type)')
        .is('parent_id', null)  // mostrar apenas registros pai; parcelas são vistas no detalhe
        .order('due_date', { ascending: true }),
      supabase
        .from('financial_account_categories')
        .select('*')
        .eq('type', 'receita')
        .eq('is_active', true)
        .order('position'),
    ]);
    setItems((itemsRes.data ?? []) as unknown as FinancialReceivable[]);
    setCategories((catRes.data ?? []) as FinancialAccountCategory[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter((item) => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!item.payer_name.toLowerCase().includes(q) && !item.description.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // KPIs
  const totalPending = items.filter((i) => i.status === 'pending').reduce((s, i) => s + Number(i.amount), 0);
  const totalOverdue = items.filter((i) => i.status === 'overdue').reduce((s, i) => s + Number(i.amount), 0);
  const totalPaid = items.filter((i) => i.status === 'paid').reduce((s, i) => s + Number(i.amount_paid), 0);

  function openNew() {
    setForm(emptyDrawer());
    setIsNew(true);
    setDrawerOpen(true);
  }

  function openEdit(item: FinancialReceivable) {
    setForm({
      id: item.id,
      payer_name: item.payer_name,
      amount: String(item.amount),
      account_category_id: item.account_category_id ?? '',
      description: item.description,
      due_date: item.due_date,
      payment_method: item.payment_method ?? '',
      late_fee_pct: String(item.late_fee_pct),
      interest_rate_pct: String(item.interest_rate_pct),
      total_installments: String(item.total_installments ?? 1),
      is_recurring: item.is_recurring,
      recurrence_interval: item.recurrence_interval ?? '',
      recurrence_end_date: item.recurrence_end_date ?? '',
      notes: item.notes ?? '',
    });
    setIsNew(false);
    setDrawerOpen(true);
  }

  async function save() {
    if (!form.payer_name.trim() || !form.amount || !form.description.trim() || !form.due_date) return;
    setSaving(true);

    const payload = {
      payer_name: form.payer_name.trim(),
      amount: Number(form.amount),
      account_category_id: form.account_category_id || null,
      description: form.description.trim(),
      due_date: form.due_date,
      payment_method: form.payment_method || null,
      late_fee_pct: Number(form.late_fee_pct) || 0,
      interest_rate_pct: Number(form.interest_rate_pct) || 0,
      total_installments: Number(form.total_installments) || 1,
      is_recurring: form.is_recurring,
      recurrence_interval: form.recurrence_interval || null,
      recurrence_end_date: form.recurrence_end_date || null,
      notes: form.notes.trim() || null,
      created_by: profile?.id ?? null,
    };

    if (isNew) {
      const { data } = await supabase.from('financial_receivables').insert(payload).select('id').single();
      // Gerar parcelas se > 1
      if (data?.id && Number(form.total_installments) > 1) {
        await supabase.rpc('generate_receivable_installments', { p_receivable_id: data.id });
      }
      logAudit({ action: 'create', module: 'financial-receivables', description: `A/R criado: ${payload.description}` });
    } else if (form.id) {
      await supabase.from('financial_receivables').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', form.id);
      logAudit({ action: 'update', module: 'financial-receivables', description: `A/R atualizado: ${payload.description}` });
    }

    setSaving(false);
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => { setSaved(false); setDrawerOpen(false); load(); }, 900);
  }

  async function deleteItem(id: string) {
    const item = items.find((i) => i.id === id);
    await supabase.from('financial_receivables').delete().eq('id', id);
    logAudit({ action: 'delete', module: 'financial-receivables', description: `A/R excluído: ${item?.description}` });
    setDeleteId(null);
    load();
  }

  async function payReceivable() {
    if (!payItem || !payAmount || Number(payAmount) <= 0) return;
    setPaySaving(true);
    const amountPaid = Number(payAmount);
    const total = Number(payItem.amount);
    const newStatus: ReceivableStatus = amountPaid >= total ? 'paid' : 'partial';
    await supabase.from('financial_receivables').update({
      status: newStatus,
      amount_paid: amountPaid,
      payment_method: payMethod || null,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', payItem.id);
    logAudit({ action: 'update', module: 'financial-receivables', description: `Baixa A/R: ${payItem.description}` });
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
    <PermissionGate moduleKey="financial-receivables">
      <div className="space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'A Receber', value: totalPending, color: 'text-blue-600' },
            { label: 'Vencido', value: totalOverdue, color: 'text-red-500' },
            { label: 'Recebido', value: totalPaid, color: 'text-emerald-600' },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-gray-50 dark:bg-gray-900/40 rounded-xl px-4 py-3">
              <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide">{kpi.label}</p>
              <p className={`text-sm font-bold mt-0.5 ${kpi.color}`}>{fmt(kpi.value)}</p>
            </div>
          ))}
        </div>

        {/* Filtros + ação */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-40">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ReceivableStatus | 'all')}
            className="px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:border-brand-primary outline-none"
          >
            <option value="all">Todos os status</option>
            {(Object.entries(RECEIVABLE_STATUS_LABELS) as [ReceivableStatus, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <button
            onClick={openNew}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs bg-brand-primary text-white rounded-xl hover:bg-brand-primary-dark transition-colors font-medium"
          >
            <Plus className="w-3 h-3" /> Novo Lançamento
          </button>
        </div>

        {/* Lista */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma conta a receber encontrada.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-700"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{item.description}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${RECEIVABLE_STATUS_COLORS[item.status]}`}>
                      {RECEIVABLE_STATUS_LABELS[item.status]}
                    </span>
                    {item.total_installments && item.total_installments > 1 && (
                      <span className="text-[10px] text-gray-400">{item.total_installments}x</span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {item.payer_name} · Venc. {fmtDate(item.due_date)}
                    {item.account_category && ` · ${item.account_category.name}`}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-gray-800 dark:text-white">{fmt(item.amount)}</p>
                  {item.amount_paid > 0 && item.status !== 'paid' && (
                    <p className="text-[10px] text-emerald-600">Pago: {fmt(item.amount_paid)}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {item.status !== 'paid' && item.status !== 'cancelled' && (
                    <button
                      onClick={() => { setPayItem(item); setPayAmount(String(item.amount)); setPayMethod('pix'); }}
                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                      title="Registrar baixa"
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
            ))}
          </div>
        )}
      </div>

      {/* ── Drawer: Criar / Editar A/R ── */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={isNew ? 'Novo Lançamento a Receber' : 'Editar Lançamento'}
        icon={TrendingUp}
        footer={
          <div className="flex gap-3">
            <button onClick={() => setDrawerOpen(false)} disabled={saving}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={save} disabled={!form.payer_name.trim() || !form.amount || !form.description.trim() || saving}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${saved ? 'bg-emerald-500 text-white' : 'bg-brand-primary text-white hover:bg-brand-primary-dark disabled:opacity-50'}`}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
              {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Salvar'}
            </button>
          </div>
        }
      >
        <DrawerCard title="Pagante" icon={User}>
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Nome do Pagante *</label>
            <input value={form.payer_name} onChange={(e) => setForm({ ...form, payer_name: e.target.value })} placeholder="Nome do pagante"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary outline-none" />
          </div>
        </DrawerCard>

        <DrawerCard title="Lançamento" icon={DollarSign}>
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Descrição *</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex: Taxa de matrícula"
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
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Parcelas</label>
              <input type="number" min={1} max={60} value={form.total_installments} onChange={(e) => setForm({ ...form, total_installments: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none" />
            </div>
            <SelectDropdown label="Forma de Pagamento" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
              {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </SelectDropdown>
          </div>
          <SelectDropdown label="Categoria" value={form.account_category_id} onChange={(e) => setForm({ ...form, account_category_id: e.target.value })}>
            <option value="">Sem categoria</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectDropdown>
        </DrawerCard>

        <DrawerCard title="Juros e Multa" icon={Tag}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Multa (%)</label>
              <input type="number" min={0} step={0.01} value={form.late_fee_pct} onChange={(e) => setForm({ ...form, late_fee_pct: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Juros ao dia (%)</label>
              <input type="number" min={0} step={0.0001} value={form.interest_rate_pct} onChange={(e) => setForm({ ...form, interest_rate_pct: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none" />
            </div>
          </div>
        </DrawerCard>

        <DrawerCard title="Recorrência" icon={Calendar}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Cobrança Recorrente</span>
            <button onClick={() => setForm({ ...form, is_recurring: !form.is_recurring })}>
              {form.is_recurring
                ? <ToggleRight className="w-7 h-7 text-emerald-500" />
                : <ToggleLeft className="w-7 h-7 text-gray-300 dark:text-gray-600" />}
            </button>
          </div>
          {form.is_recurring && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <SelectDropdown label="Intervalo" value={form.recurrence_interval} onChange={(e) => setForm({ ...form, recurrence_interval: e.target.value })}>
                {RECURRENCE_OPTIONS.filter((o) => o.value).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
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

      {/* ── Drawer: Baixa ── */}
      <Drawer
        open={!!payItem}
        onClose={() => setPayItem(null)}
        title="Registrar Recebimento"
        icon={Check}
        footer={
          <div className="flex gap-3">
            <button onClick={() => setPayItem(null)} disabled={paySaving}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={payReceivable} disabled={!payAmount || Number(payAmount) <= 0 || paySaving}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${paySaved ? 'bg-emerald-500 text-white' : 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50'}`}>
              {paySaving ? <Loader2 className="w-4 h-4 animate-spin" /> : paySaved ? <Check className="w-4 h-4" /> : <Check className="w-4 h-4" />}
              {paySaving ? 'Registrando…' : paySaved ? 'Registrado!' : 'Confirmar Recebimento'}
            </button>
          </div>
        }
      >
        {payItem && (
          <DrawerCard title="Pagamento" icon={DollarSign}>
            <p className="text-xs text-gray-500 dark:text-gray-400">{payItem.description} — <strong>{payItem.payer_name}</strong></p>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Valor Recebido *</label>
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
