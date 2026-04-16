import { useState, useCallback, useEffect } from 'react';

export interface CartItem {
  variantId: string;
  productName: string;
  variantDescription: string;
  sku: string;
  quantity: number;
  unitPrice: number;
}

const CART_KEY = 'store_cart';

function readCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  } catch {
    // ignore quota errors
  }
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>(() => readCart());

  // Sync to localStorage on change
  useEffect(() => {
    writeCart(items);
  }, [items]);

  const addItem = useCallback((item: CartItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.variantId === item.variantId);
      if (existing) {
        return prev.map((i) =>
          i.variantId === item.variantId
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        );
      }
      return [...prev, item];
    });
  }, []);

  const removeItem = useCallback((variantId: string) => {
    setItems((prev) => prev.filter((i) => i.variantId !== variantId));
  }, []);

  const updateQuantity = useCallback((variantId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.variantId !== variantId));
    } else {
      setItems((prev) =>
        prev.map((i) => (i.variantId === variantId ? { ...i, quantity } : i))
      );
    }
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const total = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  // TODO: when guardian auth is present, sync cart to Supabase store_cart table

  return { items, addItem, removeItem, updateQuantity, clearCart, itemCount, total };
}
