import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { StoreProduct } from '../admin/types/admin.types';

interface UseStoreProductsOptions {
  categoryId?: string | null;
  search?: string;
  featuredOnly?: boolean;
  limit?: number;
}

export function useStoreProducts(options: UseStoreProductsOptions = {}) {
  const { categoryId, search, featuredOnly, limit } = options;
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('store_products')
        .select(`
          *,
          category:store_categories(id, name, slug),
          variants:store_product_variants(*),
          images:store_product_images(*)
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }
      if (featuredOnly) {
        query = query.eq('is_featured', true);
      }
      if (search) {
        query = query.ilike('name', `%${search}%`);
      }
      if (limit) {
        query = query.limit(limit);
      }

      const { data, error: err } = await query;
      if (err) throw err;
      setProducts((data ?? []) as StoreProduct[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  }, [categoryId, search, featuredOnly, limit]);

  useEffect(() => {
    load();
  }, [load]);

  return { products, loading, error, refetch: load };
}
