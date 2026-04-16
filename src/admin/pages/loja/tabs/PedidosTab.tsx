import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../../lib/supabase';
import { Loader2, CheckCircle } from 'lucide-react';
import OrderStatusBadge from '../../../../components/loja/OrderStatusBadge';
import type { StoreOrder, StoreOrderStatus } from '../../../types/admin.types';

type FilterStatus = 'all' | StoreOrderStatus;

const FILTER_TABS: { key: FilterStatus; label: string }[] = [
  { key: 'all',              label: 'Todos' },
  { key: 'pending_payment',  label: 'Ag. Pagamento' },
  { key: 'picking',          label: 'Em Separação' },
  { key: 'ready_for_pickup', label: 'Pronto' },
  { key: 'picked_up',        label: 'Retirado' },
  { key: 'cancelled',        label: 'Cancelado' },
];

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

export default function PedidosTab() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('store_orders')
      .select(`
        *,
        guardian:guardian_profiles(id, full_name),
        student:students(id, full_name),
        items:store_order_items(id)
      `)
      .order('created_at', { ascending: false })
      .limit(200);

    setOrders((data ?? []) as unknown as StoreOrder[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const confirmPayment = useCallback(async (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirming(orderId);
    await supabase
      .from('store_orders')
      .update({ status: 'payment_confirmed', updated_at: new Date().toISOString() })
      .eq('id', orderId);
    await load();
    setConfirming(null);
  }, [load]);

  const filtered = filter === 'all' ? orders : orders.filter((o) => o.status === filter);

  return (
    <div className="space-y-4">
      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map((tab) => (
          <button key={tab.key} onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === tab.key
                ? 'bg-brand-primary text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Pedido</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Responsável</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Aluno</th>
                <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Itens</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Total</th>
                <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Status</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Data</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm text-gray-400">
                    Nenhum pedido encontrado
                  </td>
                </tr>
              )}
              {filtered.map((order) => (
                <tr key={order.id}
                  onClick={() => navigate(`/admin/loja/pedidos/${order.id}`)}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors">
                  <td className="py-2.5 px-3 font-mono text-xs text-gray-700 dark:text-gray-300">{order.order_number}</td>
                  <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300">
                    {(order.guardian as unknown as { full_name?: string } | null)?.full_name ?? '—'}
                  </td>
                  <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300">
                    {(order.student as unknown as { full_name?: string } | null)?.full_name ?? '—'}
                  </td>
                  <td className="py-2.5 px-3 text-center text-gray-600 dark:text-gray-400">
                    {(order.items as unknown[])?.length ?? 0}
                  </td>
                  <td className="py-2.5 px-3 text-right font-medium text-gray-800 dark:text-white">
                    {formatCurrency(Number(order.total_amount))}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="py-2.5 px-3 text-xs text-gray-500 dark:text-gray-400">
                    {new Date(order.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="py-2.5 px-3">
                    {order.status === 'pending_payment' && (
                      <button
                        onClick={(e) => confirmPayment(order.id, e)}
                        disabled={confirming === order.id}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors disabled:opacity-50">
                        {confirming === order.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <CheckCircle className="w-3 h-3" />
                        )}
                        Confirmar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
