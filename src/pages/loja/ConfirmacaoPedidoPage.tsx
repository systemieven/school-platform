import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { CheckCircle, ShoppingBag, Loader2 } from 'lucide-react';
import OrderStatusBadge from '../../components/loja/OrderStatusBadge';
import type { StoreOrder } from '../../admin/types/admin.types';

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

export default function ConfirmacaoPedidoPage() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const [order, setOrder] = useState<StoreOrder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderNumber) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('store_orders')
        .select('*, items:store_order_items(*)')
        .eq('order_number', orderNumber)
        .single();
      setOrder(data as unknown as StoreOrder | null);
      setLoading(false);
    })();
  }, [orderNumber]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3">
        <ShoppingBag className="w-12 h-12 text-gray-200" />
        <p className="text-gray-400">Pedido não encontrado</p>
        <Link to="/loja" className="text-brand-primary hover:underline text-sm">Voltar para a loja</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Success */}
        <div className="text-center">
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800">Pedido Confirmado!</h1>
          <p className="text-gray-500 mt-2">Obrigado pela sua compra.</p>
        </div>

        {/* Order info */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Número do Pedido</p>
              <p className="font-mono font-bold text-gray-800 text-lg">{order.order_number}</p>
            </div>
            <OrderStatusBadge status={order.status} />
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-2">
            {(order.items ?? []).map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-gray-700">{item.product_name} × {item.quantity}</span>
                <span className="font-medium text-gray-800">{formatCurrency(Number(item.total_price))}</span>
              </div>
            ))}
            <div className="border-t border-gray-100 pt-2 flex justify-between font-bold text-gray-800">
              <span>Total</span>
              <span>{formatCurrency(Number(order.total_amount))}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Link to="/responsavel/pedidos"
            className="w-full text-center py-3 bg-brand-primary hover:bg-brand-primary-dark text-white rounded-2xl font-medium transition-colors">
            Ver Meus Pedidos
          </Link>
          <Link to="/loja"
            className="w-full text-center py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-2xl font-medium transition-colors text-sm">
            Continuar Comprando
          </Link>
        </div>
      </div>
    </div>
  );
}
