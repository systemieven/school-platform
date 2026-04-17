import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { DollarSign, ShoppingCart, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import OrderStatusBadge from '../../../../components/loja/OrderStatusBadge';
import type { StoreOrderStatus } from '../../../types/admin.types';

interface Stats {
  monthRevenue: number;
  ordersToday: number;
  pendingOrders: number;
  stockAlerts: number;
}

interface StatusCount {
  status: StoreOrderStatus;
  count: number;
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

export default function LojaDashboardTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [statusCounts, setStatusCounts] = useState<StatusCount[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

    const [ordersRes, variantsRes] = await Promise.all([
      supabase.from('store_orders').select('status, total_amount, created_at'),
      supabase
        .from('store_product_variants')
        .select('stock_quantity, min_stock')
        .gt('min_stock', 0),
    ]);

    const orders = ordersRes.data ?? [];
    const variants = variantsRes.data ?? [];

    const monthRevenue = orders
      .filter((o) => o.status === 'completed' && o.created_at >= monthStart)
      .reduce((s: number, o: { total_amount: number }) => s + (Number(o.total_amount) || 0), 0);

    const ordersToday = orders.filter(
      (o) => o.created_at >= todayStart && o.created_at < todayEnd
    ).length;

    const pendingStatuses: StoreOrderStatus[] = ['pending_payment', 'payment_confirmed', 'picking'];
    const pendingOrders = orders.filter((o) =>
      pendingStatuses.includes(o.status as StoreOrderStatus)
    ).length;

    const stockAlerts = variants.filter(
      (v) => (v.stock_quantity ?? 0) <= (v.min_stock ?? 0)
    ).length;

    setStats({ monthRevenue, ordersToday, pendingOrders, stockAlerts });

    // Status counts for active pipeline
    const pipelineStatuses: StoreOrderStatus[] = ['pending_payment', 'payment_confirmed', 'picking', 'ready_for_pickup'];
    const counts: StatusCount[] = pipelineStatuses.map((status) => ({
      status,
      count: orders.filter((o) => o.status === status).length,
    }));
    setStatusCounts(counts);

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  const kpis = [
    { label: 'Faturamento do Mês', value: formatCurrency(stats?.monthRevenue ?? 0), icon: DollarSign, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Pedidos Hoje',       value: String(stats?.ordersToday ?? 0),           icon: ShoppingCart, color: 'text-blue-600 bg-blue-50' },
    { label: 'Pedidos Pendentes',  value: String(stats?.pendingOrders ?? 0),          icon: Clock,       color: 'text-amber-600 bg-amber-50' },
    { label: 'Alertas de Estoque', value: String(stats?.stockAlerts ?? 0),            icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
  ];

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${k.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{k.value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{k.label}</p>
            </div>
          );
        })}
      </div>

      {/* Pipeline summary */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Pipeline de Pedidos</h3>
        <div className="space-y-2">
          {statusCounts.map(({ status, count }) => (
            <div key={status} className="flex items-center justify-between py-2.5 px-3 bg-gray-50 dark:bg-gray-700/40 rounded-xl hover:shadow-md transition-shadow duration-200">
              <OrderStatusBadge status={status} />
              <span className="text-sm font-semibold text-gray-800 dark:text-white">
                {count} {count === 1 ? 'pedido' : 'pedidos'}
              </span>
            </div>
          ))}
          {statusCounts.every((s) => s.count === 0) && (
            <p className="text-sm text-gray-400 text-center py-4">Nenhum pedido ativo no momento</p>
          )}
        </div>
      </div>
    </div>
  );
}
