import { useState, useCallback } from 'react';
import { supabase } from '../../../../lib/supabase';
import { BarChart3, Download, Loader2 } from 'lucide-react';

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

interface Stats {
  revenue: number;
  orderCount: number;
  avgTicket: number;
  returnCount: number;
}

interface OrderRow {
  id: string;
  order_number: string;
  total_amount: number;
  status: string;
  payment_method: string | null;
  created_at: string;
}

export default function RelatoriosLojaTab() {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [from, setFrom] = useState(monthStart);
  const [to, setTo]     = useState(today);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('store_orders')
      .select('id, order_number, total_amount, status, payment_method, created_at')
      .gte('created_at', from + 'T00:00:00')
      .lte('created_at', to + 'T23:59:59');

    const orders = (data ?? []) as OrderRow[];
    const completed = orders.filter((o) => o.status === 'completed');
    const revenue = completed.reduce((s, o) => s + Number(o.total_amount), 0);
    setStats({
      revenue,
      orderCount: orders.length,
      avgTicket: completed.length > 0 ? revenue / completed.length : 0,
      returnCount: orders.filter((o) => o.status === 'cancelled').length,
    });
    setLoading(false);
  }, [from, to]);

  const exportCSV = useCallback(async () => {
    const { data } = await supabase
      .from('store_orders')
      .select('order_number, status, total_amount, payment_method, created_at')
      .gte('created_at', from + 'T00:00:00')
      .lte('created_at', to + 'T23:59:59');

    if (!data) return;
    const header = 'Número,Status,Total,Pagamento,Data';
    const rows = data.map((o) =>
      `${o.order_number},${o.status},${o.total_amount},${o.payment_method ?? ''},${new Date(o.created_at).toLocaleString('pt-BR')}`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pedidos-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [from, to]);

  const kpis = stats ? [
    { label: 'Receita (concluídos)', value: formatCurrency(stats.revenue) },
    { label: 'Total de Pedidos',     value: String(stats.orderCount) },
    { label: 'Ticket Médio',         value: formatCurrency(stats.avgTicket) },
    { label: 'Cancelamentos',        value: String(stats.returnCount) },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">De</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Até</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white" />
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-brand-primary-dark text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Filtrar
        </button>
        <button onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((k) => (
            <div key={k.label} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{k.value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{k.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Charts placeholder */}
      <div className="flex flex-col items-center justify-center py-12 gap-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
        <BarChart3 className="w-10 h-10 text-gray-300" />
        <p className="text-sm text-gray-400">Gráficos em desenvolvimento</p>
      </div>
    </div>
  );
}
