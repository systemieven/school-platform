import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { ArrowLeft, ShoppingBag, Loader2 } from 'lucide-react';
import OrderStatusBadge from '../../../components/loja/OrderStatusBadge';
import OrderTimeline from '../../../components/loja/OrderTimeline';
import type { StoreOrder, StorePickupProtocol } from '../../../admin/types/admin.types';

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

export default function PedidoDetalhePage() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<StoreOrder | null>(null);
  const [protocol, setProtocol] = useState<StorePickupProtocol | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!orderNumber) return;
    setLoading(true);
    const { data } = await supabase
      .from('store_orders')
      .select('*, items:store_order_items(*)')
      .eq('order_number', orderNumber)
      .single();
    const ord = data as unknown as StoreOrder | null;
    setOrder(ord);

    if (ord && (ord.status === 'picked_up' || ord.status === 'completed')) {
      const { data: proto } = await supabase
        .from('store_pickup_protocols')
        .select('*')
        .eq('order_id', ord.id)
        .single();
      setProtocol(proto as StorePickupProtocol | null);
    }
    setLoading(false);
  }, [orderNumber]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/responsavel/pedidos')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <p className="text-gray-400">Pedido não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <button onClick={() => navigate('/responsavel/pedidos')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Meus Pedidos
      </button>

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShoppingBag className="w-4 h-4 text-brand-primary" />
              <span className="text-xs text-gray-400">Pedido</span>
            </div>
            <p className="font-mono font-bold text-lg text-gray-800 dark:text-white">{order.order_number}</p>
            <p className="text-xs text-gray-400 mt-1">
              {new Date(order.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>
      </div>

      {/* Items */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Itens</h2>
        {(order.items ?? []).map((item) => (
          <div key={item.id} className="flex justify-between gap-3 text-sm">
            <div>
              <p className="font-medium text-gray-800 dark:text-white">{item.product_name}</p>
              {item.variant_description && <p className="text-xs text-gray-400">{item.variant_description}</p>}
              <p className="text-xs text-gray-400">Qtd: {item.quantity}</p>
            </div>
            <span className="font-medium text-gray-800 dark:text-white whitespace-nowrap">
              {formatCurrency(Number(item.total_price))}
            </span>
          </div>
        ))}
        <div className="border-t border-gray-100 dark:border-gray-700 pt-3 flex justify-between font-bold text-gray-800 dark:text-white">
          <span>Total</span>
          <span>{formatCurrency(Number(order.total_amount))}</span>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Status</h2>
        <OrderTimeline status={order.status} createdAt={order.created_at} updatedAt={order.updated_at} />
        {order.status === 'cancelled' && order.cancellation_reason && (
          <p className="mt-2 text-xs text-red-500">Cancelado: {order.cancellation_reason}</p>
        )}
      </div>

      {/* Pickup protocol */}
      {protocol && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800 p-5">
          <h2 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 mb-2">Protocolo de Retirada</h2>
          <p className="text-sm text-gray-700 dark:text-gray-300">Retirado por: <strong>{protocol.signed_by_name}</strong></p>
          {protocol.signed_by_relation && <p className="text-xs text-gray-500">{protocol.signed_by_relation}</p>}
          <p className="text-xs text-gray-400 mt-1">
            {new Date(protocol.signed_at).toLocaleString('pt-BR')}
          </p>
        </div>
      )}
    </div>
  );
}
