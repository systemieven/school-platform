import type { StoreProductVariant } from '../../admin/types/admin.types';

interface Props {
  variants: StoreProductVariant[];
  selectedVariantId: string | null;
  onChange: (variantId: string) => void;
}

function cellClass(variant: StoreProductVariant, selected: boolean) {
  const available = variant.stock_quantity > variant.reserved_quantity;
  const low = available && variant.min_stock > 0 && variant.stock_quantity <= variant.min_stock;

  if (!available) {
    return `px-3 py-1.5 rounded-lg border text-xs font-medium cursor-not-allowed opacity-40 ${
      selected ? 'border-gray-400 bg-gray-100' : 'border-gray-200 bg-gray-50'
    }`;
  }
  if (selected) {
    return 'px-3 py-1.5 rounded-lg border-2 border-brand-primary bg-brand-primary text-white text-xs font-medium cursor-pointer';
  }
  if (low) {
    return 'px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 text-xs font-medium cursor-pointer hover:border-amber-400 transition-colors';
  }
  return 'px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-xs font-medium cursor-pointer hover:border-brand-primary transition-colors';
}

export default function GradeSelector({ variants, selectedVariantId, onChange }: Props) {
  const active = variants.filter((v) => v.is_active);

  // Group by color
  const colors = Array.from(new Set(active.map((v) => v.color ?? ''))).filter(Boolean);
  const sizes  = Array.from(new Set(active.map((v) => v.size  ?? ''))).filter(Boolean);
  const noColorSize = active.every((v) => !v.color && !v.size);

  const selected = active.find((v) => v.id === selectedVariantId);

  return (
    <div className="space-y-3">
      {noColorSize ? (
        // Flat list when no color/size attributes
        <div className="flex flex-wrap gap-2">
          {active.map((v) => (
            <button
              key={v.id}
              disabled={v.stock_quantity <= v.reserved_quantity}
              onClick={() => onChange(v.id)}
              className={cellClass(v, v.id === selectedVariantId)}
            >
              {v.sku}
            </button>
          ))}
        </div>
      ) : colors.length > 0 && sizes.length > 0 ? (
        // Matrix: colors as rows, sizes as columns
        <div className="overflow-auto">
          <table className="border-collapse text-xs">
            <thead>
              <tr>
                <th className="text-gray-400 font-normal pr-3 pb-1 text-left">Cor \ Tam</th>
                {sizes.map((sz) => (
                  <th key={sz} className="px-2 pb-1 text-gray-600 font-semibold">{sz}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {colors.map((color) => (
                <tr key={color}>
                  <td className="pr-3 py-1 text-gray-600 font-medium whitespace-nowrap">{color}</td>
                  {sizes.map((sz) => {
                    const v = active.find((vv) => vv.color === color && vv.size === sz);
                    if (!v) return <td key={sz} className="px-2 py-1"><span className="px-3 py-1.5 text-xs text-gray-300">—</span></td>;
                    return (
                      <td key={sz} className="px-2 py-1">
                        <button
                          disabled={v.stock_quantity <= v.reserved_quantity}
                          onClick={() => onChange(v.id)}
                          className={cellClass(v, v.id === selectedVariantId)}
                        >
                          {sz || v.sku}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        // Single dimension (either only colors or only sizes)
        <div className="flex flex-wrap gap-2">
          {active.map((v) => (
            <button
              key={v.id}
              disabled={v.stock_quantity <= v.reserved_quantity}
              onClick={() => onChange(v.id)}
              className={cellClass(v, v.id === selectedVariantId)}
            >
              {v.color || v.size || v.sku}
            </button>
          ))}
        </div>
      )}

      {/* Selected variant info */}
      {selected && (
        <div className="text-xs text-gray-500 mt-1">
          <span className="font-medium text-gray-700">SKU:</span> {selected.sku}
          {' · '}
          {selected.stock_quantity > selected.reserved_quantity ? (
            <span className="text-emerald-600">
              {selected.stock_quantity - selected.reserved_quantity} disponível(is)
            </span>
          ) : (
            <span className="text-red-500">Esgotado</span>
          )}
        </div>
      )}
    </div>
  );
}
