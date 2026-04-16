import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import {
  ArrowLeft, Search, ShoppingCart, Trash2, Plus, Minus,
  Check, Loader2, X, ChevronDown,
  Banknote, QrCode, CreditCard, ArrowLeftRight, Wallet,
  Percent, DollarSign,
} from 'lucide-react';
import type { StoreProduct, StoreProductVariant, PDVCartItem } from '../../types/admin.types';

// ── Formas de pagamento com ícones ────────────────────────────────────────────
const PAYMENT_METHODS: { key: string; label: string; icon: React.ElementType }[] = [
  { key: 'Dinheiro',         label: 'Dinheiro',       icon: Banknote       },
  { key: 'PIX',              label: 'PIX',             icon: QrCode         },
  { key: 'Cartão Crédito',   label: 'Cartão Crédito', icon: CreditCard     },
  { key: 'Cartão Débito',    label: 'Cartão Débito',  icon: Wallet         },
  { key: 'Transferência',    label: 'Transferência',  icon: ArrowLeftRight },
];

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

interface StudentOption { id: string; full_name: string; }

export default function PDVPage() {
  const { user } = useAdminAuth();

  // Product search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StoreProduct[]>([]);
  const [searching, setSearching] = useState(false);

  // Cart
  const [cart, setCart] = useState<PDVCartItem[]>([]);

  // Customer — busca direta por aluno (obrigatório); responsável vinculado automaticamente
  const [studentSearch, setStudentSearch] = useState('');
  const [studentResults, setStudentResults] = useState<StudentOption[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const [linkedGuardianId, setLinkedGuardianId] = useState<string | null>(null);

  // Payment
  const [paymentMethod, setPaymentMethod] = useState('');
  const [discount, setDiscount] = useState('0');
  const [discountType, setDiscountType] = useState<'value' | 'percent'>('value');

  // Sale
  const [finalizing, setFinalizing] = useState(false);
  const [saleDone, setSaleDone] = useState(false);
  const [lastOrderNumber, setLastOrderNumber] = useState('');

  // Variant selection
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

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
        variantId: variant.id,
        productName: product.name,
        variantDescription: desc,
        sku: variant.sku,
        quantity: 1,
        unitPrice: effectivePrice,
        totalPrice: effectivePrice,
      }];
    });
    setExpandedProduct(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  const updateQty = (variantId: string, delta: number) => {
    setCart((prev) =>
      prev.map((i) => i.variantId === variantId
        ? { ...i, quantity: Math.max(1, i.quantity + delta), totalPrice: Math.max(1, i.quantity + delta) * i.unitPrice }
        : i
      )
    );
  };

  const removeItem = (variantId: string) => {
    setCart((prev) => prev.filter((i) => i.variantId !== variantId));
  };

  // ── Cálculos ────────────────────────────────────────────────────────────────
  const subtotal = cart.reduce((s, i) => s + i.totalPrice, 0);
  const rawDiscount = parseFloat(discount) || 0;
  const discountAmount = discountType === 'percent'
    ? subtotal * (rawDiscount / 100)
    : rawDiscount;
  const total = Math.max(0, subtotal - discountAmount);

  // ── Finalizar venda ─────────────────────────────────────────────────────────
  const finalizeSale = async () => {
    if (cart.length === 0 || !paymentMethod || !selectedStudent) return;
    setFinalizing(true);
    try {
      const year = new Date().getFullYear();
      const { count } = await supabase.from('store_orders').select('*', { count: 'exact', head: true });
      const orderNumber = `PED-${year}-${String((count ?? 0) + 1).padStart(5, '0')}`;

      const { data: orderData } = await supabase
        .from('store_orders')
        .insert({
          order_number: orderNumber,
          guardian_id: linkedGuardianId,
          student_id: selectedStudent.id,
          channel: 'pdv',
          status: 'payment_confirmed',
          subtotal,
          discount_amount: discountAmount,
          total_amount: total,
          payment_method: paymentMethod,
          installments: 1,
          created_by: user?.id ?? null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (!orderData?.id) throw new Error('Failed to create order');
      const orderId = orderData.id;

      await Promise.all([
        supabase.from('store_order_items').insert(
          cart.map((item) => ({
            order_id: orderId,
            variant_id: item.variantId,
            product_name: item.productName,
            variant_description: item.variantDescription || null,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            total_price: item.totalPrice,
            returned_quantity: 0,
            created_at: new Date().toISOString(),
          }))
        ),
        ...cart.map((item) =>
          supabase.from('store_inventory_movements').insert({
            variant_id: item.variantId,
            type: 'sale',
            quantity: -item.quantity,
            balance_after: 0,
            reference_type: 'pdv',
            reference_id: orderId,
            justification: `Venda PDV ${orderNumber}`,
            recorded_by: user?.id ?? null,
            created_at: new Date().toISOString(),
          })
        ),
        (async () => {
          try {
            await supabase.from('financial_cash_movements').insert({
              type: 'inflow',
              sub_type: 'recebimento',
              amount: total,
              description: `Venda PDV ${orderNumber}`,
              payment_method: paymentMethod,
              reference_type: 'order',
              reference_id: orderId,
              created_by: user?.id ?? null,
              created_at: new Date().toISOString(),
            });
          } catch { /* ignore */ }
        })(),
      ]);

      setLastOrderNumber(orderNumber);
      setSaleDone(true);
      setCart([]);
      setSelectedStudent(null);
      setLinkedGuardianId(null);
      setStudentSearch('');
      setDiscount('0');
      setDiscountType('value');
      setPaymentMethod('');
      setTimeout(() => setSaleDone(false), 3000);
    } finally {
      setFinalizing(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen overflow-hidden bg-gray-100 dark:bg-gray-900 flex flex-col">

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <header className="bg-brand-primary text-white px-6 py-3 flex items-center gap-4 flex-shrink-0">
        <Link
          to="/admin/loja"
          className="flex items-center gap-2 text-white/80 hover:text-white text-sm transition-colors"
        >
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

      {/* ── Dois painéis ocupando toda a altura restante ──────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── PAINEL ESQUERDO: busca de produtos ─────────────────────────────── */}
        <div className="w-1/2 flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 min-h-0">
          {/* Search bar — fixo */}
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
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
              )}
            </div>
          </div>

          {/* Resultados — scroll independente */}
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
                      <p className="text-xs text-gray-400">
                        {formatCurrency(product.sale_price)} · {activeVariants.length} variação{activeVariants.length !== 1 ? 'ões' : ''} disponível{activeVariants.length !== 1 ? 'is' : ''}
                      </p>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedProduct === product.id ? 'rotate-180' : ''}`} />
                  </button>
                  {expandedProduct === product.id && (
                    <div className="border-t border-gray-100 dark:border-gray-700 p-3 grid grid-cols-2 gap-2">
                      {activeVariants.length === 0
                        ? <p className="text-xs text-gray-400 col-span-2 text-center py-2">Sem estoque disponível</p>
                        : activeVariants.map((v) => (
                          <button
                            key={v.id}
                            onClick={() => addVariantToCart(product, v)}
                            className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-brand-primary hover:text-white transition-colors text-left group"
                          >
                            <div>
                              <p className="text-xs font-medium group-hover:text-white text-gray-800 dark:text-white">
                                {[v.color, v.size].filter(Boolean).join(' · ') || v.sku}
                              </p>
                              <p className="text-[10px] text-gray-400 group-hover:text-white/70">{v.stock_quantity} em estoque</p>
                            </div>
                            <span className="text-xs font-bold group-hover:text-white text-brand-primary">
                              {formatCurrency(v.price_override ?? product.sale_price)}
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
            {searchQuery && !searching && searchResults.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-12">Nenhum produto encontrado</p>
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
                  <span className="ml-1.5 bg-brand-primary text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                    {cart.length}
                  </span>
                )}
              </span>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="ml-auto text-xs text-red-400 hover:text-red-600 flex items-center gap-1"
                >
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
                    {item.variantDescription && (
                      <p className="text-xs text-gray-400">{item.variantDescription}</p>
                    )}
                    <p className="text-xs font-mono text-gray-400">{item.sku}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateQty(item.variantId, -1)}
                      className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-200 transition-colors"
                    >
                      <Minus className="w-3 h-3 text-gray-600 dark:text-gray-300" />
                    </button>
                    <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQty(item.variantId, 1)}
                      className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-200 transition-colors"
                    >
                      <Plus className="w-3 h-3 text-gray-600 dark:text-gray-300" />
                    </button>
                  </div>
                  <span className="text-sm font-bold text-gray-800 dark:text-white w-20 text-right">
                    {formatCurrency(item.totalPrice)}
                  </span>
                  <button onClick={() => removeItem(item.variantId)} className="text-red-400 hover:text-red-600 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Painel de pagamento — altura fixa, sem scroll */}
          <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">

            {/* Aluno (obrigatório) */}
            <div className="relative">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Aluno <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  value={studentSearch}
                  onChange={(e) => {
                    setStudentSearch(e.target.value);
                    if (!e.target.value) { setSelectedStudent(null); setLinkedGuardianId(null); }
                  }}
                  placeholder="Buscar aluno pelo nome…"
                  className={`w-full pl-8 pr-8 py-2 rounded-xl border text-sm text-gray-800 dark:text-white bg-white dark:bg-gray-700 transition-colors ${
                    selectedStudent
                      ? 'border-emerald-400 dark:border-emerald-600'
                      : 'border-gray-200 dark:border-gray-600'
                  }`}
                />
                {selectedStudent && (
                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-500" />
                )}
              </div>
              {studentResults.length > 0 && (
                <div className="absolute left-0 right-0 bottom-full mb-1 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 z-10 max-h-44 overflow-y-auto">
                  {studentResults.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => selectStudent(s)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-800 dark:text-white"
                    >
                      {s.full_name}
                    </button>
                  ))}
                </div>
              )}
              {selectedStudent && (
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {linkedGuardianId ? '✓ Responsável vinculado automaticamente' : 'Sem responsável cadastrado'}
                </p>
              )}
            </div>

            {/* Forma de pagamento com ícones */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                Forma de Pagamento
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {PAYMENT_METHODS.map(({ key, label, icon: Icon }) => {
                  const selected = paymentMethod === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setPaymentMethod(key)}
                      className={`flex flex-col items-center gap-1 px-1 py-2 rounded-xl border text-[10px] font-medium transition-all ${
                        selected
                          ? 'bg-brand-primary border-brand-primary text-white shadow-md scale-[1.03]'
                          : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-brand-primary hover:text-brand-primary'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${selected ? 'text-white/80' : 'text-brand-primary'}`} />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Desconto com toggle R$ / % */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Desconto</label>
                <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 text-[10px] font-semibold">
                  <button
                    onClick={() => setDiscountType('value')}
                    className={`flex items-center gap-0.5 px-2 py-0.5 transition-colors ${
                      discountType === 'value'
                        ? 'bg-brand-primary text-white'
                        : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-brand-primary'
                    }`}
                  >
                    <DollarSign className="w-2.5 h-2.5" /> R$
                  </button>
                  <button
                    onClick={() => setDiscountType('percent')}
                    className={`flex items-center gap-0.5 px-2 py-0.5 transition-colors border-l border-gray-200 dark:border-gray-600 ${
                      discountType === 'percent'
                        ? 'bg-brand-primary text-white'
                        : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-brand-primary'
                    }`}
                  >
                    <Percent className="w-2.5 h-2.5" /> %
                  </button>
                </div>
              </div>
              <div className="relative">
                <input
                  type="number"
                  step={discountType === 'percent' ? '0.1' : '0.01'}
                  min={0}
                  max={discountType === 'percent' ? 100 : undefined}
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="w-full px-3 py-2 pr-8 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">
                  {discountType === 'percent' ? '%' : 'R$'}
                </span>
              </div>
              {discountAmount > 0 && subtotal > 0 && (
                <p className="text-[10px] text-gray-400 mt-0.5">
                  = {formatCurrency(discountAmount)} de desconto
                  {discountType === 'value' && subtotal > 0 && ` (${((discountAmount / subtotal) * 100).toFixed(1)}%)`}
                </p>
              )}
            </div>

            {/* Totais */}
            <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-1">
              <div className="flex justify-between text-xs text-gray-400">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-xs text-red-500">
                  <span>Desconto</span>
                  <span>−{formatCurrency(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-bold text-gray-800 dark:text-white pt-1">
                <span>Total</span>
                <span className="text-brand-primary">{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Aviso aluno obrigatório */}
            {!selectedStudent && cart.length > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 text-center bg-amber-50 dark:bg-amber-900/20 rounded-lg py-1.5">
                Selecione o aluno para continuar
              </p>
            )}

            {/* Sucesso */}
            {saleDone && (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-xl p-3 text-sm text-center font-medium flex items-center justify-center gap-2">
                <Check className="w-4 h-4" /> Venda concluída! {lastOrderNumber}
              </div>
            )}

            {/* Finalizar */}
            <button
              onClick={finalizeSale}
              disabled={finalizing || cart.length === 0 || !paymentMethod || !selectedStudent}
              className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold transition-all ${
                saleDone
                  ? 'bg-emerald-500 text-white'
                  : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              {finalizing
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Processando…</>
                : saleDone
                  ? <><Check className="w-4 h-4" /> Venda Registrada!</>
                  : <><ShoppingCart className="w-4 h-4" /> Finalizar Venda · {formatCurrency(total)}</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
