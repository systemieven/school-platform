import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { Loader2, ArrowLeft, Check, X } from 'lucide-react';
import OrderStatusBadge from '../../../components/loja/OrderStatusBadge';
import OrderTimeline from '../../../components/loja/OrderTimeline';
import type { StoreOrder, StoreOrderStatus } from '../../types/admin.types';

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

const NEXT_STATUS: Partial<Record<StoreOrderStatus, StoreOrderStatus>> = {
  pending_payment:  'payment_confirmed',
  payment_confirmed: 'picking',
  picking:          'ready_for_pickup',
};

const NEXT_LABEL: Partial<Record<StoreOrderStatus, string>> = {
  pending_payment:  'Confirmar Pagamento',
  payment_confirmed: 'Iniciar Separação',
  picking:          'Pronto para Retirada',
};

export default function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAdminAuth();

  const [order, setOrder] = useState<StoreOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showProtocolForm, setShowProtocolForm] = useState(false);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [signedBy, setSignedBy] = useState({ name: '', document: '', relation: '' });
  const [cancelReason, setCancelReason] = useState('');
  const [actionDone, setActionDone] = useState(false);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    const { data } = await supabase
      .from('store_orders')
      .select(`
        *,
        guardian:guardian_profiles(id, full_name),
        student:students(id, full_name),
        items:store_order_items(*, variant:store_product_variants(sku))
      `)
      .eq('id', orderId)
      .single();
    setOrder(data as unknown as StoreOrder);
    setLoading(false);
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  const advance = useCallback(async () => {
    if (!order) return;
    const nextStatus = NEXT_STATUS[order.status];
    if (!nextStatus) return;
    setUpdating(true);
    await supabase.from('store_orders').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('id', order.id);
    setActionDone(true);
    setTimeout(() => { setActionDone(false); load(); }, 900);
    setUpdating(false);
  }, [order, load]);

  const registerPickup = useCallback(async () => {
    if (!order || !signedBy.name.trim()) return;
    setUpdating(true);
    await Promise.all([
      supabase.from('store_orders').update({ status: 'picked_up', updated_at: new Date().toISOString() }).eq('id', order.id),
      supabase.from('store_pickup_protocols').insert({
        order_id: order.id,
        signed_by_name: signedBy.name.trim(),
        signed_by_document: signedBy.document.trim() || null,
        signed_by_relation: signedBy.relation.trim() || null,
        signed_at: new Date().toISOString(),
        confirmed_by: user?.id ?? null,
        created_at: new Date().toISOString(),
      }),
    ]);
    setShowProtocolForm(false);
    load();
    setUpdating(false);
  }, [order, signedBy, user, load]);

  const cancelOrder = useCallback(async () => {
    if (!order || !cancelReason.trim()) return;
    setUpdating(true);
    await supabase.from('store_orders').update({
      status: 'cancelled',
      cancellation_reason: cancelReason.trim(),
      cancelled_by: user?.id ?? null,
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', order.id);
    setShowCancelForm(false);
    load();
    setUpdating(false);
  }, [order, cancelReason, user, load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="space-y-6">
        <button onClick={() => navigate('/admin/loja')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <p className="text-gray-400">Pedido não encontrado.</p>
      </div>
    );
  }

  const isFinal = order.status === 'completed' || order.status === 'cancelled' || order.status === 'picked_up';

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back */}
      <button onClick={() => navigate('/admin/loja')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Voltar para Loja
      </button>

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-mono text-gray-400 mb-1">{order.channel === 'pdv' ? 'PDV' : 'Loja Online'}</p>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white font-mono">{order.order_number}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {new Date(order.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <OrderStatusBadge status={order.status} className="text-sm px-3 py-1" />
        </div>
      </div>

      {/* Customer info */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Cliente</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-gray-400">Responsável</p>
            <p className="font-medium text-gray-800 dark:text-white">
              {(order.guardian as unknown as { full_name?: string } | null)?.full_name ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Aluno</p>
            <p className="font-medium text-gray-800 dark:text-white">
              {(order.student as unknown as { full_name?: string } | null)?.full_name ?? '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Itens</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700">
              <th className="text-left py-1.5 text-xs font-medium text-gray-400">Produto</th>
              <th className="text-center py-1.5 text-xs font-medium text-gray-400">Qtd</th>
              <th className="text-right py-1.5 text-xs font-medium text-gray-400">Unit.</th>
              <th className="text-right py-1.5 text-xs font-medium text-gray-400">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {(order.items ?? []).map((item) => (
              <tr key={item.id}>
                <td className="py-2">
                  <p className="font-medium text-gray-800 dark:text-white">{item.product_name}</p>
                  {item.variant_description && <p className="text-xs text-gray-400">{item.variant_description}</p>}
                </td>
                <td className="py-2 text-center text-gray-600 dark:text-gray-400">{item.quantity}</td>
                <td className="py-2 text-right text-gray-600 dark:text-gray-400">{formatCurrency(Number(item.unit_price))}</td>
                <td className="py-2 text-right font-medium text-gray-800 dark:text-white">{formatCurrency(Number(item.total_price))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Totals */}
        <div className="border-t border-gray-100 dark:border-gray-700 mt-3 pt-3 space-y-1">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>Subtotal</span>
            <span>{formatCurrency(Number(order.subtotal))}</span>
          </div>
          {Number(order.discount_amount) > 0 && (
            <div className="flex justify-between text-sm text-red-500">
              <span>Desconto</span>
              <span>−{formatCurrency(Number(order.discount_amount))}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-gray-800 dark:text-white pt-1">
            <span>Total</span>
            <span>{formatCurrency(Number(order.total_amount))}</span>
          </div>
          {order.payment_method && (
            <p className="text-xs text-gray-400 text-right">{order.payment_method}{order.installments > 1 ? ` · ${order.installments}x` : ''}</p>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Status</h2>
        <OrderTimeline status={order.status} createdAt={order.created_at} updatedAt={order.updated_at} />
        {order.status === 'cancelled' && order.cancellation_reason && (
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-sm text-red-600 dark:text-red-400">
            <strong>Motivo:</strong> {order.cancellation_reason}
          </div>
        )}
      </div>

      {/* Actions */}
      {!isFinal && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Ações</h2>
          <div className="flex flex-wrap gap-3">
            {/* Advance status */}
            {NEXT_STATUS[order.status] && order.status !== 'ready_for_pickup' && (
              <button onClick={advance} disabled={updating}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  actionDone ? 'bg-emerald-500 text-white' : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'
                }`}>
                {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : actionDone ? <Check className="w-4 h-4" /> : null}
                {actionDone ? 'Atualizado!' : NEXT_LABEL[order.status]}
              </button>
            )}

            {/* Register pickup */}
            {order.status === 'ready_for_pickup' && (
              <button onClick={() => setShowProtocolForm(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-brand-primary hover:bg-brand-primary-dark text-white transition-colors">
                Registrar Retirada
              </button>
            )}

            {/* Cancel */}
            <button onClick={() => setShowCancelForm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">
              <X className="w-4 h-4" /> Cancelar Pedido
            </button>
          </div>

          {/* Protocol form */}
          {showProtocolForm && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-3 mt-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Protocolo de Retirada</h3>
              <input value={signedBy.name} onChange={(e) => setSignedBy((s) => ({ ...s, name: e.target.value }))}
                placeholder="Nome de quem retirou *"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white" />
              <input value={signedBy.document} onChange={(e) => setSignedBy((s) => ({ ...s, document: e.target.value }))}
                placeholder="CPF / RG"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white" />
              <input value={signedBy.relation} onChange={(e) => setSignedBy((s) => ({ ...s, relation: e.target.value }))}
                placeholder="Parentesco (ex: Mãe, Pai, Responsável)"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white" />
              <div className="flex gap-2">
                <button onClick={() => setShowProtocolForm(false)}
                  className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  Cancelar
                </button>
                <button onClick={registerPickup} disabled={updating || !signedBy.name.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors disabled:opacity-50">
                  {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Confirmar Retirada
                </button>
              </div>
            </div>
          )}

          {/* Cancel form */}
          {showCancelForm && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-3 mt-3">
              <h3 className="text-sm font-semibold text-red-600">Cancelar Pedido</h3>
              <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Motivo do cancelamento *" rows={3}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white resize-none" />
              <div className="flex gap-2">
                <button onClick={() => setShowCancelForm(false)}
                  className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  Voltar
                </button>
                <button onClick={cancelOrder} disabled={updating || !cancelReason.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors disabled:opacity-50">
                  {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                  Confirmar Cancelamento
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
