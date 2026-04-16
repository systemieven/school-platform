import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import type { StoreProduct } from '../../admin/types/admin.types';

interface Props {
  product: StoreProduct;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function StockBadge({ product }: { product: StoreProduct }) {
  const totalStock = product.variants?.reduce((s, v) => s + v.stock_quantity, 0) ?? 0;
  const minStock = product.variants?.reduce((s, v) => s + v.min_stock, 0) ?? 0;

  if (product.status === 'out_of_stock' || totalStock === 0) {
    return (
      <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
        Esgotado
      </span>
    );
  }
  if (minStock > 0 && totalStock <= minStock) {
    return (
      <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
        Poucas Unidades
      </span>
    );
  }
  return (
    <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
      Em Estoque
    </span>
  );
}

export default function ProductCard({ product }: Props) {
  const coverImage = product.images?.find((img) => img.is_cover) ?? product.images?.[0];

  return (
    <Link
      to={`/loja/produto/${product.id}`}
      className="group block bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
    >
      {/* Image */}
      <div className="aspect-square bg-gray-50 overflow-hidden">
        {coverImage ? (
          <img
            src={coverImage.url}
            alt={coverImage.alt_text ?? product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag className="w-12 h-12 text-gray-200" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2 group-hover:text-brand-primary transition-colors">
          {product.name}
        </h3>
        {product.short_description && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{product.short_description}</p>
        )}
        <div className="flex items-center justify-between mt-3">
          <span className="font-bold text-brand-primary text-base">
            {formatCurrency(product.sale_price)}
          </span>
          <StockBadge product={product} />
        </div>
      </div>
    </Link>
  );
}
