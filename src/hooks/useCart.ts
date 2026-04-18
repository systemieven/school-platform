/**
 * useCart — Carrinho Hibrido (PRD §10.19)
 *
 * Pre-login: localStorage como fonte de verdade (zero friccao para anonimos).
 * Pos-login do responsavel: merge bidirecional com `store_carts` no servidor
 *   (uniao por variantId, qty=max). Daí em diante, mutacoes gravam em ambos
 *   (localStorage como cache otimista; UPSERT no servidor com debounce 1s).
 * Logout: nao mexe em localStorage; mantem o registro no servidor (proximo
 *   login do mesmo guardian recupera).
 *
 * Le sessao via supabase.auth direto (nao via useGuardian) porque
 * GuardianAuthProvider envolve apenas /responsavel/* — as paginas /loja/*
 * estao fora desse provider.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export interface CartItem {
  variantId: string;
  productName: string;
  variantDescription: string;
  sku: string;
  quantity: number;
  unitPrice: number;
}

const CART_KEY = 'store_cart';
const DEBOUNCE_MS = 1000;

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

/** Uniao por variantId, quantity = max(local, server). Politica documentada em §10.19. */
function mergeCartItems(a: CartItem[], b: CartItem[]): CartItem[] {
  const map = new Map<string, CartItem>();
  for (const item of [...a, ...b]) {
    const existing = map.get(item.variantId);
    map.set(
      item.variantId,
      existing
        ? { ...item, quantity: Math.max(existing.quantity, item.quantity) }
        : item,
    );
  }
  return Array.from(map.values());
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>(() => readCart());
  const [guardianId, setGuardianId] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const mergedOnceRef = useRef(false);

  // Sync local cache on every change
  useEffect(() => {
    writeCart(items);
  }, [items]);

  // Subscribe to auth changes — merge no first login, then keep server in sync
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) setGuardianId(session?.user?.id ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        const newId = session?.user?.id ?? null;
        setGuardianId((prev) => {
          // Logout: limpa o tracker de merge para reabilitar o pull no proximo login
          if (prev && !newId) mergedOnceRef.current = false;
          return newId;
        });
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Merge no primeiro detect de guardian autenticado
  useEffect(() => {
    if (!guardianId || mergedOnceRef.current) return;
    mergedOnceRef.current = true;

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('store_carts')
        .select('items')
        .eq('guardian_id', guardianId)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        // RLS/network: mantem o local; tenta de novo no proximo login
        mergedOnceRef.current = false;
        return;
      }

      const serverItems = (data?.items as CartItem[] | undefined) ?? [];
      setItems((local) => {
        const merged = mergeCartItems(local, serverItems);
        // Sync imediato pos-merge (sem debounce, fora do bloco de mutacao do user)
        void supabase
          .from('store_carts')
          .upsert(
            { guardian_id: guardianId, items: merged, updated_at: new Date().toISOString() },
            { onConflict: 'guardian_id' },
          );
        return merged;
      });
    })();

    return () => { cancelled = true; };
  }, [guardianId]);

  // Debounced UPSERT no servidor sempre que items mudam (so se logado e ja mergeado)
  useEffect(() => {
    if (!guardianId || !mergedOnceRef.current) return;

    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      void supabase
        .from('store_carts')
        .upsert(
          { guardian_id: guardianId, items, updated_at: new Date().toISOString() },
          { onConflict: 'guardian_id' },
        );
      debounceRef.current = null;
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [items, guardianId]);

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
    // Limpa servidor imediato (pos-checkout, sem esperar debounce)
    if (guardianId) {
      void supabase
        .from('store_carts')
        .delete()
        .eq('guardian_id', guardianId);
    }
  }, [guardianId]);

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const total = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  return { items, addItem, removeItem, updateQuantity, clearCart, itemCount, total };
}
