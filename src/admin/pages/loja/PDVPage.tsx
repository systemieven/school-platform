import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import {
  ArrowLeft, Search, ShoppingCart, Trash2, Plus, Minus,
  Check, Loader2, X, ChevronDown,
  Banknote, QrCode, CreditCard, ArrowLeftRight, Wallet,
  Percent, DollarSign, Wifi, WifiOff, Copy, ExternalLink,
  MessageCircle,
} from 'lucide-react';
import type { StoreProduct, StoreProductVariant, PDVCartItem, StorePaymentSurcharge, FinancialCashRegister } from '../../types/admin.types';
import { computeSurcharge } from '../../../lib/paymentSurcharge';

// ── Mapa value→ícone para formas de pagamento manuais ────────────────────────
const PM_ICON_MAP: Record<string, React.ElementType> = {
  cash:        Banknote,
  pix:         QrCode,
  credit_card: CreditCard,
  debit_card:  Wallet,
  transfer:    ArrowLeftRight,
  boleto:      Banknote,
  check:       DollarSign,
  other:       DollarSign,
};

// Fallback usado quando system_settings ainda não foi configurado
const DEFAULT_MANUAL_METHODS: { key: string; label: string; icon: React.ElementType }[] = [
  { key: 'Dinheiro',       label: 'Dinheiro',       icon: Banknote       },
  { key: 'PIX',            label: 'PIX',             icon: QrCode         },
  { key: 'Cartão Crédito', label: 'Cartão Crédito', icon: CreditCard     },
  { key: 'Cartão Débito',  label: 'Cartão Débito',  icon: Wallet         },
  { key: 'Transferência',  label: 'Transferência',  icon: ArrowLeftRight },
];

// Métodos online que os gateways suportam
const ONLINE_METHODS: { key: string; label: string; icon: React.ElementType }[] = [
  { key: 'PIX',         label: 'PIX',       icon: QrCode     },
  { key: 'BOLETO',      label: 'Boleto',    icon: Banknote   },
  { key: 'CREDIT_CARD', label: 'Crédito',   icon: CreditCard },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

// ── Interfaces ─────────────────────────────────────────────────────────────────
interface StudentOption  { id: string; full_name: string; }

interface ActiveGateway {
  id: string;
  provider: string;
  environment: string;
  supported_methods: string[];
}

interface ChargeResult {
  checkoutToken: string;
  checkoutUrl: string;
}

// ── Componente ─────────────────────────────────────────────────────────────────
export default function PDVPage() {
  const { user } = useAdminAuth();

  // ── Busca de produtos ───────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StoreProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  // ── Carrinho ────────────────────────────────────────────────────────────────
  const [cart, setCart] = useState<PDVCartItem[]>([]);

  // ── Aluno ───────────────────────────────────────────────────────────────────
  const [studentSearch, setStudentSearch] = useState('');
  const [studentResults, setStudentResults] = useState<StudentOption[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const [linkedGuardianId, setLinkedGuardianId] = useState<string | null>(null);

  // ── Modo de pagamento ───────────────────────────────────────────────────────
  const [payMode, setPayMode]       = useState<'manual' | 'online'>('manual');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [discount, setDiscount]     = useState('0');
  const [discountType, setDiscountType] = useState<'value' | 'percent'>('value');

  // ── Gateway ─────────────────────────────────────────────────────────────────
  const [activeGateway, setActiveGateway] = useState<ActiveGateway | null>(null);
  const [gatewayLoading, setGatewayLoading] = useState(false);
  const [manualMethods, setManualMethods] = useState(DEFAULT_MANUAL_METHODS);

  // ── Acréscimos por forma de pagamento ──────────────────────────────────────
  const [surcharges, setSurcharges] = useState<StorePaymentSurcharge[]>([]);

  // ── Venda ───────────────────────────────────────────────────────────────────
  const [finalizing, setFinalizing] = useState(false);
  const [saleDone, setSaleDone]   = useState(false);
  const [lastOrderNumber, setLastOrderNumber] = useState('');
  const [chargeResult, setChargeResult] = useState<ChargeResult | null>(null);
  const [saleError, setSaleError] = useState<string | null>(null);

  // ── Carregar gateway ativo + formas de pagamento manuais ───────────────────
  useEffect(() => {
    async function loadGatewayAndMethods() {
      setGatewayLoading(true);
      const [{ data: gw }, { data: pmRow }] = await Promise.all([
        supabase
          .from('payment_gateways')
          .select('id, provider, environment, supported_methods')
          .eq('is_active', true)
          .order('is_default', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('system_settings')
          .select('value')
          .eq('category', 'financial')
          .eq('key', 'payment_methods')
          .maybeSingle(),
      ]);
      setActiveGateway(gw as ActiveGateway | null);

      // Mapear formas de pagamento ativas do setting para o formato do PDV
      if (pmRow?.value) {
        try {
          const items = JSON.parse(pmRow.value as string) as { value: string; label: string; is_active: boolean }[];
          const mapped = items
            .filter((m) => m.is_active)
            .map((m) => ({ key: m.label, label: m.label, icon: PM_ICON_MAP[m.value] ?? DollarSign }));
          if (mapped.length) setManualMethods(mapped);
        } catch { /* fallback mantido */ }
      }
      setGatewayLoading(false);
    }
    loadGatewayAndMethods();

    supabase
      .from('store_payment_surcharges')
      .select('*')
      .eq('is_active', true)
      .then(({ data }) => { if (data) setSurcharges(data as StorePaymentSurcharge[]); });
  }, []);

  // Reset método ao trocar modo
  useEffect(() => { setPaymentMethod(''); setChargeResult(null); setSaleError(null); }, [payMode]);

  // ── Busca de produtos ───────────────────────────────────────────────────────
  const searchProducts = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from('store_products')
      .select('*, variants:store_product_variants(*)')
      .or(`name.ilike.%${q}%,sku_base.ilike.%${q}%`)
      .in('status', ['active', 'out_of_stock'])
      .limit(20);
    setSearchResults((data ?? []) as unknown as StoreProduct[]);
    setSearching(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchProducts(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery, searchProducts]);

  // ── Busca de alunos ─────────────────────────────────────────────────────────
  const searchStudents = useCallback(async (q: string) => {
    if (!q.trim()) { setStudentResults([]); return; }
    const { data } = await supabase
      .from('students')
      .select('id, full_name')
      .ilike('full_name', `%${q}%`)
      .limit(15);
    setStudentResults((data ?? []) as StudentOption[]);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchStudents(studentSearch), 300);
    return () => clearTimeout(t);
  }, [studentSearch, searchStudents]);

  const selectStudent = useCallback(async (s: StudentOption) => {
    setSelectedStudent(s);
    setStudentSearch(s.full_name);
    setStudentResults([]);
    const { data } = await supabase
      .from('guardian_students')
      .select('guardian_id')
      .eq('student_id', s.id)
      .limit(1)
      .maybeSingle();
    setLinkedGuardianId((data as { guardian_id: string } | null)?.guardian_id ?? null);
  }, []);

  // ── Carrinho ────────────────────────────────────────────────────────────────
  const addVariantToCart = (product: StoreProduct, variant: StoreProductVariant) => {
    const effectivePrice = variant.price_override ?? product.sale_price;
    const desc = [variant.color, variant.size].filter(Boolean).join(' · ');
    setCart((prev) => {
      const existing = prev.find((i) => i.variantId === variant.id);
      if (existing) {
        return prev.map((i) =>
          i.variantId === variant.id
            ? { ...i, quantity: i.quantity + 1, totalPrice: (i.quantity + 1) * i.unitPrice }
            : i
        );
      }
      return [...prev, {
        variantId: variant.id, productName: product.name,
        variantDescription: desc, sku: variant.sku,
        quantity: 1, unitPrice: effectivePrice, totalPrice: effectivePrice,
      }];
    });
    setExpandedProduct(null); setSearchQuery(''); setSearchResults([]);
  };

  const updateQty = (variantId: string, delta: number) =>
    setCart((prev) => prev.map((i) => i.variantId === variantId
      ? { ...i, quantity: Math.max(1, i.quantity + delta), totalPrice: Math.max(1, i.quantity + delta) * i.unitPrice }
      : i
    ));

  const removeItem = (variantId: string) =>
    setCart((prev) => prev.filter((i) => i.variantId !== variantId));

  // ── Cálculos ────────────────────────────────────────────────────────────────
  const subtotal = cart.reduce((s, i) => s + i.totalPrice, 0);
  const rawDiscount = parseFloat(discount) || 0;
  const discountAmount = discountType === 'percent' ? subtotal * (rawDiscount / 100) : rawDiscount;
  const baseForSurcharge = Math.max(0, subtotal - discountAmount);
  const { pct: surchargePct, amount: surchargeAmount } = computeSurcharge(
    baseForSurcharge, paymentMethod, surcharges, 'pdv'
  );
  const finalTotal = baseForSurcharge + surchargeAmount;

  // ── Finalizar venda ─────────────────────────────────────────────────────────
  const finalizeSale = async () => {
    if (cart.length === 0 || !paymentMethod || !selectedStudent) return;
    setSaleError(null);
    setFinalizing(true);
    try {
      const year = new Date().getFullYear();
      const { count } = await supabase.from('store_orders').select('*', { count: 'exact', head: true });
      const orderNumber = `PED-${year}-${String((count ?? 0) + 1).padStart(5, '0')}`;

      const orderStatus = payMode === 'online' ? 'pending_payment' : 'payment_confirmed';

      // ── Criar pedido ────────────────────────────────────────────────────────
      const { data: orderData } = await supabase
        .from('store_orders')
        .insert({
          order_number:    orderNumber,
          guardian_id:     linkedGuardianId,
          student_id:      selectedStudent.id,
          channel:         'pdv',
          status:          orderStatus,
          subtotal,
          discount_amount:  discountAmount,
          surcharge_pct:    surchargePct,
          surcharge_amount: surchargeAmount,
          total_amount:     finalTotal,
          payment_method:  payMode === 'manual' ? paymentMethod : null,
          installments:    1,
          created_by:      user?.id ?? null,
          created_at:      new Date().toISOString(),
          updated_at:      new Date().toISOString(),
        })
        .select('id')
        .single();

      if (!orderData?.id) throw new Error('Erro ao criar pedido');
      const orderId = orderData.id;

      // ── Itens + estoque ─────────────────────────────────────────────────────
      await Promise.all([
        supabase.from('store_order_items').insert(
          cart.map((item) => ({
            order_id: orderId, variant_id: item.variantId,
            product_name: item.productName,
            variant_description: item.variantDescription || null,
            quantity: item.quantity, unit_price: item.unitPrice,
            total_price: item.totalPrice, returned_quantity: 0,
            created_at: new Date().toISOString(),
          }))
        ),
        ...cart.map((item) =>
          supabase.from('store_inventory_movements').insert({
            variant_id: item.variantId, type: 'sale',
            quantity: -item.quantity, balance_after: 0,
            reference_type: 'pdv', reference_id: orderId,
            justification: `Venda PDV ${orderNumber}`,
            recorded_by: user?.id ?? null,
            created_at: new Date().toISOString(),
          })
        ),
        // Caixa: somente modo manual (pagamento confirmado imediatamente)
        payMode === 'manual' ? (async () => {
          const { data: reg } = await supabase
            .from('financial_cash_registers')
            .select('id, current_balance')
            .eq('status', 'open')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (reg) {
            const { id: regId, current_balance } = reg as FinancialCashRegister;
            const newBalance = current_balance + finalTotal;
            await Promise.all([
              supabase.from('financial_cash_movements').insert({
                cash_register_id: regId,
                type: 'inflow',
                sub_type: 'recebimento',
                amount: finalTotal,
                balance_after: newBalance,
                description: `Venda PDV #${orderNumber}`,
                payment_method: paymentMethod,
                reference_type: 'order',
                reference_id: orderId,
                recorded_by: user?.id ?? null,
                movement_date: new Date().toISOString(),
              }),
              supabase
                .from('financial_cash_registers')
                .update({ current_balance: newBalance, updated_at: new Date().toISOString() })
                .eq('id', regId),
            ]);
          } else {
            console.warn('PDV: nenhum caixa aberto — movimento financeiro não registrado');
          }
        })() : Promise.resolve(),
      ]);

      // ── Fluxo Online: criar sessão de checkout + enviar WhatsApp ───────────
      if (payMode === 'online') {
        const { data: sessionData, error: sessionErr } = await supabase.functions.invoke('checkout-proxy', {
          body: { action: 'createSession', order_id: orderId, billing_type: paymentMethod },
        });
        if (sessionErr || !sessionData?.token) {
          throw new Error(sessionData?.error ?? sessionErr?.message ?? 'Erro ao criar sessão de pagamento.');
        }

        const checkoutUrl = `${window.location.origin}/pagar/${sessionData.token}`;

        // Enviar WhatsApp (best-effort)
        if (linkedGuardianId) {
          const { data: gp } = await supabase
            .from('guardian_profiles')
            .select('full_name, phone')
            .eq('id', linkedGuardianId)
            .maybeSingle();
          if (gp?.phone) {
            const text = `Olá, ${(gp.full_name as string).split(' ')[0]}! 👋\n\nAcesse o link abaixo para pagar *${orderNumber}* (${fmt(finalTotal)}):\n\n${checkoutUrl}\n\n_Dúvidas? Entre em contato com a secretaria._`;
            await supabase.functions.invoke('uazapi-proxy', {
              body: { action: 'sendText', phone: gp.phone, text },
            }).catch(() => {});
          }
        }

        setChargeResult({ checkoutToken: sessionData.token as string, checkoutUrl });
      }

      // Auto-emissão de NFC-e (best-effort; só quando venda já confirmada)
      if (orderStatus === 'payment_confirmed') {
        try {
          const { data: nfceCfg } = await supabase
            .from('company_nfce_config')
            .select('auto_emit_on_payment')
            .maybeSingle();
          if ((nfceCfg as { auto_emit_on_payment?: boolean } | null)?.auto_emit_on_payment) {
            await supabase.functions.invoke('nfce-emitter', {
              body: { order_id: orderId, initiated_by: user?.id ?? null },
            });
          }
        } catch { /* best-effort */ }
      }

      setLastOrderNumber(orderNumber);
      setSaleDone(true);
      setCart([]);
      setSelectedStudent(null); setLinkedGuardianId(null); setStudentSearch('');
      setDiscount('0'); setDiscountType('value');
      if (payMode === 'manual') {
        setPaymentMethod('');
        setTimeout(() => setSaleDone(false), 3000);
      }
    } catch (err) {
      setSaleError(err instanceof Error ? err.message : 'Erro inesperado ao finalizar venda');
    } finally {
      setFinalizing(false);
    }
  };

  // ── Reiniciar após venda online com link ─────────────────────────────────────
  function resetAfterOnlineSale() {
    setSaleDone(false); setChargeResult(null); setPaymentMethod('');
  }

  // ── Métodos online disponíveis (filtrados pelo gateway) ─────────────────────
  const availableOnlineMethods = activeGateway
    ? ONLINE_METHODS.filter((m) => activeGateway.supported_methods.includes(m.key))
    : [];

  // ── Render ──────────────────────────────────────────────────────────────────
  // Layout: -m-6 cancela o p-6 do <main>; calc(100vh - 64px) = viewport - header h-16
  return (
    <div className="-m-6 flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 64px)' }}>

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <header className="bg-brand-primary text-white px-6 py-3 flex items-center gap-4 flex-shrink-0">
        <Link to="/admin/loja" className="flex items-center gap-2 text-white/80 hover:text-white text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <span className="font-bold text-lg flex-1 text-center">Ponto de Venda — PDV</span>
        {selectedStudent && (
          <span className="text-sm text-white/80 bg-white/10 rounded-lg px-3 py-1 flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-300" />
            {selectedStudent.full_name}
          </span>
        )}
      </header>

      {/* ── Dois painéis ─────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── PAINEL ESQUERDO: busca de produtos ─────────────────────────────── */}
        <div className="w-1/2 flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 min-h-0">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar produto por nome ou SKU…"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-white"
                autoFocus
              />
              {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {searchResults.map((product) => {
              const activeVariants = product.variants?.filter((v) => v.is_active && v.stock_quantity > 0) ?? [];
              return (
                <div key={product.id} className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedProduct((e) => e === product.id ? null : product.id)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-800 dark:text-white truncate">{product.name}</p>
                      <p className="text-xs text-gray-400">{fmt(product.sale_price)} · {activeVariants.length} var. disponível{activeVariants.length !== 1 ? 'is' : ''}</p>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedProduct === product.id ? 'rotate-180' : ''}`} />
                  </button>
                  {expandedProduct === product.id && (
                    <div className="border-t border-gray-100 dark:border-gray-700 p-3 grid grid-cols-2 gap-2">
                      {activeVariants.length === 0
                        ? <p className="text-xs text-gray-400 col-span-2 text-center py-2">Sem estoque disponível</p>
                        : activeVariants.map((v) => (
                          <button key={v.id} onClick={() => addVariantToCart(product, v)}
                            className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-brand-primary hover:text-white transition-colors text-left group">
                            <div>
                              <p className="text-xs font-medium group-hover:text-white text-gray-800 dark:text-white">
                                {[v.color, v.size].filter(Boolean).join(' · ') || v.sku}
                              </p>
                              <p className="text-[10px] text-gray-400 group-hover:text-white/70">{v.stock_quantity} em estoque</p>
                            </div>
                            <span className="text-xs font-bold group-hover:text-white text-brand-primary">
                              {fmt(v.price_override ?? product.sale_price)}
                            </span>
                          </button>
                        ))
                      }
                    </div>
                  )}
                </div>
              );
            })}
            {!searchQuery && searchResults.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-gray-300 dark:text-gray-600 gap-3 py-16">
                <Search className="w-12 h-12" />
                <p className="text-sm">Digite para buscar produtos…</p>
              </div>
            )}
          </div>
        </div>

        {/* ── PAINEL DIREITO: carrinho + pagamento ────────────────────────────── */}
        <div className="w-1/2 flex flex-col min-h-0 bg-gray-50 dark:bg-gray-900">

          {/* Carrinho — flex-1 com scroll */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
            <div className="flex items-center gap-2 mb-3">
              <ShoppingCart className="w-4 h-4 text-brand-primary" />
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Carrinho
                {cart.length > 0 && (
                  <span className="ml-1.5 bg-brand-primary text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">{cart.length}</span>
                )}
              </span>
              {cart.length > 0 && (
                <button onClick={() => setCart([])} className="ml-auto text-xs text-red-400 hover:text-red-600 flex items-center gap-1">
                  <X className="w-3 h-3" /> Limpar
                </button>
              )}
            </div>
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-300 dark:text-gray-600 gap-3 py-16">
                <ShoppingCart className="w-12 h-12" />
                <p className="text-sm">Carrinho vazio</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.variantId} className="bg-white dark:bg-gray-800 rounded-xl p-3 flex items-center gap-3 shadow-sm">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{item.productName}</p>
                    {item.variantDescription && <p className="text-xs text-gray-400">{item.variantDescription}</p>}
                    <p className="text-xs font-mono text-gray-400">{item.sku}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => updateQty(item.variantId, -1)} className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-200 transition-colors">
                      <Minus className="w-3 h-3 text-gray-600 dark:text-gray-300" />
                    </button>
                    <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                    <button onClick={() => updateQty(item.variantId, 1)} className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-200 transition-colors">
                      <Plus className="w-3 h-3 text-gray-600 dark:text-gray-300" />
                    </button>
                  </div>
                  <span className="text-sm font-bold text-gray-800 dark:text-white w-20 text-right">{fmt(item.totalPrice)}</span>
                  <button onClick={() => removeItem(item.variantId)} className="text-red-400 hover:text-red-600 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* ── FOOTER: travado na parte inferior ──────────────────────────────
               flex-shrink-0 garante que este painel nunca é espremido pelo carrinho */}
          <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3 overflow-y-auto max-h-[68vh]">

            {/* ── Aluno (obrigatório) ─────────────────────────────────────────── */}
            <div className="relative">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Aluno <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  value={studentSearch}
                  onChange={(e) => { setStudentSearch(e.target.value); if (!e.target.value) { setSelectedStudent(null); setLinkedGuardianId(null); } }}
                  placeholder="Buscar aluno pelo nome…"
                  className={`w-full pl-8 pr-8 py-2 rounded-xl border text-sm text-gray-800 dark:text-white bg-white dark:bg-gray-700 transition-colors ${selectedStudent ? 'border-emerald-400 dark:border-emerald-600' : 'border-gray-200 dark:border-gray-600'}`}
                />
                {selectedStudent && <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-500" />}
              </div>
              {studentResults.length > 0 && (
                <div className="absolute left-0 right-0 bottom-full mb-1 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 z-10 max-h-44 overflow-y-auto">
                  {studentResults.map((s) => (
                    <button key={s.id} onClick={() => selectStudent(s)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-800 dark:text-white">
                      {s.full_name}
                    </button>
                  ))}
                </div>
              )}
              {selectedStudent && (
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {linkedGuardianId ? '✓ Responsável vinculado' : 'Sem responsável cadastrado'}
                </p>
              )}
            </div>

            {/* ── Toggle Manual / Online ──────────────────────────────────────── */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Pagamento</label>
              <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600 text-xs font-semibold">
                <button
                  onClick={() => setPayMode('manual')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 transition-colors ${payMode === 'manual' ? 'bg-brand-primary text-white' : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-brand-primary'}`}
                >
                  <WifiOff className="w-3.5 h-3.5" /> Manual
                </button>
                <button
                  onClick={() => setPayMode('online')}
                  disabled={!activeGateway && !gatewayLoading}
                  title={!activeGateway && !gatewayLoading ? 'Nenhum gateway ativo configurado' : 'Gerar cobrança online com link de pagamento'}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 border-l border-gray-200 dark:border-gray-600 transition-colors ${payMode === 'online' ? 'bg-brand-primary text-white' : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-brand-primary disabled:opacity-40 disabled:cursor-not-allowed'}`}
                >
                  {gatewayLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
                  Online
                </button>
              </div>
              {payMode === 'online' && activeGateway && (
                <p className="text-[10px] text-gray-400 mt-0.5">Gateway: {activeGateway.provider.toUpperCase()} · {activeGateway.environment}</p>
              )}
            </div>

            {/* ── Métodos de pagamento ────────────────────────────────────────── */}
            {payMode === 'manual' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Forma de Pagamento</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {manualMethods.map(({ key, label, icon: Icon }) => {
                    const selected = paymentMethod === key;
                    return (
                      <button key={key} onClick={() => setPaymentMethod(key)}
                        className={`flex flex-col items-center gap-1 px-1 py-2 rounded-xl border text-[10px] font-medium transition-all ${selected ? 'bg-brand-primary border-brand-primary text-white shadow-md scale-[1.03]' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-brand-primary hover:text-brand-primary'}`}>
                        <Icon className={`w-4 h-4 ${selected ? 'text-white/80' : 'text-brand-primary'}`} />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {payMode === 'online' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Método de Cobrança</label>
                {availableOnlineMethods.length === 0 ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-3 py-2">
                    Gateway sem métodos online configurados.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5">
                    {availableOnlineMethods.map(({ key, label, icon: Icon }) => {
                      const selected = paymentMethod === key;
                      return (
                        <button key={key} onClick={() => setPaymentMethod(key)}
                          className={`flex flex-col items-center gap-1 px-1 py-2.5 rounded-xl border text-[10px] font-medium transition-all ${selected ? 'bg-brand-primary border-brand-primary text-white shadow-md scale-[1.03]' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-brand-primary hover:text-brand-primary'}`}>
                          <Icon className={`w-4 h-4 ${selected ? 'text-white/80' : 'text-brand-primary'}`} />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Desconto com toggle R$ / % ──────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Desconto</label>
                <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 text-[10px] font-semibold">
                  <button
                    onClick={() => setDiscountType('value')}
                    className={`flex items-center gap-0.5 px-2 py-0.5 transition-colors ${discountType === 'value' ? 'bg-brand-primary text-white' : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-brand-primary'}`}>
                    <DollarSign className="w-2.5 h-2.5" /> R$
                  </button>
                  <button
                    onClick={() => setDiscountType('percent')}
                    className={`flex items-center gap-0.5 px-2 py-0.5 border-l border-gray-200 dark:border-gray-600 transition-colors ${discountType === 'percent' ? 'bg-brand-primary text-white' : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-brand-primary'}`}>
                    <Percent className="w-2.5 h-2.5" /> %
                  </button>
                </div>
              </div>
              <div className="relative">
                <input
                  type="number" step={discountType === 'percent' ? '0.1' : '0.01'} min={0}
                  max={discountType === 'percent' ? 100 : undefined}
                  value={discount} onChange={(e) => setDiscount(e.target.value)}
                  className="w-full px-3 py-2 pr-8 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">
                  {discountType === 'percent' ? '%' : 'R$'}
                </span>
              </div>
              {discountAmount > 0 && subtotal > 0 && (
                <p className="text-[10px] text-gray-400 mt-0.5">
                  = {fmt(discountAmount)} de desconto
                  {discountType === 'value' && ` (${((discountAmount / subtotal) * 100).toFixed(1)}%)`}
                </p>
              )}
            </div>

            {/* ── Totais ──────────────────────────────────────────────────────── */}
            <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-1">
              <div className="flex justify-between text-xs text-gray-400">
                <span>Subtotal</span><span>{fmt(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-xs text-red-500">
                  <span>Desconto</span><span>−{fmt(discountAmount)}</span>
                </div>
              )}
              {surchargeAmount > 0 && (
                <div className="flex justify-between text-sm text-orange-600">
                  <span>Acréscimo ({surchargePct}%)</span>
                  <span>+ {fmt(surchargeAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-bold text-gray-800 dark:text-white pt-1">
                <span>Total</span>
                <span className="text-brand-primary">{fmt(finalTotal)}</span>
              </div>
            </div>

            {/* ── Resultado de cobrança online ─────────────────────────────────── */}
            {saleDone && chargeResult && (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-sm font-medium">
                  <Check className="w-4 h-4" /> Cobrança gerada! {lastOrderNumber}
                </div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">Link de pagamento personalizado:</p>
                <div className="flex gap-2">
                  <a href={chargeResult.checkoutUrl} target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-brand-primary text-white text-xs font-medium hover:bg-brand-primary-dark transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" /> Abrir checkout
                  </a>
                  <button
                    onClick={() => navigator.clipboard.writeText(chargeResult!.checkoutUrl)}
                    className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-300 hover:border-brand-primary transition-colors flex items-center gap-1">
                    <Copy className="w-3.5 h-3.5" /> Copiar
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 flex items-center gap-1">
                  <MessageCircle className="w-3 h-3" /> WhatsApp enviado ao responsável
                </p>
                <button onClick={resetAfterOnlineSale}
                  className="w-full py-1.5 rounded-xl border border-gray-200 dark:border-gray-600 text-xs text-gray-500 hover:text-brand-primary transition-colors">
                  Nova venda
                </button>
              </div>
            )}

            {/* ── Sucesso manual ───────────────────────────────────────────────── */}
            {saleDone && !chargeResult && (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-xl p-3 text-sm text-center font-medium flex items-center justify-center gap-2">
                <Check className="w-4 h-4" /> Venda concluída! {lastOrderNumber}
              </div>
            )}

            {/* ── Erro ─────────────────────────────────────────────────────────── */}
            {saleError && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl p-3 text-xs leading-relaxed">
                {saleError}
                <button onClick={() => setSaleError(null)} className="ml-2 underline">Fechar</button>
              </div>
            )}

            {/* ── Aviso aluno ──────────────────────────────────────────────────── */}
            {!selectedStudent && cart.length > 0 && !saleDone && (
              <p className="text-xs text-amber-600 dark:text-amber-400 text-center bg-amber-50 dark:bg-amber-900/20 rounded-lg py-1.5">
                Selecione o aluno para continuar
              </p>
            )}

            {/* ── Botão Finalizar ──────────────────────────────────────────────── */}
            {!saleDone && (
              <button
                onClick={finalizeSale}
                disabled={finalizing || cart.length === 0 || !paymentMethod || !selectedStudent}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold transition-all bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {finalizing
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> {payMode === 'online' ? 'Gerando cobrança…' : 'Processando…'}</>
                  : payMode === 'online'
                    ? <><Wifi className="w-4 h-4" /> Gerar Cobrança · {fmt(finalTotal)}</>
                    : <><ShoppingCart className="w-4 h-4" /> Finalizar Venda · {fmt(finalTotal)}</>
                }
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
