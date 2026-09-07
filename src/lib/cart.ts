"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "housefest_cart_v1";

export type CartItem = {
  productId: number;
  variantId: number | null;
  name: string;
  variantLabel: string | null;   // "Size · M"
  imageUrl: string | null;
  unitPrice: number;             // centavos
  qty: number;
};

function read(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items: CartItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("cart:changed"));
}

function keyOf(i: Pick<CartItem, "productId" | "variantId">) {
  return `${i.productId}::${i.variantId ?? "base"}`;
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    setItems(read());
    const onChange = () => setItems(read());
    window.addEventListener("cart:changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("cart:changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const add = useCallback((item: Omit<CartItem, "qty">, qty = 1) => {
    const current = read();
    const k = keyOf(item);
    const existing = current.find((c) => keyOf(c) === k);
    if (existing) existing.qty += qty;
    else current.push({ ...item, qty });
    write(current);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("cart:added", { detail: { ...item, qty } }),
      );
    }
  }, []);

  const setQty = useCallback((productId: number, variantId: number | null, qty: number) => {
    const current = read();
    const idx = current.findIndex((c) => keyOf({ productId, variantId }) === keyOf(c));
    if (idx === -1) return;
    if (qty <= 0) current.splice(idx, 1);
    else current[idx].qty = qty;
    write(current);
  }, []);

  const remove = useCallback((productId: number, variantId: number | null) => {
    const current = read().filter((c) => keyOf({ productId, variantId }) !== keyOf(c));
    write(current);
  }, []);

  const clear = useCallback(() => write([]), []);

  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const count = items.reduce((s, i) => s + i.qty, 0);

  return { items, add, setQty, remove, clear, subtotal, count };
}

export function formatPHP(centavos: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(centavos / 100);
}
