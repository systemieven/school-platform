import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight } from 'lucide-react';
import { useCart } from '../../hooks/useCart';

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

export default function CarrinhoPage() {
  const { items, removeItem, updateQuantity, total } = useCart();
  const navigate = useNavigate();

  const handleCheckout = () => {
    // Requires guardian auth — redirected inside CheckoutPage if not authenticated
    navigate('/loja/checkout');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <ShoppingBag className="w-6 h-6 text-brand-primary" />
          <h1 className="text-2xl font-bold text-gray-800">Carrinho</h1>
        </div>

        {items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <ShoppingBag className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 mb-4">Seu carrinho está vazio</p>
            <Link to="/loja" className="inline-flex items-center gap-2 text-brand-primary hover:underline text-sm font-medium">
              Continuar comprando
            </Link>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
              {items.map((item) => (
                <div key={item.variantId} className="p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800">{item.productName}</p>
                    {item.variantDescription && (
                      <p className="text-xs text-gray-400 mt-0.5">{item.variantDescription}</p>
                    )}
                    <p className="text-sm font-semibold text-brand-primary mt-1">
                      {formatCurrency(item.unitPrice)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                      className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                      <Minus className="w-3.5 h-3.5 text-gray-600" />
                    </button>
                    <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                      className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                      <Plus className="w-3.5 h-3.5 text-gray-600" />
                    </button>
                  </div>
                  <span className="text-sm font-bold text-gray-800 w-20 text-right">
                    {formatCurrency(item.unitPrice * item.quantity)}
                  </span>
                  <button onClick={() => removeItem(item.variantId)} className="text-red-400 hover:text-red-600 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
              <div className="flex justify-between text-lg font-bold text-gray-800">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
              <button onClick={handleCheckout}
                className="w-full flex items-center justify-center gap-2 py-3 bg-brand-primary hover:bg-brand-primary-dark text-white rounded-2xl font-medium transition-colors">
                Ir para Checkout <ArrowRight className="w-4 h-4" />
              </button>
              <Link to="/loja" className="block text-center text-sm text-gray-400 hover:text-gray-600 transition-colors">
                Continuar comprando
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
