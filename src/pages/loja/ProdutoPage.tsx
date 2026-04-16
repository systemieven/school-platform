import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { ChevronRight, ShoppingBag, ShoppingCart } from 'lucide-react';
import GradeSelector from '../../components/loja/GradeSelector';
import { useCart } from '../../hooks/useCart';
import type { StoreProduct } from '../../admin/types/admin.types';

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

export default function ProdutoPage() {
  const { slug } = useParams<{ slug: string }>();
  const { addItem } = useCart();
  const [product, setProduct] = useState<StoreProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [mainImage, setMainImage] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('store_products')
        .select('*, category:store_categories(*), variants:store_product_variants(*), images:store_product_images(*)')
        .eq('id', slug)
        .single();
      const p = data as unknown as StoreProduct | null;
      setProduct(p);
      if (p) {
        const cover = p.images?.find((img) => img.is_cover) ?? p.images?.[0];
        setMainImage(cover?.url ?? null);
        const firstActive = p.variants?.find((v) => v.is_active && v.stock_quantity > 0);
        if (firstActive) setSelectedVariantId(firstActive.id);
      }
      setLoading(false);
    })();
  }, [slug]);

  const selectedVariant = product?.variants?.find((v) => v.id === selectedVariantId) ?? null;
  const effectivePrice = selectedVariant?.price_override ?? product?.sale_price ?? 0;
  const available = selectedVariant ? selectedVariant.stock_quantity > selectedVariant.reserved_quantity : false;

  const handleAddToCart = () => {
    if (!product || !selectedVariant) return;
    const desc = [selectedVariant.color, selectedVariant.size].filter(Boolean).join(' · ');
    addItem({
      variantId: selectedVariant.id,
      productName: product.name,
      variantDescription: desc,
      sku: selectedVariant.sku,
      quantity: 1,
      unitPrice: effectivePrice,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <ShoppingBag className="w-10 h-10 text-gray-200 animate-pulse" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3">
        <ShoppingBag className="w-12 h-12 text-gray-200" />
        <p className="text-gray-400">Produto não encontrado</p>
        <Link to="/loja" className="text-brand-primary hover:underline text-sm">Voltar para a loja</Link>
      </div>
    );
  }

  const cat = product.category as unknown as { name: string; slug: string | null } | null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-2 text-sm text-gray-500 flex-wrap">
          <Link to="/loja" className="hover:text-brand-primary transition-colors">Loja</Link>
          {cat && (
            <>
              <ChevronRight className="w-4 h-4" />
              <Link to={cat.slug ? `/loja/categoria/${cat.slug}` : '/loja'} className="hover:text-brand-primary transition-colors">{cat.name}</Link>
            </>
          )}
          <ChevronRight className="w-4 h-4" />
          <span className="text-gray-800 font-medium truncate">{product.name}</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="grid md:grid-cols-2 gap-10">
          {/* Images */}
          <div className="space-y-3">
            <div className="aspect-square bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {mainImage
                ? <img src={mainImage} alt={product.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="w-16 h-16 text-gray-200" /></div>
              }
            </div>
            {(product.images?.length ?? 0) > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {product.images?.map((img) => (
                  <button key={img.id} onClick={() => setMainImage(img.url)}
                    className={`w-16 h-16 rounded-xl border-2 overflow-hidden flex-shrink-0 transition-colors ${mainImage === img.url ? 'border-brand-primary' : 'border-transparent'}`}>
                    <img src={img.url} alt={img.alt_text ?? ''} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{product.name}</h1>
              {product.short_description && (
                <p className="text-gray-500 mt-2 text-sm">{product.short_description}</p>
              )}
            </div>

            <div className="text-3xl font-bold text-brand-primary">
              {formatCurrency(effectivePrice)}
            </div>

            {/* Variants */}
            {(product.variants?.length ?? 0) > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Selecione a variante</p>
                <GradeSelector
                  variants={product.variants ?? []}
                  selectedVariantId={selectedVariantId}
                  onChange={setSelectedVariantId}
                />
              </div>
            )}

            {/* Add to cart */}
            <button
              onClick={handleAddToCart}
              disabled={!selectedVariant || !available}
              className={`w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl font-medium text-sm transition-all ${
                added ? 'bg-emerald-500 text-white' :
                !available ? 'bg-gray-200 text-gray-400 cursor-not-allowed' :
                'bg-brand-primary hover:bg-brand-primary-dark text-white'
              }`}>
              <ShoppingCart className="w-5 h-5" />
              {added ? 'Adicionado!' : !available ? 'Esgotado' : 'Adicionar ao Carrinho'}
            </button>

            {/* Description */}
            {product.description && (
              <div className="prose prose-sm max-w-none text-gray-600">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Descrição</h3>
                <p className="text-sm">{product.description}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
