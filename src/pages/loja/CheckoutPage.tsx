import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useCart } from '../../hooks/useCart';
import { useGuardian } from '../../responsavel/contexts/GuardianAuthContext';
import { Loader2, ShoppingBag } from 'lucide-react';

const PAYMENT_METHODS = ['PIX', 'Cartão de Crédito', 'Cartão de Débito', 'Boleto'];

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { guardian, students, currentStudentId } = useGuardian();
  const { items, total, clearCart } = useCart();

  const [selectedStudentId, setSelectedStudentId] = useState(currentStudentId ?? '');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [installments, setInstallments] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!guardian) {
    navigate('/responsavel/login');
    return null;
  }

  if (items.length === 0) {
    navigate('/loja/carrinho');
    return null;
  }

  const handleConfirm = async () => {
    if (!paymentMethod) { setError('Selecione a forma de pagamento.'); return; }
    setSubmitting(true);
    setError('');
    try {
      // Generate order number
      const year = new Date().getFullYear();
      const { count } = await supabase.from('store_orders').select('*', { count: 'exact', head: true });
      const orderNumber = `PED-${year}-${String((count ?? 0) + 1).padStart(5, '0')}`;

      const { data: orderData, error: orderErr } = await supabase
        .from('store_orders')
        .insert({
          order_number: orderNumber,
          guardian_id: guardian.id,
          student_id: selectedStudentId || null,
          channel: 'store',
          status: 'pending_payment',
          subtotal: total,
          discount_amount: 0,
          total_amount: total,
          payment_method: paymentMethod,
          installments,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (orderErr || !orderData?.id) throw new Error(orderErr?.message ?? 'Falha ao criar pedido');
      const orderId = orderData.id;

      await supabase.from('store_order_items').insert(
        items.map((item) => ({
          order_id: orderId,
          variant_id: item.variantId,
          product_name: item.productName,
          variant_description: item.variantDescription || null,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_price: item.unitPrice * item.quantity,
          returned_quantity: 0,
          created_at: new Date().toISOString(),
        }))
      );

      clearCart();
      navigate(`/loja/pedido/${orderNumber}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao processar pedido');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <ShoppingBag className="w-6 h-6 text-brand-primary" />
          <h1 className="text-2xl font-bold text-gray-800">Checkout</h1>
        </div>

        {/* Order summary */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Resumo do Pedido</h2>
          {items.map((item) => (
            <div key={item.variantId} className="flex justify-between text-sm">
              <span className="text-gray-700">{item.productName} {item.variantDescription ? `(${item.variantDescription})` : ''} × {item.quantity}</span>
              <span className="font-medium text-gray-800">{formatCurrency(item.unitPrice * item.quantity)}</span>
            </div>
          ))}
          <div className="border-t border-gray-100 pt-2 flex justify-between font-bold text-gray-800">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Student selector */}
        {students.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Aluno</label>
            <select value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-800">
              <option value="">Nenhum</option>
              {students.map((s) => (
                <option key={s.student_id} value={s.student_id}>
                  {s.student?.full_name ?? s.student_id}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Payment method */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Pagamento</h2>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map((m) => (
              <button key={m} onClick={() => setPaymentMethod(m)}
                className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  paymentMethod === m
                    ? 'bg-brand-primary text-white border-brand-primary'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-brand-primary'
                }`}>
                {m}
              </button>
            ))}
          </div>
          {paymentMethod === 'Cartão de Crédito' && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Parcelas</label>
              <select value={installments} onChange={(e) => setInstallments(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-800">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}× de {formatCurrency(total / n)}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-500 text-center">{error}</p>}

        <button onClick={handleConfirm} disabled={submitting || !paymentMethod}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand-primary hover:bg-brand-primary-dark text-white rounded-2xl font-medium transition-colors disabled:opacity-50">
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          {submitting ? 'Processando…' : 'Confirmar Pedido'}
        </button>
      </div>
    </div>
  );
}
