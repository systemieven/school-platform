import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { Loader2, ShoppingBag, Package } from 'lucide-react';
import type { StoreProduct, StoreCategory } from '../../../types/admin.types';
import { PRODUCT_STATUS_LABELS } from '../../../types/admin.types';
import { usePermissions } from '../../../contexts/PermissionsContext';
import { buildCategoryTree, flattenForSelect } from '../components/CategoryTree';
import ProdutoDrawer from '../drawers/ProdutoDrawer';
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

function getFiscalStatus(p: StoreProduct & { fiscal?: { ncm?: string; cfop_saida?: string; cst_icms?: string; csosn?: string; cst_pis?: string; cst_cofins?: string } | null }): 'complete' | 'incomplete' | 'none' {
  const f = p.fiscal as { ncm?: string; cfop_saida?: string; cst_icms?: string; csosn?: string; cst_pis?: string; cst_cofins?: string } | null;
  if (!f) return 'none';
  const hasCst = !!(f.cst_icms || f.csosn);
  if (f.ncm && f.cfop_saida && hasCst && f.cst_pis && f.cst_cofins) return 'complete';
  if (f.ncm || f.cfop_saida || hasCst || f.cst_pis || f.cst_cofins) return 'incomplete';
  return 'none';
}

// ── ProdutosTab ───────────────────────────────────────────────────────────────

export default function ProdutosTab() {
  const { can } = usePermissions();
  const canCreate = can('store-products', 'create');
  const canEdit = can('store-products', 'edit');
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const [produtoDrawer, setProdutoDrawer] = useState<{ open: boolean; product: StoreProduct | null }>({ open: false, product: null });
  const [ajusteDrawer, setAjusteDrawer] = useState<{ open: boolean; variant: import('../../../types/admin.types').StoreProductVariant | null }>({ open: false, variant: null });

  const load = useCallback(async () => {
    setLoading(true);
    const [prodRes, catRes] = await Promise.all([
      supabase.from('store_products').select('*, category:store_categories(id,name), variants:store_product_variants(*), images:store_product_images(*), fiscal:product_fiscal_data(ncm,cfop_saida,cst_icms,csosn,cst_pis,cst_cofins,gera_nfe)').order('created_at', { ascending: false }),
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
          {flattenForSelect(buildCategoryTree(categories)).map(({ depth, cat }) => (
            <option key={cat.id} value={cat.id}>
              {depth > 0 ? '\u00a0\u00a0'.repeat(depth) + '└ ' : ''}{cat.name}
            </option>
          ))}
        </select>
        <div className="flex-1" />
        {canCreate && (
          <button
            onClick={() => setProdutoDrawer({ open: true, product: null })}
            className="flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-brand-primary-dark text-white rounded-xl text-sm font-medium transition-colors">
            <ShoppingBag className="w-4 h-4" /> Novo Produto
          </button>
        )}
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
                <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Fiscal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-12 text-center text-sm text-gray-400">Nenhum produto encontrado</td></tr>
              )}
              {filtered.map((p) => {
                const coverImage = p.images?.find((img) => img.is_cover) ?? p.images?.[0];
                const totalStock = p.variants?.reduce((s, v) => s + v.stock_quantity, 0) ?? 0;
                return (
                  <tr key={p.id}
                    onClick={canEdit ? () => setProdutoDrawer({ open: true, product: p }) : undefined}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${canEdit ? 'cursor-pointer' : ''}`}>
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
                      {canEdit ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); const v = p.variants?.[0]; if (v) setAjusteDrawer({ open: true, variant: v }); }}
                          className="flex items-center gap-1 ml-auto text-xs text-gray-500 hover:text-brand-primary transition-colors"
                          title="Ajustar estoque">
                          <Package className="w-3 h-3" />
                          {totalStock}
                        </button>
                      ) : (
                        <span className="flex items-center gap-1 ml-auto text-xs text-gray-500 justify-end">
                          <Package className="w-3 h-3" />
                          {totalStock}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {PRODUCT_STATUS_LABELS[p.status]}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {(() => {
                        const fs = getFiscalStatus(p as StoreProduct & { fiscal?: { ncm?: string; cfop_saida?: string; cst_icms?: string; csosn?: string; cst_pis?: string; cst_cofins?: string } | null });
                        if (fs === 'complete') return <span title="Dados fiscais completos" className="text-emerald-500 text-base">✅</span>;
                        if (fs === 'incomplete') return <span title="Dados fiscais incompletos" className="text-amber-400 text-base">⚠️</span>;
                        return <span title="Sem dados fiscais" className="text-gray-300 text-xs">—</span>;
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawers */}
      <ProdutoDrawer
        open={produtoDrawer.open}
        product={produtoDrawer.product}
        categories={categories}
        onClose={() => setProdutoDrawer((s) => ({ ...s, open: false }))}
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
