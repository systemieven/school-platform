import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import {
  ArrowLeft, Search, ShoppingCart, Trash2, Plus, Minus,
  Check, Loader2, X, ChevronDown,
} from 'lucide-react';
import type { StoreProduct, StoreProductVariant, PDVCartItem } from '../../types/admin.types';

const PAYMENT_METHODS = ['Dinheiro', 'PIX', 'Cartão Crédito', 'Cartão Débito', 'Transferência'];

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

  // Sale
  const [finalizing, setFinalizing] = useState(false);
  const [saleDone, setSaleDone] = useState(false);
  const [lastOrderNumber, setLastOrderNumber] = useState('');

  // Variant selection state
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

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
    // Vincula o responsável automaticamente a partir do aluno
    const { data } = await supabase
      .from('guardian_students')
      .select('guardian_id')
      .eq('student_id', s.id)
      .limit(1)
      .maybeSingle();
    setLinkedGuardianId((data as { guardian_id: string } | null)?.guardian_id ?? null);
  }, []);

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

  const discountAmount = parseFloat(discount) || 0;
  const subtotal = cart.reduce((s, i) => s + i.totalPrice, 0);
  const total = Math.max(0, subtotal - discountAmount);

  const finalizeSale = async () => {
    if (cart.length === 0 || !paymentMethod || !selectedStudent) return;
    setFinalizing(true);
    try {
      // Generate order number
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

      // Insert items + inventory movements
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
            balance_after: 0, // will be recalculated on read
            reference_type: 'pdv',
            reference_id: orderId,
            justification: `Venda PDV ${orderNumber}`,
            recorded_by: user?.id ?? null,
            created_at: new Date().toISOString(),
          })
        ),
        // financial_cash_movements (inflow) — best-effort, ignore schema mismatch
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
      setPaymentMethod('');
      setTimeout(() => setSaleDone(false), 3000);
    } finally {
      setFinalizing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col">
      {/* Top bar */}
      <header className="bg-brand-primary text-white px-6 py-3 flex items-center gap-4 flex-shrink-0">
        <Link to="/admin/loja" className="flex items-center gap-2 text-white/80 hover:text-white text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <span className="font-bold text-lg flex-1 text-center">Ponto de Venda — PDV</span>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: product search */}
        <div className="w-1/2 flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
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
                    className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-800 dark:text-white truncate">{product.name}</p>
                      <p className="text-xs text-gray-400">{formatCurrency(product.sale_price)} · {activeVariants.length} var.</p>
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
              <p className="text-sm text-gray-400 text-center py-12">Digite para buscar produtos…</p>
            )}
          </div>
        </div>

        {/* Right: cart + payment */}
        <div className="w-1/2 flex flex-col bg-gray-50 dark:bg-gray-900">
          {/* Cart */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <ShoppingCart className="w-4 h-4 text-brand-primary" />
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Carrinho</span>
              {cart.length > 0 && (
                <button onClick={() => setCart([])} className="ml-auto text-xs text-red-400 hover:text-red-600 flex items-center gap-1">
                  <X className="w-3 h-3" /> Limpar
                </button>
              )}
            </div>
            {cart.length === 0
              ? <p className="text-sm text-gray-400 text-center py-12">Carrinho vazio</p>
              : cart.map((item) => (
                <div key={item.variantId} className="bg-white dark:bg-gray-800 rounded-xl p-3 flex items-center gap-3">
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
                  <span className="text-sm font-bold text-gray-800 dark:text-white w-20 text-right">{formatCurrency(item.totalPrice)}</span>
                  <button onClick={() => removeItem(item.variantId)} className="text-red-400 hover:text-red-600 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            }
          </div>

          {/* Payment panel */}
          <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
            {/* Customer — Aluno obrigatório; responsável vinculado automaticamente */}
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
                  className={`w-full pl-8 pr-3 py-2 rounded-xl border text-sm text-gray-800 dark:text-white bg-white dark:bg-gray-700 ${
                    selectedStudent ? 'border-emerald-400 dark:border-emerald-600' : 'border-gray-200 dark:border-gray-600'
                  }`}
                />
                {selectedStudent && linkedGuardianId !== undefined && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
              {studentResults.length > 0 && (
                <div className="absolute left-0 right-0 bottom-full mb-1 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 z-10 max-h-44 overflow-y-auto">
                  {studentResults.map((s) => (
                    <button key={s.id} onClick={() => selectStudent(s)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-800 dark:text-white">
                      {s.full_name}
                    </button>
                  ))}
                </div>
              )}
              {selectedStudent && (
                <p className="text-[10px] text-gray-400 mt-1">
                  {linkedGuardianId ? '✓ Responsável vinculado automaticamente' : 'Sem responsável cadastrado'}
                </p>
              )}
            </div>

            {/* Payment method */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Forma de Pagamento</label>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <button key={m} onClick={() => setPaymentMethod(m)}
                    className={`px-2 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                      paymentMethod === m
                        ? 'bg-brand-primary text-white border-brand-primary'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-brand-primary'
                    }`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Discount */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Desconto (R$)</label>
              <input type="number" step="0.01" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white" />
            </div>

            {/* Totals */}
            <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-1">
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Desconto</span>
                  <span className="text-red-500">−{formatCurrency(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold text-gray-800 dark:text-white">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Success message */}
            {saleDone && (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-xl p-3 text-sm text-center font-medium">
                Venda concluída! {lastOrderNumber}
              </div>
            )}

            {/* Finalize */}
            {!selectedStudent && cart.length > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 text-center">Selecione o aluno para continuar</p>
            )}
            <button
              onClick={finalizeSale}
              disabled={finalizing || cart.length === 0 || !paymentMethod || !selectedStudent}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all ${
                saleDone ? 'bg-emerald-500 text-white' : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'
              }`}>
              {finalizing ? <Loader2 className="w-4 h-4 animate-spin" /> : saleDone ? <Check className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />}
              {finalizing ? 'Processando…' : saleDone ? 'Venda Registrada!' : 'Finalizar Venda'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
