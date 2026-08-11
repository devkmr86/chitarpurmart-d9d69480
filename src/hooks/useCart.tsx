import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type CartItem = {
  productId: string;
  name: string;
  price: number;
  qty: number;
  unitLabel: string;
  storeId: string;
  storeName: string;
  imageUrl?: string | null;
};

type CartValue = {
  items: CartItem[];
  storeId: string | null;
  storeName: string | null;
  count: number;
  subtotal: number;
  add: (item: Omit<CartItem, "qty">, qty?: number) => { ok: boolean; conflict?: string };
  setQty: (productId: string, qty: number) => void;
  clear: () => void;
  replaceWith: (item: Omit<CartItem, "qty">) => void;
};

const CartContext = createContext<CartValue | null>(null);
const KEY = "mannu_cart_v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw) as CartItem[]);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items]);

  const storeId = items[0]?.storeId ?? null;
  const storeName = items[0]?.storeName ?? null;

  const value: CartValue = {
    items,
    storeId,
    storeName,
    count: items.reduce((n, i) => n + i.qty, 0),
    subtotal: items.reduce((n, i) => n + i.qty * i.price, 0),
    add: (item, qty = 1) => {
      if (storeId && storeId !== item.storeId) {
        return { ok: false, conflict: storeName ?? "another store" };
      }
      setItems((prev) => {
        const found = prev.find((p) => p.productId === item.productId);
        if (found) {
          return prev.map((p) =>
            p.productId === item.productId ? { ...p, qty: p.qty + qty } : p,
          );
        }
        return [...prev, { ...item, qty }];
      });
      return { ok: true };
    },
    setQty: (productId, qty) =>
      setItems((prev) =>
        qty <= 0
          ? prev.filter((p) => p.productId !== productId)
          : prev.map((p) => (p.productId === productId ? { ...p, qty } : p)),
      ),
    clear: () => setItems([]),
    replaceWith: (item) => setItems([{ ...item, qty: 1 }]),
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
