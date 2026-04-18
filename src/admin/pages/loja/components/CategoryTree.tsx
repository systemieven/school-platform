/**
 * CategoryTree
 *
 * Árvore hierárquica de categorias da loja. Extraída de `ProdutosTab` para
 * ser reutilizada pela nova aba `CategoriasTab` (gestão dedicada).
 */
import { useState } from 'react';
import { FolderOpen, Folder, ChevronDown, ChevronRight } from 'lucide-react';
import type { StoreCategory } from '../../../types/admin.types';

export interface CategoryNode extends Omit<StoreCategory, 'children'> {
  children: CategoryNode[];
}

export function buildCategoryTree(cats: StoreCategory[]): CategoryNode[] {
  const map = new Map<string, CategoryNode>();
  cats.forEach((c) => map.set(c.id, { ...c, children: [] }));
  const roots: CategoryNode[] = [];
  map.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortNodes = (nodes: CategoryNode[]) => {
    nodes.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
    nodes.forEach((n) => sortNodes(n.children));
  };
  sortNodes(roots);
  return roots;
}

/** Flatten tree into [{depth, cat}] for `<select>` options */
export function flattenForSelect(
  nodes: CategoryNode[],
  depth = 0,
): { depth: number; cat: StoreCategory }[] {
  const result: { depth: number; cat: StoreCategory }[] = [];
  for (const node of nodes) {
    result.push({ depth, cat: node });
    result.push(...flattenForSelect(node.children, depth + 1));
  }
  return result;
}

function CategoryRow({
  node,
  depth,
  onEdit,
}: {
  node: CategoryNode;
  depth: number;
  onEdit: (cat: StoreCategory) => void;
}) {
  const [open, setOpen] = useState(true); // todas as categorias começam expandidas
  const hasChildren = node.children.length > 0;
  const indent = depth * 20;

  return (
    <div>
      <div
        onClick={() => onEdit(node)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors group"
        style={{ paddingLeft: `${12 + indent}px` }}
      >
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
            className="p-0.5 rounded text-gray-400 hover:text-brand-primary transition-colors flex-shrink-0"
          >
            {open
              ? <ChevronDown className="w-3.5 h-3.5" />
              : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        ) : (
          <span className="w-5 flex-shrink-0" />
        )}

        {depth === 0
          ? <FolderOpen className={`w-4 h-4 flex-shrink-0 ${node.is_active ? 'text-brand-primary' : 'text-gray-300'}`} />
          : <Folder className={`w-3.5 h-3.5 flex-shrink-0 ${node.is_active ? 'text-gray-400' : 'text-gray-300'}`} />}

        <span className={`text-sm flex-1 ${depth === 0 ? 'font-semibold text-gray-800 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
          {node.name}
        </span>

        {hasChildren && (
          <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
            {node.children.length}
          </span>
        )}

        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
          node.is_active
            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
        }`}>
          {node.is_active ? 'Ativa' : 'Inativa'}
        </span>
      </div>

      {hasChildren && open && (
        <div className="relative">
          <div
            className="absolute top-0 bottom-2 w-px bg-gray-100 dark:bg-gray-700"
            style={{ left: `${20 + indent}px` }}
          />
          {node.children.map((child) => (
            <CategoryRow key={child.id} node={child} depth={depth + 1} onEdit={onEdit} />
          ))}
        </div>
      )}
    </div>
  );
}

export function CategoryTree({
  nodes,
  onEdit,
}: {
  nodes: CategoryNode[];
  onEdit: (cat: StoreCategory) => void;
}) {
  if (nodes.length === 0) return null;
  return (
    <div className="space-y-0.5">
      {nodes.map((node) => (
        <CategoryRow key={node.id} node={node} depth={0} onEdit={onEdit} />
      ))}
    </div>
  );
}
