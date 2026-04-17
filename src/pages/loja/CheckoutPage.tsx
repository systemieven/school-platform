import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useCart } from '../../hooks/useCart';
import { useGuardian } from '../../responsavel/contexts/GuardianAuthContext';
import { Loader2, ShoppingBag, QrCode, Banknote, CreditCard } from 'lucide-react';
import { computeSurcharge } from '../../lib/paymentSurcharge';
import type { StorePaymentSurcharge } from '../../admin/types/admin.types';

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

type BillingType = 'PIX' | 'BOLETO' | 'CREDIT_CARD';

const PAYMENT_OPTIONS: { key: BillingType; label: string; icon: React.ElementType; description: string }[] = [
  { key: 'PIX',         label: 'PIX',              icon: QrCode,      description: 'Aprovação imediata' },
  { key: 'CREDIT_CARD', label: 'Cartão de Crédito', icon: CreditCard,  description: 'Em até 12×' },
  { key: 'BOLETO',      label: 'Boleto Bancário',   icon: Banknote,    description: 'Vence hoje' },
];

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { guardian, students, currentStudentId } = useGuardian();
  const { items, total, clearCart } = useCart();

  const [selectedStudentId, setSelectedStudentId] = useState(currentStudentId ?? '');
  const [billingType, setBillingType] = useState<BillingType | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [surcharges, setSurcharges] = useState<StorePaymentSurcharge[]>([]);

  useEffect(() => {
    supabase
      .from('store_payment_surcharges')
      .select('*')
      .eq('is_active', true)
      .then(({ data }) => { if (data) setSurcharges(data); });
  }, []);

  const { pct: surchargePct, amount: surchargeAmount } = useMemo(
    () => computeSurcharge(total, billingType, surcharges, 'store'),
    [billingType, total, surcharges]
  );

  if (!guardian) {
    navigate('/responsavel/login');
    return null;
  }

  if (items.length === 0) {
    navigate('/loja/carrinho');
    return null;
  }

  const finalTotal = total + surchargeAmount;

  const handleConfirm = async () => {
    if (!billingType) { setError('Selecione a forma de pagamento.'); return; }
    setSubmitting(true);
    setError('');
    try {
      // 1. Generate order number
      const year = new Date().getFullYear();
      const { count } = await supabase.from('store_orders').select('*', { count: 'exact', head: true });
      const orderNumber = `PED-${year}-${String((count ?? 0) + 1).padStart(5, '0')}`;

      // 2. Create order (pending_payment — becomes confirmed after gateway webhook)
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
          surcharge_pct: surchargePct,
          surcharge_amount: surchargeAmount,
          total_amount: finalTotal,
          installments: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (orderErr || !orderData?.id) throw new Error(orderErr?.message ?? 'Falha ao criar pedido');
      const orderId = orderData.id;

      // 3. Insert order items
      const { error: itemsErr } = await supabase.from('store_order_items').insert(
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
      if (itemsErr) throw new Error(itemsErr.message);

      // 4. Create checkout session via edge function (handles gateway charge + session)
      const { data: sessionData, error: sessionErr } = await supabase.functions.invoke('checkout-proxy', {
        body: { action: 'createSession', order_id: orderId, billing_type: billingType, amount: finalTotal },
      });

      if (sessionErr) throw new Error(sessionErr.message || 'Erro ao criar sessão de pagamento.');
      if (!sessionData?.token) throw new Error(sessionData?.error ?? 'Erro ao criar sessão de pagamento.');

      // 5. Clear cart and redirect to branded checkout
      clearCart();
      navigate(`/pagar/${sessionData.token}`);
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
              <span className="text-gray-700">
                {item.productName}{item.variantDescription ? ` (${item.variantDescription})` : ''} × {item.quantity}
              </span>
              <span className="font-medium text-gray-800">{formatCurrency(item.unitPrice * item.quantity)}</span>
            </div>
          ))}
          {surchargeAmount > 0 && (
            <div className="flex justify-between text-sm text-orange-600">
              <span>Acréscimo ({surchargePct}%)</span>
              <span>+ {formatCurrency(surchargeAmount)}</span>
            </div>
          )}
          <div className="border-t border-gray-100 pt-2 flex justify-between font-bold text-gray-800">
            <span>Total</span>
            <span>{formatCurrency(finalTotal)}</span>
          </div>
        </div>

        {/* Student selector */}
        {students.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Aluno</label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-800"
            >
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
          <h2 className="text-sm font-semibold text-gray-700">Forma de Pagamento</h2>
          <div className="space-y-2">
            {PAYMENT_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const selected = billingType === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => setBillingType(opt.key)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                    selected
                      ? 'bg-brand-primary border-brand-primary text-white'
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-brand-primary'
                  }`}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${selected ? 'text-white' : 'text-brand-primary'}`} />
                  <div className="flex-1">
                    <span className="text-sm font-medium">{opt.label}</span>
                    <span className={`ml-2 text-xs ${selected ? 'text-white/75' : 'text-gray-400'}`}>
                      {opt.description}
                    </span>
                  </div>
                  {selected && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="text-sm text-red-500 text-center">{error}</p>}

        <button
          onClick={handleConfirm}
          disabled={submitting || !billingType}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand-primary hover:bg-brand-primary-dark text-white rounded-2xl font-medium transition-colors disabled:opacity-50"
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          {submitting ? 'Gerando link de pagamento…' : `Ir para Pagamento →`}
        </button>

        <p className="text-xs text-gray-400 text-center">
          🔒 Pagamento processado com segurança via gateway certificado
        </p>
      </div>
    </div>
  );
}
