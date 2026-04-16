import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { ShoppingBag, ChevronRight } from 'lucide-react';
import ProductCard from '../../components/loja/ProductCard';
import type { StoreProduct, StoreCategory } from '../../admin/types/admin.types';

export default function CategoriaPage() {
  const { slug } = useParams<{ slug: string }>();
  const [category, setCategory] = useState<StoreCategory | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      const { data: cat } = await supabase
        .from('store_categories')
        .select('*')
        .eq('slug', slug)
        .single();
      setCategory(cat as StoreCategory | null);

      if (cat) {
        const { data } = await supabase
          .from('store_products')
          .select('*, category:store_categories(id,name,slug), variants:store_product_variants(*), images:store_product_images(*)')
          .eq('category_id', cat.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false });
        setProducts((data ?? []) as unknown as StoreProduct[]);
      }
      setLoading(false);
    })();
  }, [slug]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-2 text-sm text-gray-500">
          <Link to="/loja" className="hover:text-brand-primary transition-colors">Loja</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-gray-800 font-medium">{category?.name ?? slug}</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">{category?.name ?? slug}</h1>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl h-56 animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingBag className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400">Nenhum produto nesta categoria</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>
    </div>
  );
}
