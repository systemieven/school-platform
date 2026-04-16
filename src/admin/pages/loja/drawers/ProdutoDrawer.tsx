import { useCallback, useEffect, useState } from 'react';
import { Loader2, Check, Trash2, ShoppingBag, Plus, X } from 'lucide-react';
import { Drawer, DrawerCard } from '../../../components/Drawer';
import { Toggle } from '../../../components/Toggle';
import { supabase } from '../../../../lib/supabase';
import { useAdminAuth } from '../../../hooks/useAdminAuth';
import type { StoreProduct, StoreCategory, StoreProductStatus } from '../../../types/admin.types';
import { PRODUCT_STATUS_LABELS } from '../../../types/admin.types';

interface Props {
  open: boolean;
  product: StoreProduct | null;
  categories: StoreCategory[];
  onClose: () => void;
  onSaved: () => void;
}

interface VariantRow {
  id?: string;
  color: string;
  size: string;
  sku: string;
  price_override: string;
  stock_quantity: number;
  min_stock: number;
  is_active: boolean;
  _new?: boolean;
}

interface FormState {
  name: string;
  short_description: string;
  description: string;
  category_id: string;
  sku_base: string;
  cost_price: string;
  sale_price: string;
  status: StoreProductStatus;
  is_featured: boolean;
  is_digital: boolean;
  is_active: boolean;
}

const EMPTY_FORM: FormState = {
  name: '', short_description: '', description: '',
  category_id: '', sku_base: '', cost_price: '', sale_price: '',
  status: 'active', is_featured: false, is_digital: false, is_active: true,
};

export default function ProdutoDrawer({ open, product, categories, onClose, onSaved }: Props) {
  const { user } = useAdminAuth();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name,
        short_description: product.short_description ?? '',
        description: product.description ?? '',
        category_id: product.category_id ?? '',
        sku_base: product.sku_base ?? '',
        cost_price: product.cost_price != null ? String(product.cost_price) : '',
        sale_price: String(product.sale_price),
        status: product.status,
        is_featured: product.is_featured,
        is_digital: product.is_digital,
        is_active: product.status !== 'inactive',
      });
      setVariants(
        (product.variants ?? []).map((v) => ({
          id: v.id,
          color: v.color ?? '',
          size: v.size ?? '',
          sku: v.sku,
          price_override: v.price_override != null ? String(v.price_override) : '',
          stock_quantity: v.stock_quantity,
          min_stock: v.min_stock,
          is_active: v.is_active,
        }))
      );
    } else {
      setForm(EMPTY_FORM);
      setVariants([]);
    }
    setSaved(false);
  }, [product, open]);

  const set = useCallback(<K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
  }, []);

  const addVariant = () => {
    setVariants((prev) => [
      ...prev,
      { color: '', size: '', sku: form.sku_base ? `${form.sku_base}-${prev.length + 1}` : '', price_override: '', stock_quantity: 0, min_stock: 0, is_active: true, _new: true },
    ]);
  };

  const updateVariant = (idx: number, field: keyof VariantRow, value: unknown) => {
    setVariants((prev) => prev.map((v, i) => i === idx ? { ...v, [field]: value } : v));
  };

  const removeVariant = (idx: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.sale_price) return;
    setSaving(true);
    try {
      const productPayload = {
        name: form.name.trim(),
        short_description: form.short_description.trim() || null,
        description: form.description.trim() || null,
        category_id: form.category_id || null,
        sku_base: form.sku_base.trim() || null,
        cost_price: form.cost_price ? Number(form.cost_price) : null,
        sale_price: Number(form.sale_price),
        status: form.is_active ? form.status : 'inactive' as StoreProductStatus,
        is_featured: form.is_featured,
        is_digital: form.is_digital,
        updated_at: new Date().toISOString(),
      };

      let productId = product?.id;
      if (product) {
        await supabase.from('store_products').update(productPayload).eq('id', product.id);
      } else {
        const { data } = await supabase
          .from('store_products')
          .insert({ ...productPayload, created_by: user?.id ?? null, created_at: new Date().toISOString() })
          .select('id')
          .single();
        productId = data?.id;
      }

      if (productId) {
        // Upsert variants
        for (const v of variants) {
          const vPayload = {
            product_id: productId,
            sku: v.sku.trim() || `${form.sku_base || productId}-${Math.random().toString(36).slice(2, 6)}`,
            color: v.color.trim() || null,
            size: v.size.trim() || null,
            price_override: v.price_override ? Number(v.price_override) : null,
            stock_quantity: v.stock_quantity,
            min_stock: v.min_stock,
            is_active: v.is_active,
            updated_at: new Date().toISOString(),
          };
          if (v.id && !v._new) {
            await supabase.from('store_product_variants').update(vPayload).eq('id', v.id);
          } else {
            await supabase.from('store_product_variants').insert({ ...vPayload, created_at: new Date().toISOString() });
          }
        }
      }

      setSaved(true);
      setTimeout(() => { onSaved(); onClose(); setSaved(false); }, 900);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!product) return;
    if (!confirm('Excluir este produto? Esta ação é irreversível.')) return;
    await supabase.from('store_products').delete().eq('id', product.id);
    onSaved(); onClose();
  };

  const canSave = form.name.trim().length > 0 && form.sale_price !== '';

  const footer = product ? (
    <div className="flex items-center gap-2">
      <button onClick={handleDelete} disabled={saving}
        className="px-4 py-2 text-sm font-medium rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50 flex items-center gap-1.5">
        <Trash2 className="w-3.5 h-3.5" /> Excluir
      </button>
      <div className="flex-1" />
      <button onClick={onClose} disabled={saving}
        className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
        Cancelar
      </button>
      <button onClick={handleSave} disabled={saving || !canSave}
        className={`px-4 py-2 text-sm font-medium rounded-xl transition-all flex items-center gap-2 ${
          saved ? 'bg-emerald-500 text-white' : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'
        }`}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
        {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Salvar'}
      </button>
    </div>
  ) : (
    <div className="flex gap-3">
      <button onClick={onClose} disabled={saving}
        className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">
        Cancelar
      </button>
      <button onClick={handleSave} disabled={saving || !canSave}
        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
          saved ? 'bg-emerald-500 text-white' : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'
        }`}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
        {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Criar Produto'}
      </button>
    </div>
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={product ? 'Editar Produto' : 'Novo Produto'}
      icon={ShoppingBag}
      footer={footer}
      headerExtra={
        <div className="flex items-center gap-3">
          <Toggle checked={form.is_active} onChange={(v: boolean) => set('is_active', v)} onColor="bg-emerald-500" />
        </div>
      }
    >
      <DrawerCard title="Informações Básicas" icon={ShoppingBag}>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Nome *</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white"
              placeholder="Nome do produto" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Descrição Curta</label>
            <input value={form.short_description} onChange={(e) => set('short_description', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Descrição Completa</label>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Categoria</label>
              <select value={form.category_id} onChange={(e) => set('category_id', e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white">
                <option value="">Sem categoria</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Status</label>
              <select value={form.status} onChange={(e) => set('status', e.target.value as StoreProductStatus)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white">
                {(Object.entries(PRODUCT_STATUS_LABELS) as [StoreProductStatus, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </DrawerCard>

      <DrawerCard title="Preço e SKU">
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">SKU Base</label>
              <input value={form.sku_base} onChange={(e) => set('sku_base', e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white font-mono"
                placeholder="UNIF-01" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Custo (R$)</label>
              <input type="number" step="0.01" value={form.cost_price} onChange={(e) => set('cost_price', e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white"
                placeholder="0,00" min={0} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Preço Venda *</label>
              <input type="number" step="0.01" value={form.sale_price} onChange={(e) => set('sale_price', e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white"
                placeholder="0,00" min={0} />
            </div>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input type="checkbox" checked={form.is_featured} onChange={(e) => set('is_featured', e.target.checked)} className="rounded" />
              Destaque
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input type="checkbox" checked={form.is_digital} onChange={(e) => set('is_digital', e.target.checked)} className="rounded" />
              Digital
            </label>
          </div>
        </div>
      </DrawerCard>

      <DrawerCard title="Variantes" headerExtra={
        <button onClick={addVariant}
          className="flex items-center gap-1 text-xs font-medium text-brand-primary hover:text-brand-primary-dark transition-colors">
          <Plus className="w-3.5 h-3.5" /> Adicionar
        </button>
      }>
        <div className="p-4">
          {variants.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Nenhuma variante. Clique em "+ Adicionar" para criar.</p>
          ) : (
            <div className="space-y-2">
              {variants.map((v, idx) => (
                <div key={idx} className="border border-gray-100 dark:border-gray-700 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Variante {idx + 1}</span>
                    <div className="flex items-center gap-2">
                      <Toggle checked={v.is_active} onChange={(val: boolean) => updateVariant(idx, 'is_active', val)} onColor="bg-emerald-500" />
                      <button onClick={() => removeVariant(idx)} className="text-red-400 hover:text-red-600 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input value={v.color} onChange={(e) => updateVariant(idx, 'color', e.target.value)}
                      placeholder="Cor" className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-800 dark:text-white" />
                    <input value={v.size} onChange={(e) => updateVariant(idx, 'size', e.target.value)}
                      placeholder="Tamanho" className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-800 dark:text-white" />
                    <input value={v.sku} onChange={(e) => updateVariant(idx, 'sku', e.target.value)}
                      placeholder="SKU" className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-800 dark:text-white font-mono" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-0.5">Preço Override</label>
                      <input type="number" step="0.01" value={v.price_override} onChange={(e) => updateVariant(idx, 'price_override', e.target.value)}
                        placeholder="—" className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-800 dark:text-white" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-0.5">Estoque</label>
                      <input type="number" value={v.stock_quantity} onChange={(e) => updateVariant(idx, 'stock_quantity', Number(e.target.value))}
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-800 dark:text-white" min={0} />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-0.5">Estoque Mín.</label>
                      <input type="number" value={v.min_stock} onChange={(e) => updateVariant(idx, 'min_stock', Number(e.target.value))}
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-800 dark:text-white" min={0} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DrawerCard>
    </Drawer>
  );
}
