/**
 * CategoriasTab
 *
 * Gestão dedicada de categorias da loja. Separada de ProdutosTab para
 * preparar a escala quando houver centenas de produtos — a hierarquia
 * fica acessível diretamente pela tab rail, sem depender de um card
 * auxiliar dentro da aba de produtos.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { Loader2, FolderPlus, Search } from 'lucide-react';
import type { StoreCategory } from '../../../types/admin.types';
import { usePermissions } from '../../../contexts/PermissionsContext';
import { buildCategoryTree, CategoryTree } from '../components/CategoryTree';
import CategoriaDrawer from '../drawers/CategoriaDrawer';

export default function CategoriasTab() {
  const { can } = usePermissions();
  const canCreate = can('store-products', 'create');
  const canEdit = can('store-products', 'edit');

  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [drawer, setDrawer] = useState<{ open: boolean; category: StoreCategory | null }>({ open: false, category: null });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('store_categories')
      .select('*')
      .order('position');
    setCategories((data ?? []) as StoreCategory[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Filtro: se houver busca, preserva apenas categorias cujo nome casa OU
  // que são ancestrais de um match (mantém hierarquia renderizável).
  const filteredTree = useMemo(() => {
    const tree = buildCategoryTree(categories);
    const q = search.trim().toLowerCase();
    if (!q) return tree;

    const filterNode = (node: ReturnType<typeof buildCategoryTree>[number]): typeof node | null => {
      const selfMatch = node.name.toLowerCase().includes(q);
      const children = node.children
        .map(filterNode)
        .filter((c): c is NonNullable<typeof c> => c !== null);
      if (selfMatch || children.length > 0) {
        return { ...node, children };
      }
      return null;
    };

    return tree
      .map(filterNode)
      .filter((n): n is NonNullable<typeof n> => n !== null);
  }, [categories, search]);

  const stats = useMemo(() => {
    const total = categories.length;
    const active = categories.filter((c) => c.is_active).length;
    const roots = categories.filter((c) => !c.parent_id).length;
    return { total, active, roots };
  }, [categories]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar categorias..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white placeholder-gray-400"
          />
        </div>

        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span><strong className="text-gray-800 dark:text-white">{stats.total}</strong> totais</span>
          <span><strong className="text-emerald-600 dark:text-emerald-400">{stats.active}</strong> ativas</span>
          <span><strong className="text-brand-primary dark:text-brand-secondary">{stats.roots}</strong> raízes</span>
        </div>

        <div className="flex-1" />
        {canCreate && (
          <button
            onClick={() => setDrawer({ open: true, category: null })}
            className="flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-brand-primary-dark text-white rounded-xl text-sm font-medium transition-colors">
            <FolderPlus className="w-4 h-4" /> Nova Categoria
          </button>
        )}
      </div>

      {/* Tree */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-12">
            <FolderPlus className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-400 mb-4">Nenhuma categoria cadastrada</p>
            {canCreate && (
              <button
                onClick={() => setDrawer({ open: true, category: null })}
                className="text-sm text-brand-primary hover:text-brand-primary-dark font-medium">
                Criar primeira categoria
              </button>
            )}
          </div>
        ) : filteredTree.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            Nenhuma categoria encontrada para "{search}"
          </p>
        ) : (
          <CategoryTree
            nodes={filteredTree}
            onEdit={canEdit ? (cat) => setDrawer({ open: true, category: cat }) : () => {}}
          />
        )}
      </div>

      {/* Drawer */}
      <CategoriaDrawer
        open={drawer.open}
        category={drawer.category}
        categories={categories}
        onClose={() => setDrawer((s) => ({ ...s, open: false }))}
        onSaved={load}
      />
    </div>
  );
}
