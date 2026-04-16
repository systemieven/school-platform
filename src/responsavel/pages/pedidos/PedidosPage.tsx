import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useGuardian } from '../../contexts/GuardianAuthContext';
import { ShoppingBag, Loader2 } from 'lucide-react';
import OrderStatusBadge from '../../../components/loja/OrderStatusBadge';
import type { StoreOrder, StoreOrderStatus } from '../../../admin/types/admin.types';

type FilterStatus = 'all' | StoreOrderStatus;

const FILTER_TABS: { key: FilterStatus; label: string }[] = [
  { key: 'all',              label: 'Todos' },
  { key: 'pending_payment',  label: 'Ag. Pagamento' },
  { key: 'picking',          label: 'Em Separação' },
  { key: 'ready_for_pickup', label: 'Pronto' },
  { key: 'completed',        label: 'Concluído' },
  { key: 'cancelled',        label: 'Cancelado' },
];

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

export default function PedidosPage() {
  const navigate = useNavigate();
  const { guardian } = useGuardian();
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('all');

  const load = useCallback(async () => {
    if (!guardian?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('store_orders')
      .select('*, items:store_order_items(id)')
      .eq('guardian_id', guardian.id)
      .order('created_at', { ascending: false });
    setOrders((data ?? []) as unknown as StoreOrder[]);
    setLoading(false);
  }, [guardian?.id]);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all' ? orders : orders.filter((o) => o.status === filter);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <ShoppingBag className="w-5 h-5 text-brand-primary" />
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">Meus Pedidos</h1>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map((tab) => (
          <button key={tab.key} onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === tab.key
                ? 'bg-brand-primary text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-12 text-center">
          <ShoppingBag className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Nenhum pedido encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => (
            <button key={order.id}
              onClick={() => navigate(`/responsavel/pedidos/${order.order_number}`)}
              className="w-full bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 text-left hover:shadow-sm hover:border-brand-primary/30 transition-all">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono font-bold text-sm text-gray-800 dark:text-white">{order.order_number}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(order.created_at).toLocaleDateString('pt-BR')} · {(order.items as unknown[])?.length ?? 0} item(s)
                  </p>
                </div>
                <OrderStatusBadge status={order.status} />
              </div>
              <div className="mt-2 font-bold text-brand-primary">
                {formatCurrency(Number(order.total_amount))}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
