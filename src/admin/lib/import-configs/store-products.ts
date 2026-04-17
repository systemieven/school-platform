/**
 * Config de importacao de Produtos da loja.
 */
import { Package } from 'lucide-react';
import type { ModuleImportConfig } from '../import-wizard';
import { supabase } from '../../../lib/supabase';

const FIELDS = [
  { key: 'name', label: 'Nome do produto', required: true },
  { key: 'sale_price', label: 'Preço de venda (R$)', required: true },
  { key: 'sku_base', label: 'SKU base' },
  { key: 'short_description', label: 'Descrição curta' },
  { key: 'description', label: 'Descrição completa' },
  { key: 'cost_price', label: 'Preço de custo (R$)' },
  { key: 'category_name', label: 'Categoria (nome)' },
  { key: 'is_featured', label: 'Destaque (sim/nao)' },
  { key: 'is_digital', label: 'Digital (sim/nao)' },
];

const FIELD_ALIASES: Record<string, string[]> = {
  name:              ['nome', 'name', 'produto', 'product', 'descricao', 'titulo'],
  sale_price:        ['preco', 'price', 'precovenda', 'saleprice', 'valor'],
  sku_base:          ['sku', 'skubase', 'codigo', 'codigoproduto', 'ref'],
  short_description: ['descricaocurta', 'resumo', 'shortdescription'],
  description:       ['descricaocompleta', 'descricao', 'description'],
  cost_price:        ['precocusto', 'custo', 'costprice'],
  category_name:     ['categoria', 'category', 'categoryname'],
  is_featured:       ['destaque', 'featured', 'emdestaque'],
  is_digital:        ['digital', 'isdigital'],
};

function parseBool(v: string): boolean {
  const s = v.trim().toLowerCase();
  return s === 'sim' || s === 'true' || s === '1' || s === 'yes' || s === 's';
}

function parseMoney(v: string): number | null {
  if (!v) return null;
  const cleaned = v.replace(/[^\d,.\-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

interface StoreProductsContext extends Record<string, unknown> {
  categoryByName: Record<string, string>;
}

export const STORE_PRODUCTS_IMPORT_CONFIG: ModuleImportConfig<StoreProductsContext> = {
  moduleKey: 'store-products',
  label: 'Produto',
  labelPlural: 'produtos',
  icon: Package,
  backPath: '/admin/migracao',
  targetTable: 'store_products',
  templateFileName: 'modelo_importacao_produtos',

  fields: FIELDS,
  fieldAliases: FIELD_ALIASES,

  async loadExistingKeys() {
    const { data } = await supabase
      .from('store_products')
      .select('sku_base')
      .not('sku_base', 'is', null);
    return new Set((data ?? []).map((r: { sku_base: string }) => r.sku_base.trim()).filter(Boolean));
  },

  getRowKey(row, mapping) {
    const col = mapping['sku_base'];
    if (!col) return '';
    return (row[col] ?? '').trim();
  },

  validateRow(row, mapping, _extras, ctx) {
    const errors: string[] = [];
    const mapped: Record<string, string> = {};
    for (const [field, column] of Object.entries(mapping)) {
      if (column) mapped[field] = row[column] ?? '';
    }

    if (!mapped.name?.trim()) errors.push('Nome é obrigatório');
    const price = parseMoney(mapped.sale_price ?? '');
    if (price === null || price < 0) errors.push('Preço de venda inválido');

    if (mapped.cost_price && parseMoney(mapped.cost_price) === null) {
      errors.push('Preço de custo inválido');
    }

    const sku = mapped.sku_base?.trim();
    if (sku) {
      if (ctx.existingKeys.has(sku)) errors.push(`SKU ${sku} já cadastrado`);
      else if (ctx.fileKeys.has(sku)) errors.push(`SKU ${sku} duplicado na planilha`);
    }

    return errors;
  },

  async preImport() {
    const { data } = await supabase.from('store_categories').select('id, name');
    const map: Record<string, string> = {};
    for (const cat of (data ?? []) as { id: string; name: string }[]) {
      map[cat.name.trim().toLowerCase()] = cat.id;
    }
    return { categoryByName: map };
  },

  buildRecord(mappedRow, _extras, _i, ctx) {
    const record: Record<string, unknown> = {
      name: mappedRow.name?.trim() || null,
      sale_price: parseMoney(mappedRow.sale_price ?? '') ?? 0,
      sku_base: mappedRow.sku_base?.trim() || null,
      short_description: mappedRow.short_description?.trim() || null,
      description: mappedRow.description?.trim() || null,
      cost_price: mappedRow.cost_price ? parseMoney(mappedRow.cost_price) : null,
      is_featured: mappedRow.is_featured ? parseBool(mappedRow.is_featured) : false,
      is_digital: mappedRow.is_digital ? parseBool(mappedRow.is_digital) : false,
      status: 'active',
    };
    const catName = mappedRow.category_name?.trim().toLowerCase();
    if (catName && ctx.categoryByName[catName]) {
      record.category_id = ctx.categoryByName[catName];
    }
    return record;
  },
};
