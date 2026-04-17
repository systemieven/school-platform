import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  DollarSign, TrendingUp, TrendingDown, AlertTriangle,
  Users, Loader2, Gavel,
} from 'lucide-react';
import DashboardChartGrid from '../../components/DashboardChartGrid';

interface Stats {
  totalContracts: number;
  activeContracts: number;
  totalInstallments: number;
  pendingAmount: number;
  overdueAmount: number;
  paidAmount: number;
  overdueCount: number;
  paidCount: number;
  extrajudicialAmount: number;
  extrajudicialCount: number;
}

interface InstallmentRow {
  status: string;
  amount: number | string;
  paid_amount: number | string | null;
  due_date: string;
  contract: { plan: { max_overdue_days: number } | null } | null;
}

export default function FinancialDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    const [contractsRes, installmentsRes] = await Promise.all([
      supabase.from('financial_contracts').select('id, status'),
      supabase
        .from('financial_installments')
        .select('status, amount, paid_amount, due_date, contract:financial_contracts!inner(plan:financial_plans(max_overdue_days))'),
    ]);

    const contracts = contractsRes.data ?? [];
    const installments = (installmentsRes.data ?? []) as unknown as InstallmentRow[];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const s: Stats = {
      totalContracts: contracts.length,
      activeContracts: contracts.filter((c) => c.status === 'active').length,
      totalInstallments: installments.length,
      pendingAmount: 0,
      overdueAmount: 0,
      paidAmount: 0,
      overdueCount: 0,
      paidCount: 0,
      extrajudicialAmount: 0,
      extrajudicialCount: 0,
    };

    for (const inst of installments) {
      const amount = Number(inst.amount) || 0;
      const paid = Number(inst.paid_amount) || 0;
      if (inst.status === 'paid') {
        s.paidAmount += paid;
        s.paidCount++;
        continue;
      }
      if (inst.status === 'overdue') {
        s.overdueAmount += amount;
        s.overdueCount++;

        // Verifica se passou do prazo máximo do portal → cobrança extrajudicial
        const maxOverdue = inst.contract?.plan?.max_overdue_days ?? 0;
        if (maxOverdue > 0) {
          const dueDate = new Date(inst.due_date + 'T00:00:00');
          const limitDate = new Date(dueDate);
          limitDate.setDate(limitDate.getDate() + maxOverdue);
          if (today > limitDate) {
            s.extrajudicialAmount += amount;
            s.extrajudicialCount++;
          }
        }
      } else if (inst.status === 'pending') {
        s.pendingAmount += amount;
      }
    }

    setStats(s);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function fmt(v: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    { label: 'Receita recebida', value: fmt(stats.paidAmount), icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', sub: `${stats.paidCount} parcelas pagas` },
    { label: 'A receber (pendente)', value: fmt(stats.pendingAmount), icon: DollarSign, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', sub: 'Parcelas pendentes' },
    { label: 'Inadimplência', value: fmt(stats.overdueAmount), icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', sub: `${stats.overdueCount} parcelas vencidas` },
    { label: 'Cobrança extrajudicial', value: fmt(stats.extrajudicialAmount), icon: Gavel, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', sub: `${stats.extrajudicialCount} parcelas bloqueadas` },
    { label: 'Contratos ativos', value: String(stats.activeContracts), icon: Users, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20', sub: `${stats.totalContracts} total` },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{card.label}</span>
              <div className={`p-2 rounded-xl ${card.bg}`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">{card.value}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Inadimplência alert */}
      {stats.overdueCount > 0 && (
        <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-300">Atenção: {stats.overdueCount} parcela{stats.overdueCount > 1 && 's'} vencida{stats.overdueCount > 1 && 's'}</p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">Total em atraso: {fmt(stats.overdueAmount)}</p>
          </div>
        </div>
      )}

      {/* Cobrança extrajudicial alert */}
      {stats.extrajudicialCount > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <Gavel className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              {stats.extrajudicialCount} parcela{stats.extrajudicialCount > 1 && 's'} em cobrança extrajudicial
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              Valor: {fmt(stats.extrajudicialAmount)} — pagamento bloqueado no portal, direcionar para cobrança
            </p>
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-gray-100 dark:border-gray-700 pt-2" />

      {/* Chart grid */}
      <DashboardChartGrid module="financeiro" />
    </div>
  );
}
