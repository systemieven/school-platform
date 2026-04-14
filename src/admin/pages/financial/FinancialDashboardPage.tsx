import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  DollarSign, TrendingUp, TrendingDown, AlertTriangle,
  Users, Loader2,
} from 'lucide-react';

interface Stats {
  totalContracts: number;
  activeContracts: number;
  totalInstallments: number;
  pendingAmount: number;
  overdueAmount: number;
  paidAmount: number;
  overdueCount: number;
  paidCount: number;
}

export default function FinancialDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    const [contractsRes, installmentsRes] = await Promise.all([
      supabase.from('financial_contracts').select('id, status'),
      supabase.from('financial_installments').select('status, amount, paid_amount'),
    ]);

    const contracts = contractsRes.data ?? [];
    const installments = installmentsRes.data ?? [];

    const s: Stats = {
      totalContracts: contracts.length,
      activeContracts: contracts.filter((c) => c.status === 'active').length,
      totalInstallments: installments.length,
      pendingAmount: 0,
      overdueAmount: 0,
      paidAmount: 0,
      overdueCount: 0,
      paidCount: 0,
    };

    for (const inst of installments) {
      const amount = Number(inst.amount) || 0;
      const paid = Number(inst.paid_amount) || 0;
      if (inst.status === 'paid') { s.paidAmount += paid; s.paidCount++; }
      else if (inst.status === 'overdue') { s.overdueAmount += amount; s.overdueCount++; }
      else if (inst.status === 'pending') { s.pendingAmount += amount; }
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
    { label: 'Contratos ativos', value: String(stats.activeContracts), icon: Users, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20', sub: `${stats.totalContracts} total` },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
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
    </div>
  );
}
