import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { Loader2, ShoppingBag, FolderOpen, ChevronDown, ChevronRight, Package } from 'lucide-react';
import type { StoreProduct, StoreCategory } from '../../../types/admin.types';
import { PRODUCT_STATUS_LABELS } from '../../../types/admin.types';
import ProdutoDrawer from '../drawers/ProdutoDrawer';
import CategoriaDrawer from '../drawers/CategoriaDrawer';
import AjusteEstoqueDrawer from '../drawers/AjusteEstoqueDrawer';

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

const STATUS_COLORS: Record<string, string> = {
  active:       'bg-emerald-100 text-emerald-700',
  inactive:     'bg-gray-100 text-gray-500',
  out_of_stock: 'bg-amber-100 text-amber-700',
  discontinued: 'bg-red-100 text-red-600',
};

export default function ProdutosTab() {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showCategories, setShowCategories] = useState(false);

  const [produtoDrawer, setProdutoDrawer] = useState<{ open: boolean; product: StoreProduct | null }>({ open: false, product: null });
  const [categoriaDrawer, setCategoriaDrawer] = useState<{ open: boolean; category: StoreCategory | null }>({ open: false, category: null });
  const [ajusteDrawer, setAjusteDrawer] = useState<{ open: boolean; variant: import('../../../types/admin.types').StoreProductVariant | null }>({ open: false, variant: null });

  const load = useCallback(async () => {
    setLoading(true);
    const [prodRes, catRes] = await Promise.all([
      supabase.from('store_products').select('*, category:store_categories(id,name), variants:store_product_variants(*), images:store_product_images(*)').order('created_at', { ascending: false }),
      supabase.from('store_categories').select('*').order('position'),
    ]);
    setProducts((prodRes.data ?? []) as unknown as StoreProduct[]);
    setCategories((catRes.data ?? []) as StoreCategory[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = products.filter((p) => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (categoryFilter && p.category_id !== categoryFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white">
          <option value="">Todos os status</option>
          {Object.entries(PRODUCT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white">
          <option value="">Todas as categorias</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="flex-1" />
        <button
          onClick={() => setProdutoDrawer({ open: true, product: null })}
          className="flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-brand-primary-dark text-white rounded-xl text-sm font-medium transition-colors">
          <ShoppingBag className="w-4 h-4" /> + Novo Produto
        </button>
      </div>

      {/* Products table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Produto</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Categoria</th>
                <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Variantes</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Preço</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Estoque</th>
                <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="py-12 text-center text-sm text-gray-400">Nenhum produto encontrado</td></tr>
              )}
              {filtered.map((p) => {
                const coverImage = p.images?.find((img) => img.is_cover) ?? p.images?.[0];
                const totalStock = p.variants?.reduce((s, v) => s + v.stock_quantity, 0) ?? 0;
                return (
                  <tr key={p.id}
                    onClick={() => setProdutoDrawer({ open: true, product: p })}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                          {coverImage
                            ? <img src={coverImage.url} alt={p.name} className="w-full h-full object-cover" />
                            : <ShoppingBag className="w-4 h-4 m-2.5 text-gray-300" />
                          }
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 dark:text-white text-sm">{p.name}</p>
                          {p.sku_base && <p className="text-xs text-gray-400 font-mono">{p.sku_base}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400 text-xs">
                      {(p.category as unknown as { name?: string } | null)?.name ?? '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center text-gray-600 dark:text-gray-400">{p.variants?.length ?? 0}</td>
                    <td className="py-2.5 px-3 text-right font-medium text-gray-800 dark:text-white">{formatCurrency(p.sale_price)}</td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); const v = p.variants?.[0]; if (v) setAjusteDrawer({ open: true, variant: v }); }}
                        className="flex items-center gap-1 ml-auto text-xs text-gray-500 hover:text-brand-primary transition-colors"
                        title="Ajustar estoque">
                        <Package className="w-3 h-3" />
                        {totalStock}
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {PRODUCT_STATUS_LABELS[p.status]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Categories collapsible */}
      <div className="border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowCategories((s) => !s)}
          className="w-full flex items-center gap-3 px-5 py-3.5 bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors text-left">
          <FolderOpen className="w-4 h-4 text-brand-primary" />
          <span className="font-semibold text-sm text-gray-800 dark:text-white flex-1">Categorias</span>
          <button
            onClick={(e) => { e.stopPropagation(); setCategoriaDrawer({ open: true, category: null }); }}
            className="flex items-center gap-1 text-xs font-medium text-brand-primary hover:text-brand-primary-dark mr-3">
            <FolderOpen className="w-3.5 h-3.5" /> + Nova Categoria
          </button>
          {showCategories ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </button>
        {showCategories && (
          <div className="p-4 space-y-2">
            {loading ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
            ) : categories.length === 0
              ? <p className="text-sm text-gray-400 text-center py-4">Nenhuma categoria cadastrada</p>
              : categories.map((cat) => (
                <div key={cat.id}
                  onClick={() => setCategoriaDrawer({ open: true, category: cat })}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors">
                  <FolderOpen className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{cat.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cat.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                    {cat.is_active ? 'Ativa' : 'Inativa'}
                  </span>
                </div>
              ))
            }
          </div>
        )}
      </div>

      {/* Drawers */}
      <ProdutoDrawer
        open={produtoDrawer.open}
        product={produtoDrawer.product}
        categories={categories}
        onClose={() => setProdutoDrawer((s) => ({ ...s, open: false }))}
        onSaved={load}
      />
      <CategoriaDrawer
        open={categoriaDrawer.open}
        category={categoriaDrawer.category}
        categories={categories}
        onClose={() => setCategoriaDrawer((s) => ({ ...s, open: false }))}
        onSaved={load}
      />
      <AjusteEstoqueDrawer
        open={ajusteDrawer.open}
        variant={ajusteDrawer.variant}
        onClose={() => setAjusteDrawer((s) => ({ ...s, open: false }))}
        onSaved={load}
      />
    </div>
  );
}
