/**
 * FinancialReportsPage
 *
 * Relatórios financeiros gerenciais com 5 sub-tabs:
 *   1. Fluxo de Caixa  — consolidado (receivables + payables + caixa + mensalidades)
 *   2. DRE Simplificado — receitas e despesas por categoria
 *   3. Inadimplência   — receivables + mensalidades vencidos em aberto
 *   4. Previsão        — A/R e A/P pendentes agrupados por mês
 *   5. Extrato         — movimentações por categoria / forma de pagamento
 */
import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3, TrendingUp, TrendingDown, AlertTriangle,
  CalendarRange, Download, Loader2, RefreshCcw,
  ArrowUpRight, ArrowDownLeft, Minus, ChevronDown, ChevronRight,
  CircleDollarSign, Activity, Building2,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import PermissionGate from '../../components/PermissionGate';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CashFlowEntry {
  entry_date: string;
  direction: 'entrada' | 'saida';
  amount: number;
  description: string;
  category_name: string | null;
  payment_method: string | null;
  source: string;
}

interface DreRow {
  account_type: string;
  parent_category: string;
  category: string;
  total: number;
  entry_count: number;
}

interface DelinquencyEntry {
  id: string;
  payer_name: string;
  source: 'receivable' | 'installment';
  amount_open: number;
  due_date: string;
  days_overdue: number;
  description: string;
  student_id: string | null;
  payment_method: string | null;
}

interface ForecastMonth {
  month: string; // YYYY-MM
  receivable_amount: number;
  payable_amount: number;
  net: number;
  receivable_count: number;
  payable_count: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(d: string) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function monthLabel(ym: string) {
  const [y, m] = ym.split('-');
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${months[parseInt(m, 10) - 1]}/${y}`;
}

function isoToYYYYMM(d: string) {
  return d.slice(0, 7);
}

function exportCSV(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(';'),
    ...rows.map((r) => headers.map((h) => String(r[h] ?? '')).join(';')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Sub-tab definitions ───────────────────────────────────────────────────────

const SUBTABS = [
  { key: 'cashflow',      label: 'Fluxo de Caixa',    shortLabel: 'Fluxo',     icon: Activity },
  { key: 'dre',          label: 'DRE Simplificado',   shortLabel: 'DRE',       icon: BarChart3 },
  { key: 'delinquency',  label: 'Inadimplência',       shortLabel: 'Inadimp.',  icon: AlertTriangle },
  { key: 'forecast',     label: 'Previsão Financeira', shortLabel: 'Previsão',  icon: CalendarRange },
  { key: 'extract',      label: 'Extrato',             shortLabel: 'Extrato',   icon: CircleDollarSign },
  { key: 'fornecedores', label: 'Fornecedores',        shortLabel: 'Fornec.',   icon: Building2 },
] as const;

type SubTabKey = typeof SUBTABS[number]['key'];

// ── Component ─────────────────────────────────────────────────────────────────

export default function FinancialReportsPage() {
  const [activeTab, setActiveTab] = useState<SubTabKey>('cashflow');
  const [loading, setLoading] = useState(false);

  // Date range (default: current month)
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10));

  // Data
  const [cashFlow, setCashFlow] = useState<CashFlowEntry[]>([]);
  const [dreRows, setDreRows] = useState<DreRow[]>([]);
  const [delinquency, setDelinquency] = useState<DelinquencyEntry[]>([]);
  const [forecast, setForecast] = useState<ForecastMonth[]>([]);

  // Fornecedores report state
  interface FornVolumeRow { fornecedor_id: string; razao_social: string; nome_fantasia: string | null; total: number; count: number; }
  interface FornPayableRow { id: string; description: string; amount: number; amount_paid: number; due_date: string; status: string; creditor_name: string; fornecedor_id: string; razao_social: string; nome_fantasia: string | null; }
  interface FornNfeRow { id: string; chave_acesso: string; data_emissao: string; valor_total: number; fornecedor_id: string; razao_social: string; nome_fantasia: string | null; }
  const [fornVolume, setFornVolume] = useState<FornVolumeRow[]>([]);
  const [fornPayables, setFornPayables] = useState<FornPayableRow[]>([]);
  const [fornNfe, setFornNfe] = useState<FornNfeRow[]>([]);
  const [fornInactive, setFornInactive] = useState<{ id: string; razao_social: string; nome_fantasia: string | null; cnpj_cpf: string }[]>([]);
  const [fornReportLoading, setFornReportLoading] = useState(false);

  // Filters
  const [cfDirection, setCfDirection] = useState<'all' | 'entrada' | 'saida'>('all');
  const [dreCollapsed, setDreCollapsed] = useState<Set<string>>(new Set());

  // ── Load logic ─────────────────────────────────────────────────────────────

  const loadCashFlow = useCallback(async () => {
    const { data } = await supabase
      .from('financial_cash_flow_view')
      .select('*')
      .gte('entry_date', startDate)
      .lte('entry_date', endDate)
      .order('entry_date', { ascending: false })
      .limit(500);
    setCashFlow((data ?? []) as CashFlowEntry[]);
  }, [startDate, endDate]);

  const loadDre = useCallback(async () => {
    // Query receivables, payables, installments directly for date-range DRE
    const [recRes, payRes, instRes] = await Promise.all([
      supabase
        .from('financial_receivables')
        .select('account_category_id, amount_paid, paid_at, financial_account_categories(name, type, parent_id, financial_account_categories(name))')
        .in('status', ['paid', 'partial'])
        .gte('paid_at', startDate)
        .lte('paid_at', endDate + 'T23:59:59'),
      supabase
        .from('financial_payables')
        .select('account_category_id, amount_paid, paid_at, financial_account_categories(name, type, parent_id, financial_account_categories(name))')
        .eq('status', 'paid')
        .gte('paid_at', startDate)
        .lte('paid_at', endDate + 'T23:59:59'),
      supabase
        .from('financial_installments')
        .select('paid_amount, paid_at')
        .eq('status', 'paid')
        .gte('paid_at', startDate)
        .lte('paid_at', endDate + 'T23:59:59')
        .gt('paid_amount', 0),
    ]);

    const rows: DreRow[] = [];

    // Mensalidades (installments) — fixed category
    const installTotal = ((instRes.data ?? []) as { paid_amount: number }[])
      .reduce((s, r) => s + (r.paid_amount || 0), 0);
    if (installTotal > 0) {
      rows.push({
        account_type: 'receita',
        parent_category: 'Mensalidades',
        category: 'Mensalidades',
        total: installTotal,
        entry_count: instRes.data?.length ?? 0,
      });
    }

    // Receivables
    type RecRow = {
      amount_paid: number;
      financial_account_categories: {
        name: string;
        type: string;
        parent_id: string | null;
        financial_account_categories: { name: string } | null;
      } | null;
    };
    ((recRes.data ?? []) as unknown as RecRow[]).forEach((r) => {
      const cat = r.financial_account_categories;
      const catName = cat?.name ?? 'Sem categoria';
      const parentName = (cat?.financial_account_categories as { name: string } | null)?.name ?? catName;
      const type = cat?.type ?? 'receita';
      const existing = rows.find((x) => x.category === catName && x.account_type === type);
      if (existing) {
        existing.total += r.amount_paid || 0;
        existing.entry_count += 1;
      } else {
        rows.push({ account_type: type, parent_category: parentName, category: catName, total: r.amount_paid || 0, entry_count: 1 });
      }
    });

    // Payables
    type PayRow = {
      amount_paid: number;
      financial_account_categories: {
        name: string;
        type: string;
        parent_id: string | null;
        financial_account_categories: { name: string } | null;
      } | null;
    };
    ((payRes.data ?? []) as unknown as PayRow[]).forEach((r) => {
      const cat = r.financial_account_categories;
      const catName = cat?.name ?? 'Sem categoria';
      const parentName = (cat?.financial_account_categories as { name: string } | null)?.name ?? catName;
      const type = cat?.type ?? 'despesa';
      const existing = rows.find((x) => x.category === catName && x.account_type === type);
      if (existing) {
        existing.total += r.amount_paid || 0;
        existing.entry_count += 1;
      } else {
        rows.push({ account_type: type, parent_category: parentName, category: catName, total: r.amount_paid || 0, entry_count: 1 });
      }
    });

    // Sort: receita first, then despesa; by parent then category
    rows.sort((a, b) => {
      if (a.account_type !== b.account_type) return a.account_type === 'receita' ? -1 : 1;
      if (a.parent_category !== b.parent_category) return a.parent_category.localeCompare(b.parent_category);
      return a.category.localeCompare(b.category);
    });

    setDreRows(rows);
  }, [startDate, endDate]);

  const loadDelinquency = useCallback(async () => {
    const { data } = await supabase
      .from('financial_delinquency_view')
      .select('*')
      .order('days_overdue', { ascending: false })
      .limit(300);
    setDelinquency((data ?? []) as DelinquencyEntry[]);
  }, []);

  const loadForecast = useCallback(async () => {
    const threeMonthsOut = new Date(today);
    threeMonthsOut.setMonth(threeMonthsOut.getMonth() + 3);

    const [recRes, payRes, instRes] = await Promise.all([
      supabase
        .from('financial_receivables')
        .select('amount, due_date')
        .in('status', ['pending', 'partial'])
        .gte('due_date', today.toISOString().slice(0, 10))
        .lte('due_date', threeMonthsOut.toISOString().slice(0, 10)),
      supabase
        .from('financial_payables')
        .select('amount, due_date')
        .eq('status', 'pending')
        .gte('due_date', today.toISOString().slice(0, 10))
        .lte('due_date', threeMonthsOut.toISOString().slice(0, 10)),
      supabase
        .from('financial_installments')
        .select('total_due, paid_amount, due_date')
        .in('status', ['pending', 'partial'])
        .gte('due_date', today.toISOString().slice(0, 10))
        .lte('due_date', threeMonthsOut.toISOString().slice(0, 10)),
    ]);

    const byMonth: Record<string, ForecastMonth> = {};
    function ensureMonth(ym: string) {
      if (!byMonth[ym]) byMonth[ym] = { month: ym, receivable_amount: 0, payable_amount: 0, net: 0, receivable_count: 0, payable_count: 0 };
    }

    type RecItem = { amount: number; due_date: string };
    ((recRes.data ?? []) as RecItem[]).forEach((r) => {
      const ym = isoToYYYYMM(r.due_date);
      ensureMonth(ym);
      byMonth[ym].receivable_amount += r.amount;
      byMonth[ym].receivable_count += 1;
    });

    type InstItem = { total_due: number; paid_amount: number; due_date: string };
    ((instRes.data ?? []) as InstItem[]).forEach((r) => {
      const ym = isoToYYYYMM(r.due_date);
      ensureMonth(ym);
      const open = r.total_due - (r.paid_amount || 0);
      byMonth[ym].receivable_amount += open;
      byMonth[ym].receivable_count += 1;
    });

    type PayItem = { amount: number; due_date: string };
    ((payRes.data ?? []) as PayItem[]).forEach((r) => {
      const ym = isoToYYYYMM(r.due_date);
      ensureMonth(ym);
      byMonth[ym].payable_amount += r.amount;
      byMonth[ym].payable_count += 1;
    });

    const result = Object.values(byMonth).map((m) => ({
      ...m,
      net: m.receivable_amount - m.payable_amount,
    }));
    result.sort((a, b) => a.month.localeCompare(b.month));
    setForecast(result);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadFornecedoresReport = useCallback(async () => {
    setFornReportLoading(true);
    // 1. Volume por fornecedor (A/P pago no período)
    const { data: payData } = await supabase
      .from('financial_payables')
      .select('fornecedor_id, amount_paid, description, amount, due_date, status, creditor_name, fornecedor:fornecedores(razao_social,nome_fantasia)')
      .not('fornecedor_id', 'is', null)
      .gte('due_date', startDate)
      .lte('due_date', endDate)
      .is('parent_id', null);

    type PayRaw = { fornecedor_id: string; amount_paid: number | null; description: string; amount: number; due_date: string; status: string; creditor_name: string; fornecedor: { razao_social: string; nome_fantasia: string | null } | null };
    const rows = (payData ?? []) as unknown as PayRaw[];

    // Aggregate volume
    const volMap = new Map<string, { razao_social: string; nome_fantasia: string | null; total: number; count: number }>();
    for (const r of rows) {
      if (!r.fornecedor_id || !r.fornecedor) continue;
      const cur = volMap.get(r.fornecedor_id) ?? { razao_social: r.fornecedor.razao_social, nome_fantasia: r.fornecedor.nome_fantasia, total: 0, count: 0 };
      cur.total += Number(r.amount_paid ?? r.amount);
      cur.count += 1;
      volMap.set(r.fornecedor_id, cur);
    }
    setFornVolume(Array.from(volMap.entries())
      .map(([id, v]) => ({ fornecedor_id: id, ...v }))
      .sort((a, b) => b.total - a.total));

    // All payables (for per-supplier A/P report)
    setFornPayables(rows.map((r) => ({
      id: r.fornecedor_id,
      description: r.description,
      amount: r.amount,
      amount_paid: r.amount_paid ?? 0,
      due_date: r.due_date,
      status: r.status,
      creditor_name: r.creditor_name,
      fornecedor_id: r.fornecedor_id,
      razao_social: r.fornecedor?.razao_social ?? '',
      nome_fantasia: r.fornecedor?.nome_fantasia ?? null,
    })));

    // NF-e por fornecedor
    const { data: nfeData } = await supabase
      .from('nfe_entries')
      .select('id, chave_acesso, data_emissao, valor_total, fornecedor_id, fornecedor:fornecedores(razao_social,nome_fantasia)')
      .not('fornecedor_id', 'is', null)
      .gte('data_emissao', startDate)
      .lte('data_emissao', endDate);

    type NfeRaw = { id: string; chave_acesso: string; data_emissao: string; valor_total: number; fornecedor_id: string; fornecedor: { razao_social: string; nome_fantasia: string | null } | null };
    setFornNfe(((nfeData ?? []) as unknown as NfeRaw[]).map((r) => ({
      id: r.id,
      chave_acesso: r.chave_acesso,
      data_emissao: r.data_emissao,
      valor_total: r.valor_total,
      fornecedor_id: r.fornecedor_id,
      razao_social: r.fornecedor?.razao_social ?? '',
      nome_fantasia: r.fornecedor?.nome_fantasia ?? null,
    })));

    // Fornecedores sem movimentação (últimos 90 dias)
    const cutoff = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const { data: allForn } = await supabase
      .from('fornecedores')
      .select('id, razao_social, nome_fantasia, cnpj_cpf')
      .eq('status', 'ativo');
    const { data: activePayForn } = await supabase
      .from('financial_payables')
      .select('fornecedor_id')
      .not('fornecedor_id', 'is', null)
      .gte('due_date', cutoff);
    const { data: activeNfeForn } = await supabase
      .from('nfe_entries')
      .select('fornecedor_id')
      .not('fornecedor_id', 'is', null)
      .gte('data_emissao', cutoff);
    const activeIds = new Set([
      ...((activePayForn ?? []) as { fornecedor_id: string }[]).map((r) => r.fornecedor_id),
      ...((activeNfeForn ?? []) as { fornecedor_id: string }[]).map((r) => r.fornecedor_id),
    ]);
    setFornInactive(((allForn ?? []) as { id: string; razao_social: string; nome_fantasia: string | null; cnpj_cpf: string }[])
      .filter((f) => !activeIds.has(f.id)));

    setFornReportLoading(false);
  }, [startDate, endDate]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadCashFlow(), loadDre(), loadDelinquency(), loadForecast()]);
    setLoading(false);
  }, [loadCashFlow, loadDre, loadDelinquency, loadForecast]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { if (activeTab === 'fornecedores') loadFornecedoresReport(); }, [activeTab, loadFornecedoresReport]);

  // ── Computed values ────────────────────────────────────────────────────────

  const cfFiltered = cfDirection === 'all' ? cashFlow : cashFlow.filter((r) => r.direction === cfDirection);
  const cfEntradas = cashFlow.filter((r) => r.direction === 'entrada').reduce((s, r) => s + r.amount, 0);
  const cfSaidas = cashFlow.filter((r) => r.direction === 'saida').reduce((s, r) => s + r.amount, 0);
  const cfSaldo = cfEntradas - cfSaidas;

  const dreReceitas = dreRows.filter((r) => r.account_type === 'receita').reduce((s, r) => s + r.total, 0);
  const dreDespesas = dreRows.filter((r) => r.account_type === 'despesa').reduce((s, r) => s + r.total, 0);
  const dreResult = dreReceitas - dreDespesas;

  const totalInadimplencia = delinquency.reduce((s, r) => s + r.amount_open, 0);

  function toggleDreGroup(key: string) {
    setDreCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // ── Render helpers ─────────────────────────────────────────────────────────

  function DateRangePicker() {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">De</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-600
                       bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200
                       focus:border-brand-primary outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">até</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-600
                       bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200
                       focus:border-brand-primary outline-none"
          />
        </div>
        <button
          onClick={loadAll}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                     bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark transition-colors"
        >
          <RefreshCcw className="w-3 h-3" /> Atualizar
        </button>
      </div>
    );
  }

  // ── Fluxo de Caixa tab ─────────────────────────────────────────────────────

  function CashFlowTab() {
    return (
      <div className="space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Entradas', value: cfEntradas, color: 'emerald', icon: ArrowUpRight },
            { label: 'Saídas', value: cfSaidas, color: 'red', icon: ArrowDownLeft },
            { label: 'Saldo', value: cfSaldo, color: cfSaldo >= 0 ? 'blue' : 'red', icon: Minus },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className={`p-4 bg-${color}-50 dark:bg-${color}-900/20 rounded-xl border border-${color}-100 dark:border-${color}-800`}>
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 text-${color}-600 dark:text-${color}-400`} />
                <p className={`text-xs font-medium text-${color}-700 dark:text-${color}-300`}>{label}</p>
              </div>
              <p className={`text-xl font-bold text-${color}-700 dark:text-${color}-200 mt-1`}>{fmt(value)}</p>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-900 rounded-xl p-1">
            {(['all', 'entrada', 'saida'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setCfDirection(d)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  cfDirection === d
                    ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {d === 'all' ? 'Todos' : d === 'entrada' ? 'Entradas' : 'Saídas'}
              </button>
            ))}
          </div>
          <button
            onClick={() => exportCSV('fluxo-de-caixa.csv', cfFiltered.map((r) => ({
              Data: r.entry_date,
              Tipo: r.direction,
              Valor: r.amount.toFixed(2),
              Descrição: r.description,
              Categoria: r.category_name ?? '',
              'Forma de Pagamento': r.payment_method ?? '',
              Origem: r.source,
            })))}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                       border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300
                       rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Download className="w-3 h-3" /> Exportar CSV
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">Data</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">Tipo</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">Descrição</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">Categoria</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">Forma</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {cfFiltered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    Nenhuma movimentação no período selecionado.
                  </td>
                </tr>
              ) : (
                cfFiltered.map((r, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{fmtDate(r.entry_date)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        r.direction === 'entrada'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                      }`}>
                        {r.direction === 'entrada' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                        {r.direction === 'entrada' ? 'Entrada' : 'Saída'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-800 dark:text-gray-200 max-w-[200px] truncate">{r.description}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{r.category_name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{r.payment_method ?? '—'}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${
                      r.direction === 'entrada' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {r.direction === 'entrada' ? '+' : '−'}{fmt(r.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── DRE tab ────────────────────────────────────────────────────────────────

  function DreTab() {
    // Group by account_type → parent_category
    const grouped: Record<string, { rows: DreRow[]; total: number }> = {};
    dreRows.forEach((r) => {
      const key = `${r.account_type}::${r.parent_category}`;
      if (!grouped[key]) grouped[key] = { rows: [], total: 0 };
      grouped[key].rows.push(r);
      grouped[key].total += r.total;
    });

    return (
      <div className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Receitas', value: dreReceitas, color: 'emerald', icon: TrendingUp },
            { label: 'Total Despesas', value: dreDespesas, color: 'red', icon: TrendingDown },
            { label: 'Resultado', value: dreResult, color: dreResult >= 0 ? 'blue' : 'red', icon: BarChart3 },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className={`p-4 bg-${color}-50 dark:bg-${color}-900/20 rounded-xl border border-${color}-100 dark:border-${color}-800`}>
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 text-${color}-600 dark:text-${color}-400`} />
                <p className={`text-xs font-medium text-${color}-700 dark:text-${color}-300`}>{label}</p>
              </div>
              <p className={`text-xl font-bold text-${color}-700 dark:text-${color}-200 mt-1`}>{fmt(value)}</p>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => exportCSV('dre.csv', dreRows.map((r) => ({
              Tipo: r.account_type,
              'Categoria Pai': r.parent_category,
              Categoria: r.category,
              Total: r.total.toFixed(2),
              Lançamentos: r.entry_count,
            })))}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                       border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300
                       rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Download className="w-3 h-3" /> Exportar CSV
          </button>
        </div>

        {dreRows.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Nenhum lançamento realizado no período.</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(grouped).map(([key, group]) => {
              const [accType, parentCat] = key.split('::');
              const isIncome = accType === 'receita';
              const isCollapsed = dreCollapsed.has(key);
              const pct = isIncome
                ? dreReceitas > 0 ? (group.total / dreReceitas) * 100 : 0
                : dreDespesas > 0 ? (group.total / dreDespesas) * 100 : 0;

              return (
                <div key={key} className="rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                  {/* Group header */}
                  <button
                    onClick={() => toggleDreGroup(key)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-900/70 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isCollapsed ? <ChevronRight className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        isIncome
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                      }`}>
                        {isIncome ? 'Receita' : 'Despesa'}
                      </span>
                      <span className="text-sm font-semibold text-gray-800 dark:text-white">{parentCat}</span>
                      <span className="text-[10px] text-gray-400">{pct.toFixed(1)}%</span>
                    </div>
                    <span className={`text-sm font-bold ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {fmt(group.total)}
                    </span>
                  </button>

                  {/* Progress bar */}
                  <div className="h-1 bg-gray-100 dark:bg-gray-800">
                    <div
                      className={`h-1 ${isIncome ? 'bg-emerald-400' : 'bg-red-400'}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>

                  {/* Rows */}
                  {!isCollapsed && (
                    <div className="divide-y divide-gray-50 dark:divide-gray-800">
                      {group.rows.map((r, idx) => (
                        <div key={idx} className="flex items-center justify-between px-8 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-900/20 transition-colors">
                          <div>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{r.category}</p>
                            <p className="text-[10px] text-gray-400">{r.entry_count} lançamento{r.entry_count !== 1 ? 's' : ''}</p>
                          </div>
                          <span className={`text-sm font-semibold ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                            {fmt(r.total)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Resultado final */}
            <div className={`p-4 rounded-xl border-2 ${dreResult >= 0 ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-700' : 'border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700'}`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-gray-800 dark:text-white">Resultado do Período</p>
                <p className={`text-xl font-bold ${dreResult >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {dreResult >= 0 ? '+' : ''}{fmt(dreResult)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Inadimplência tab ──────────────────────────────────────────────────────

  function DelinquencyTab() {
    const byBracket = {
      '1-30': delinquency.filter((r) => r.days_overdue >= 1 && r.days_overdue <= 30),
      '31-60': delinquency.filter((r) => r.days_overdue > 30 && r.days_overdue <= 60),
      '61-90': delinquency.filter((r) => r.days_overdue > 60 && r.days_overdue <= 90),
      '90+': delinquency.filter((r) => r.days_overdue > 90),
    };

    return (
      <div className="space-y-4">
        {/* KPI */}
        <div className="grid grid-cols-4 gap-3">
          {Object.entries(byBracket).map(([bracket, items]) => {
            const total = items.reduce((s, r) => s + r.amount_open, 0);
            return (
              <div key={bracket} className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800">
                <p className="text-[10px] font-semibold text-red-700 dark:text-red-300 uppercase tracking-wide">{bracket} dias</p>
                <p className="text-lg font-bold text-red-700 dark:text-red-200 mt-1">{fmt(total)}</p>
                <p className="text-[10px] text-red-500">{items.length} registro{items.length !== 1 ? 's' : ''}</p>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between">
          <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800">
            <span className="text-sm font-bold text-red-700 dark:text-red-300">Total inadimplente: {fmt(totalInadimplencia)}</span>
            <span className="text-xs text-red-500 ml-2">({delinquency.length} registros)</span>
          </div>
          <button
            onClick={() => exportCSV('inadimplencia.csv', delinquency.map((r) => ({
              Devedor: r.payer_name,
              Tipo: r.source === 'installment' ? 'Mensalidade' : 'A/R',
              Descrição: r.description,
              'Valor Aberto': r.amount_open.toFixed(2),
              Vencimento: r.due_date,
              'Dias Vencido': r.days_overdue,
            })))}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                       border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300
                       rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Download className="w-3 h-3" /> Exportar CSV
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">Devedor</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">Descrição</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">Vencimento</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400">Dias</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {delinquency.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    Nenhuma inadimplência registrada.
                  </td>
                </tr>
              ) : (
                delinquency.map((r, idx) => {
                  const bracket = r.days_overdue <= 30 ? 'amber' : r.days_overdue <= 60 ? 'orange' : 'red';
                  return (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{r.payer_name}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-[200px] truncate">{r.description}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{fmtDate(r.due_date)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-${bracket}-100 text-${bracket}-700 dark:bg-${bracket}-900/40 dark:text-${bracket}-300`}>
                          {r.days_overdue}d
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-red-600 dark:text-red-400">
                        {fmt(r.amount_open)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── Previsão tab ───────────────────────────────────────────────────────────

  function ForecastTab() {
    const totalRec = forecast.reduce((s, r) => s + r.receivable_amount, 0);
    const totalPay = forecast.reduce((s, r) => s + r.payable_amount, 0);
    const totalNet = totalRec - totalPay;
    const maxAbs = Math.max(...forecast.map((r) => Math.max(r.receivable_amount, r.payable_amount)), 1);

    return (
      <div className="space-y-4">
        <p className="text-xs text-gray-400">
          Previsão baseada em A/R e mensalidades pendentes para os próximos 3 meses.
        </p>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'A Receber', value: totalRec, color: 'emerald' },
            { label: 'A Pagar', value: totalPay, color: 'red' },
            { label: 'Saldo Previsto', value: totalNet, color: totalNet >= 0 ? 'blue' : 'red' },
          ].map(({ label, value, color }) => (
            <div key={label} className={`p-4 bg-${color}-50 dark:bg-${color}-900/20 rounded-xl border border-${color}-100 dark:border-${color}-800`}>
              <p className={`text-xs font-medium text-${color}-700 dark:text-${color}-300`}>{label}</p>
              <p className={`text-xl font-bold text-${color}-700 dark:text-${color}-200 mt-1`}>{fmt(value)}</p>
            </div>
          ))}
        </div>

        {forecast.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Nenhum lançamento pendente nos próximos 3 meses.</p>
        ) : (
          <div className="space-y-3">
            {forecast.map((m) => {
              const recPct = (m.receivable_amount / maxAbs) * 100;
              const payPct = (m.payable_amount / maxAbs) * 100;
              return (
                <div key={m.month} className="p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-gray-800 dark:text-white">{monthLabel(m.month)}</h3>
                    <span className={`text-sm font-bold ${m.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {m.net >= 0 ? '+' : ''}{fmt(m.net)}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 w-20 flex-shrink-0">A Receber</span>
                      <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-2 bg-emerald-400 rounded-full transition-all" style={{ width: `${recPct}%` }} />
                      </div>
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 w-24 text-right flex-shrink-0">
                        {fmt(m.receivable_amount)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 w-20 flex-shrink-0">A Pagar</span>
                      <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-2 bg-red-400 rounded-full transition-all" style={{ width: `${payPct}%` }} />
                      </div>
                      <span className="text-[11px] font-semibold text-red-600 dark:text-red-400 w-24 text-right flex-shrink-0">
                        {fmt(m.payable_amount)}
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">
                    {m.receivable_count} recebível{m.receivable_count !== 1 ? 's' : ''} · {m.payable_count} pagável{m.payable_count !== 1 ? 's' : ''}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Extrato tab ────────────────────────────────────────────────────────────

  function ExtractTab() {
    // Group cashFlow by category
    const byCategory: Record<string, { entries: number; total_in: number; total_out: number }> = {};
    cashFlow.forEach((r) => {
      const key = r.category_name ?? 'Sem categoria';
      if (!byCategory[key]) byCategory[key] = { entries: 0, total_in: 0, total_out: 0 };
      byCategory[key].entries += 1;
      if (r.direction === 'entrada') byCategory[key].total_in += r.amount;
      else byCategory[key].total_out += r.amount;
    });

    // Group by payment method
    const byMethod: Record<string, { entries: number; total_in: number; total_out: number }> = {};
    cashFlow.forEach((r) => {
      const key = r.payment_method ?? 'Não informado';
      if (!byMethod[key]) byMethod[key] = { entries: 0, total_in: 0, total_out: 0 };
      byMethod[key].entries += 1;
      if (r.direction === 'entrada') byMethod[key].total_in += r.amount;
      else byMethod[key].total_out += r.amount;
    });

    return (
      <div className="space-y-6">
        {/* By category */}
        <div>
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3">Por Categoria</h3>
          <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">Categoria</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400">Lançamentos</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">Entradas</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">Saídas</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {Object.entries(byCategory).length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Nenhum dado no período.</td></tr>
                ) : (
                  Object.entries(byCategory)
                    .sort((a, b) => (b[1].total_in + b[1].total_out) - (a[1].total_in + a[1].total_out))
                    .map(([cat, d]) => (
                      <tr key={cat} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                        <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{cat}</td>
                        <td className="px-4 py-3 text-center text-gray-500 dark:text-gray-400">{d.entries}</td>
                        <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">{fmt(d.total_in)}</td>
                        <td className="px-4 py-3 text-right text-red-600 dark:text-red-400">{fmt(d.total_out)}</td>
                        <td className={`px-4 py-3 text-right font-bold ${(d.total_in - d.total_out) >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                          {fmt(d.total_in - d.total_out)}
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* By payment method */}
        <div>
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3">Por Forma de Pagamento</h3>
          <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">Forma</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400">Lançamentos</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">Entradas</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">Saídas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {Object.entries(byMethod).length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Nenhum dado no período.</td></tr>
                ) : (
                  Object.entries(byMethod)
                    .sort((a, b) => (b[1].total_in + b[1].total_out) - (a[1].total_in + a[1].total_out))
                    .map(([method, d]) => (
                      <tr key={method} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                        <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200 capitalize">{method}</td>
                        <td className="px-4 py-3 text-center text-gray-500 dark:text-gray-400">{d.entries}</td>
                        <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">{fmt(d.total_in)}</td>
                        <td className="px-4 py-3 text-right text-red-600 dark:text-red-400">{fmt(d.total_out)}</td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => exportCSV('extrato-categorias.csv',
              Object.entries(byCategory).map(([cat, d]) => ({
                Categoria: cat,
                Lançamentos: d.entries,
                'Total Entradas': d.total_in.toFixed(2),
                'Total Saídas': d.total_out.toFixed(2),
                Saldo: (d.total_in - d.total_out).toFixed(2),
              }))
            )}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                       border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300
                       rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Download className="w-3 h-3" /> Exportar CSV
          </button>
        </div>
      </div>
    );
  }

  // ── Fornecedores tab ───────────────────────────────────────────────────────

  function FornecedoresTab() {
    const [subReport, setSubReport] = useState<'volume' | 'payables' | 'nfe' | 'inactive'>('volume');

    if (fornReportLoading) {
      return (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Sub-report selector */}
        <div className="flex items-center gap-1 flex-wrap">
          {([
            { key: 'volume',   label: 'Ranking por Volume' },
            { key: 'payables', label: 'A/P por Fornecedor' },
            { key: 'nfe',      label: 'NF-e por Fornecedor' },
            { key: 'inactive', label: 'Sem Movimentação (90d)' },
          ] as const).map((r) => (
            <button
              key={r.key}
              onClick={() => setSubReport(r.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                subReport === r.key
                  ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                  : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:border-gray-300'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Ranking por Volume */}
        {subReport === 'volume' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">Top fornecedores por valor total de compras no período selecionado.</p>
              <button
                onClick={() => exportCSV('fornecedores-volume.csv', fornVolume.map((r, i) => ({
                  Posição: i + 1,
                  Fornecedor: r.nome_fantasia ?? r.razao_social,
                  'Total (R$)': r.total.toFixed(2),
                  Lançamentos: r.count,
                })))}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Download className="w-3 h-3" /> Exportar CSV
              </button>
            </div>
            {fornVolume.length === 0 ? (
              <p className="text-center py-10 text-sm text-gray-400">Nenhum dado no período.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                      <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">#</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">Fornecedor</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400">Lançamentos</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">Total</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">Ticket Médio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {fornVolume.map((r, i) => (
                      <tr key={r.fornecedor_id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                        <td className="px-4 py-3 text-gray-400 font-mono">{i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="font-medium text-gray-800 dark:text-gray-200">{r.nome_fantasia ?? r.razao_social}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-500 dark:text-gray-400">{r.count}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-800 dark:text-gray-200">{fmt(r.total)}</td>
                        <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">{fmt(r.count > 0 ? r.total / r.count : 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* A/P por Fornecedor */}
        {subReport === 'payables' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">Contas a pagar vinculadas a fornecedores no período.</p>
            {fornPayables.length === 0 ? (
              <p className="text-center py-10 text-sm text-gray-400">Nenhum dado no período.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                      <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">Fornecedor</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">Descrição</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400">Vencimento</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400">Status</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {fornPayables.map((r, idx) => (
                      <tr key={`${r.fornecedor_id}-${idx}`} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                        <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{r.nome_fantasia ?? r.razao_social}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 truncate max-w-[180px]">{r.description}</td>
                        <td className="px-4 py-3 text-center text-gray-500 dark:text-gray-400">{fmtDate(r.due_date)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            r.status === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                            r.status === 'overdue' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                            'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          }`}>
                            {r.status === 'paid' ? 'Pago' : r.status === 'overdue' ? 'Vencido' : 'Pendente'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-800 dark:text-gray-200">{fmt(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* NF-e por Fornecedor */}
        {subReport === 'nfe' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">Notas fiscais de entrada vinculadas a fornecedores no período.</p>
            {fornNfe.length === 0 ? (
              <p className="text-center py-10 text-sm text-gray-400">Nenhum dado no período.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                      <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">Fornecedor</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">Chave (truncada)</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400">Emissão</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">Valor Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {fornNfe.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                        <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{r.nome_fantasia ?? r.razao_social}</td>
                        <td className="px-4 py-3 text-gray-400 font-mono truncate max-w-[140px]">{r.chave_acesso?.slice(-8) ?? '—'}</td>
                        <td className="px-4 py-3 text-center text-gray-500 dark:text-gray-400">{fmtDate(r.data_emissao)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-800 dark:text-gray-200">{fmt(r.valor_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Sem movimentação */}
        {subReport === 'inactive' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">Fornecedores ativos sem A/P nem NF-e vinculadas nos últimos 90 dias.</p>
            {fornInactive.length === 0 ? (
              <p className="text-center py-10 text-sm text-emerald-600 font-medium">Todos os fornecedores ativos têm movimentação recente.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                      <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">Fornecedor</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">CNPJ/CPF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {fornInactive.map((f) => (
                      <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                        <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{f.nome_fantasia ?? f.razao_social}</td>
                        <td className="px-4 py-3 text-gray-400 font-mono">{f.cnpj_cpf}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <PermissionGate moduleKey="financial-reports-advanced">
      <div className="space-y-5">
        {/* Date range + refresh */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <DateRangePicker />
          {loading && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Carregando...
            </div>
          )}
        </div>

        {/* Sub-tab bar */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-900 rounded-xl p-1 overflow-x-auto">
          {SUBTABS.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-white dark:bg-gray-700 text-brand-primary dark:text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <TabIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div>
          {activeTab === 'cashflow'      && <CashFlowTab />}
          {activeTab === 'dre'           && <DreTab />}
          {activeTab === 'delinquency'   && <DelinquencyTab />}
          {activeTab === 'forecast'      && <ForecastTab />}
          {activeTab === 'extract'       && <ExtractTab />}
          {activeTab === 'fornecedores'  && <FornecedoresTab />}
        </div>
      </div>
    </PermissionGate>
  );
}
