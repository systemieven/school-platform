import { useCallback, useEffect, useState } from 'react';
import { Loader2, Check, Trash2, ShoppingBag, Plus, X, Receipt } from 'lucide-react';
import { SelectDropdown } from '../../../components/FormField';
import { Drawer, DrawerCard } from '../../../components/Drawer';
import { SelectDropdown } from '../../../components/FormField';
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

interface FiscalProfile {
  id: string;
  name: string;
  description: string | null;
  ncm: string | null; cest: string | null; cfop_saida: string | null;
  origem: number; unidade_trib: string | null;
  cst_icms: string | null; csosn: string | null;
  mod_bc_icms: number; aliq_icms: number | null; red_bc_icms: number | null; mva: number | null;
  cst_pis: string | null; aliq_pis: number | null;
  cst_cofins: string | null; aliq_cofins: number | null;
  cst_ipi: string | null; ex_tipi: string | null; aliq_ipi: number | null;
  gera_nfe: boolean;
}

interface FiscalForm {
  fiscal_profile_id: string;
  ncm: string; cest: string; cfop_saida: string;
  origem: string; unidade_trib: string; ean: string;
  cst_icms: string; csosn: string; mod_bc_icms: string;
  aliq_icms: string; red_bc_icms: string; mva: string;
  cst_pis: string; aliq_pis: string;
  cst_cofins: string; aliq_cofins: string;
  cst_ipi: string; ex_tipi: string; aliq_ipi: string;
  gera_nfe: boolean; obs_fiscal: string;
}

const EMPTY_FISCAL: FiscalForm = {
  fiscal_profile_id: '', ncm: '', cest: '', cfop_saida: '',
  origem: '0', unidade_trib: 'UN', ean: '',
  cst_icms: '', csosn: '', mod_bc_icms: '3',
  aliq_icms: '', red_bc_icms: '', mva: '',
  cst_pis: '', aliq_pis: '',
  cst_cofins: '', aliq_cofins: '',
  cst_ipi: '', ex_tipi: '', aliq_ipi: '',
  gera_nfe: false, obs_fiscal: '',
};

export default function ProdutoDrawer({ open, product, categories, onClose, onSaved }: Props) {
  const { user } = useAdminAuth();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fiscal, setFiscal] = useState<FiscalForm>(EMPTY_FISCAL);
  const [fiscalProfiles, setFiscalProfiles] = useState<FiscalProfile[]>([]);
  const [fiscalDbId, setFiscalDbId] = useState<string | null>(null);

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
    setFiscal(EMPTY_FISCAL);
    setFiscalDbId(null);
    if (product) {
      // Load fiscal data for this product
      supabase.from('product_fiscal_data')
        .select('*')
        .eq('store_product_id', product.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setFiscalDbId(data.id as string);
            setFiscal({
              fiscal_profile_id: (data.fiscal_profile_id as string) ?? '',
              ncm: (data.ncm as string) ?? '',
              cest: (data.cest as string) ?? '',
              cfop_saida: (data.cfop_saida as string) ?? '',
              origem: String(data.origem ?? 0),
              unidade_trib: (data.unidade_trib as string) ?? 'UN',
              ean: (data.ean as string) ?? '',
              cst_icms: (data.cst_icms as string) ?? '',
              csosn: (data.csosn as string) ?? '',
              mod_bc_icms: String(data.mod_bc_icms ?? 3),
              aliq_icms: data.aliq_icms != null ? String(data.aliq_icms) : '',
              red_bc_icms: data.red_bc_icms != null ? String(data.red_bc_icms) : '',
              mva: data.mva != null ? String(data.mva) : '',
              cst_pis: (data.cst_pis as string) ?? '',
              aliq_pis: data.aliq_pis != null ? String(data.aliq_pis) : '',
              cst_cofins: (data.cst_cofins as string) ?? '',
              aliq_cofins: data.aliq_cofins != null ? String(data.aliq_cofins) : '',
              cst_ipi: (data.cst_ipi as string) ?? '',
              ex_tipi: (data.ex_tipi as string) ?? '',
              aliq_ipi: data.aliq_ipi != null ? String(data.aliq_ipi) : '',
              gera_nfe: (data.gera_nfe as boolean) ?? false,
              obs_fiscal: (data.obs_fiscal as string) ?? '',
            });
          }
        });
    }
    // Load fiscal profiles (always)
    supabase.from('fiscal_profiles').select('*').order('name').then(({ data }) => {
      setFiscalProfiles((data ?? []) as FiscalProfile[]);
    });
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

  const applyProfile = (profileId: string) => {
    const p = fiscalProfiles.find((fp) => fp.id === profileId);
    if (!p) { setFiscal((f) => ({ ...f, fiscal_profile_id: profileId })); return; }
    setFiscal((f) => ({
      ...f,
      fiscal_profile_id: profileId,
      ncm: p.ncm ?? f.ncm, cest: p.cest ?? f.cest, cfop_saida: p.cfop_saida ?? f.cfop_saida,
      origem: String(p.origem ?? f.origem), unidade_trib: p.unidade_trib ?? f.unidade_trib,
      cst_icms: p.cst_icms ?? f.cst_icms, csosn: p.csosn ?? f.csosn,
      mod_bc_icms: String(p.mod_bc_icms ?? f.mod_bc_icms),
      aliq_icms: p.aliq_icms != null ? String(p.aliq_icms) : f.aliq_icms,
      red_bc_icms: p.red_bc_icms != null ? String(p.red_bc_icms) : f.red_bc_icms,
      mva: p.mva != null ? String(p.mva) : f.mva,
      cst_pis: p.cst_pis ?? f.cst_pis, aliq_pis: p.aliq_pis != null ? String(p.aliq_pis) : f.aliq_pis,
      cst_cofins: p.cst_cofins ?? f.cst_cofins, aliq_cofins: p.aliq_cofins != null ? String(p.aliq_cofins) : f.aliq_cofins,
      cst_ipi: p.cst_ipi ?? f.cst_ipi, ex_tipi: p.ex_tipi ?? f.ex_tipi,
      aliq_ipi: p.aliq_ipi != null ? String(p.aliq_ipi) : f.aliq_ipi,
      gera_nfe: p.gera_nfe,
    }));
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

      // Save fiscal data
      if (productId) {
        const hasFiscalData = fiscal.ncm || fiscal.cfop_saida || fiscal.cst_icms || fiscal.csosn || fiscal.cst_pis || fiscal.gera_nfe;
        if (hasFiscalData || fiscalDbId) {
          const fiscalPayload = {
            store_product_id: productId,
            fiscal_profile_id: fiscal.fiscal_profile_id || null,
            ncm: fiscal.ncm || null, cest: fiscal.cest || null, cfop_saida: fiscal.cfop_saida || null,
            origem: Number(fiscal.origem), unidade_trib: fiscal.unidade_trib || 'UN', ean: fiscal.ean || null,
            cst_icms: fiscal.cst_icms || null, csosn: fiscal.csosn || null,
            mod_bc_icms: Number(fiscal.mod_bc_icms),
            aliq_icms: fiscal.aliq_icms ? Number(fiscal.aliq_icms) : null,
            red_bc_icms: fiscal.red_bc_icms ? Number(fiscal.red_bc_icms) : null,
            mva: fiscal.mva ? Number(fiscal.mva) : null,
            cst_pis: fiscal.cst_pis || null, aliq_pis: fiscal.aliq_pis ? Number(fiscal.aliq_pis) : null,
            cst_cofins: fiscal.cst_cofins || null, aliq_cofins: fiscal.aliq_cofins ? Number(fiscal.aliq_cofins) : null,
            cst_ipi: fiscal.cst_ipi || null, ex_tipi: fiscal.ex_tipi || null,
            aliq_ipi: fiscal.aliq_ipi ? Number(fiscal.aliq_ipi) : null,
            gera_nfe: fiscal.gera_nfe, obs_fiscal: fiscal.obs_fiscal || null,
            updated_at: new Date().toISOString(),
          };
          if (fiscalDbId) {
            await supabase.from('product_fiscal_data').update(fiscalPayload).eq('id', fiscalDbId);
          } else {
            await supabase.from('product_fiscal_data').insert({ ...fiscalPayload, created_at: new Date().toISOString() });
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
            <SelectDropdown label="Categoria" value={form.category_id} onChange={(e) => set('category_id', e.target.value)}>
              <option value="">Sem categoria</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </SelectDropdown>
            <SelectDropdown label="Status" value={form.status} onChange={(e) => set('status', e.target.value as StoreProductStatus)}>
              {(Object.entries(PRODUCT_STATUS_LABELS) as [StoreProductStatus, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </SelectDropdown>
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

      <DrawerCard title="Fiscal" icon={Receipt}>
        <div className="p-4 space-y-4">
          {/* Profile selector */}
          {fiscalProfiles.length > 0 && (
            <div>
              <SelectDropdown
                label="Perfil Fiscal (preenchimento automático)"
                value={fiscal.fiscal_profile_id}
                onChange={(e) => applyProfile(e.target.value)}
              >
                <option value="">— Selecionar perfil —</option>
                {fiscalProfiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </SelectDropdown>
              {fiscal.fiscal_profile_id && (
                <p className="text-xs text-gray-400 mt-1">Campos preenchidos pelo perfil. Você pode sobrescrever individualmente.</p>
              )}
            </div>
          )}

          {/* Classificação Fiscal */}
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Classificação Fiscal</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">NCM (8 dígitos)</label>
                <input value={fiscal.ncm} onChange={(e) => setFiscal(f => ({...f, ncm: e.target.value}))} maxLength={8}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white font-mono"
                  placeholder="00000000" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">CEST (7 dígitos)</label>
                <input value={fiscal.cest} onChange={(e) => setFiscal(f => ({...f, cest: e.target.value}))} maxLength={7}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white font-mono"
                  placeholder="0000000" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">CFOP Saída</label>
                <input value={fiscal.cfop_saida} onChange={(e) => setFiscal(f => ({...f, cfop_saida: e.target.value}))} maxLength={4}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white font-mono"
                  placeholder="5102" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">EAN / Código de Barras</label>
                <input value={fiscal.ean} onChange={(e) => setFiscal(f => ({...f, ean: e.target.value}))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white font-mono"
                  placeholder="7891234567890" />
              </div>
              <SelectDropdown label="Origem" value={fiscal.origem} onChange={(e) => setFiscal(f => ({...f, origem: e.target.value}))}>
                <option value="0">0 — Nacional</option>
                <option value="1">1 — Estrangeira (importação direta)</option>
                <option value="2">2 — Estrangeira (mercado interno)</option>
                <option value="3">3 — Nacional (CI 40%–70%)</option>
                <option value="4">4 — Nacional (PPB)</option>
                <option value="5">5 — Nacional (CI ≤ 40%)</option>
                <option value="6">6 — Estrangeira (sem similar, importação direta)</option>
                <option value="7">7 — Estrangeira (sem similar, mercado interno)</option>
                <option value="8">8 — Nacional (CI &gt; 70%)</option>
              </SelectDropdown>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Unidade Tributável</label>
                <input value={fiscal.unidade_trib} onChange={(e) => setFiscal(f => ({...f, unidade_trib: e.target.value}))} maxLength={6}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white font-mono uppercase"
                  placeholder="UN" />
              </div>
            </div>
          </div>

          {/* ICMS */}
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">ICMS</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">CST ICMS</label>
                <input value={fiscal.cst_icms} onChange={(e) => setFiscal(f => ({...f, cst_icms: e.target.value}))} maxLength={3}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white font-mono"
                  placeholder="00" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">CSOSN (Simples)</label>
                <input value={fiscal.csosn} onChange={(e) => setFiscal(f => ({...f, csosn: e.target.value}))} maxLength={3}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white font-mono"
                  placeholder="400" />
              </div>
              <SelectDropdown label="Modalidade BC" value={fiscal.mod_bc_icms} onChange={(e) => setFiscal(f => ({...f, mod_bc_icms: e.target.value}))}>
                <option value="0">0 — MVA (%)</option>
                <option value="1">1 — Pauta (valor)</option>
                <option value="2">2 — Preço tabelado</option>
                <option value="3">3 — Valor da operação</option>
              </SelectDropdown>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Alíquota ICMS (%)</label>
                <input type="number" step="0.01" min="0" max="100" value={fiscal.aliq_icms} onChange={(e) => setFiscal(f => ({...f, aliq_icms: e.target.value}))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white"
                  placeholder="12.00" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Redução BC (%)</label>
                <input type="number" step="0.01" min="0" max="100" value={fiscal.red_bc_icms} onChange={(e) => setFiscal(f => ({...f, red_bc_icms: e.target.value}))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white"
                  placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">MVA — ST (%)</label>
                <input type="number" step="0.01" min="0" value={fiscal.mva} onChange={(e) => setFiscal(f => ({...f, mva: e.target.value}))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white"
                  placeholder="—" />
              </div>
            </div>
          </div>

          {/* PIS / COFINS */}
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">PIS / COFINS</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">CST PIS</label>
                <input value={fiscal.cst_pis} onChange={(e) => setFiscal(f => ({...f, cst_pis: e.target.value}))} maxLength={2}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white font-mono"
                  placeholder="07" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Alíquota PIS (%)</label>
                <input type="number" step="0.0001" min="0" max="100" value={fiscal.aliq_pis} onChange={(e) => setFiscal(f => ({...f, aliq_pis: e.target.value}))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white"
                  placeholder="0.65" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">CST COFINS</label>
                <input value={fiscal.cst_cofins} onChange={(e) => setFiscal(f => ({...f, cst_cofins: e.target.value}))} maxLength={2}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white font-mono"
                  placeholder="07" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Alíquota COFINS (%)</label>
                <input type="number" step="0.0001" min="0" max="100" value={fiscal.aliq_cofins} onChange={(e) => setFiscal(f => ({...f, aliq_cofins: e.target.value}))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white"
                  placeholder="3.00" />
              </div>
            </div>
          </div>

          {/* IPI */}
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">IPI (quando aplicável)</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">CST IPI</label>
                <input value={fiscal.cst_ipi} onChange={(e) => setFiscal(f => ({...f, cst_ipi: e.target.value}))} maxLength={2}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white font-mono"
                  placeholder="99" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Código EX TIPI</label>
                <input value={fiscal.ex_tipi} onChange={(e) => setFiscal(f => ({...f, ex_tipi: e.target.value}))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white font-mono"
                  placeholder="—" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Alíquota IPI (%)</label>
                <input type="number" step="0.01" min="0" max="100" value={fiscal.aliq_ipi} onChange={(e) => setFiscal(f => ({...f, aliq_ipi: e.target.value}))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white"
                  placeholder="0.00" />
              </div>
            </div>
          </div>

          {/* Emissão */}
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Emissão</p>
            <div className="flex items-center justify-between py-2 px-3 rounded-xl border border-gray-100 dark:border-gray-700">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Gera NF-e na saída</p>
                <p className="text-xs text-gray-400">Produto participa do fluxo de emissão fiscal</p>
              </div>
              <Toggle checked={fiscal.gera_nfe} onChange={(v: boolean) => setFiscal(f => ({...f, gera_nfe: v}))} onColor="bg-emerald-500" />
            </div>
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Observações Fiscais</label>
              <textarea value={fiscal.obs_fiscal} onChange={(e) => setFiscal(f => ({...f, obs_fiscal: e.target.value}))} rows={2}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white resize-none"
                placeholder="Informações complementares para a nota fiscal..." />
            </div>
          </div>
        </div>
      </DrawerCard>
    </Drawer>
  );
}
