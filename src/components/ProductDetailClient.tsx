"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCart, formatPHP } from "@/lib/cart";
import StoreHeader from "./StoreHeader";
import styles from "./Store.module.css";

type Variant = {
  id: number;
  group: string;
  option: string;
  price: number;
  stock: number;
};

type Product = {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  category: string | null;
  basePrice: number;
  active: boolean;
  variants: Variant[];
};

export default function ProductDetailClient({ productId }: { productId: number }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);
  const [flash, setFlash] = useState("");
  const { add } = useCart();

  useEffect(() => {
    fetch(`/api/products/${productId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setProduct(data);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [productId]);

  // group variants by their "group" label (e.g. "Size")
  const groups = useMemo(() => {
    if (!product) return [] as { group: string; options: Variant[] }[];
    const map = new Map<string, Variant[]>();
    for (const v of product.variants) {
      const arr = map.get(v.group) ?? [];
      arr.push(v);
      map.set(v.group, arr);
    }
    return Array.from(map.entries()).map(([group, options]) => ({ group, options }));
  }, [product]);

  // The chosen variant: only meaningful when product has variants AND all groups selected.
  const chosenVariant: Variant | null = useMemo(() => {
    if (!product || product.variants.length === 0) return null;
    if (groups.length === 0) return null;

    // If there's exactly one group, match by chosen option
    if (groups.length === 1) {
      const g = groups[0];
      const opt = selected[g.group];
      return g.options.find((v) => v.option === opt) ?? null;
    }

    // Multiple groups: current simple model treats each variant row as independent,
    // so we match a single row by (group, option) pair chosen last.
    // For MVP, we require a single group selection to be meaningful.
    const pick = Object.entries(selected)[0];
    if (!pick) return null;
    const [g, o] = pick;
    return product.variants.find((v) => v.group === g && v.option === o) ?? null;
  }, [product, groups, selected]);

  if (!loaded) {
    return <ShellWithHeader><div className={styles.empty}>Loading...</div></ShellWithHeader>;
  }
  if (!product) {
    return (
      <ShellWithHeader>
        <div className={styles.empty}>
          Product not found. <Link href="/store" className={styles.inlineLink}>Back to store</Link>
        </div>
      </ShellWithHeader>
    );
  }

  const hasVariants = product.variants.length > 0;
  const unitPrice = chosenVariant?.price ?? product.basePrice;
  const stock = chosenVariant?.stock ?? (hasVariants ? 0 : Infinity);
  const canAdd = hasVariants ? !!chosenVariant && stock > 0 : true;

  function handleAdd() {
    if (!product) return;
    add(
      {
        productId: product.id,
        variantId: chosenVariant?.id ?? null,
        name: product.name,
        variantLabel: chosenVariant ? `${chosenVariant.group} · ${chosenVariant.option}` : null,
        imageUrl: product.imageUrl,
        unitPrice,
      },
      qty,
    );
    setFlash("Added to cart");
    setTimeout(() => setFlash(""), 1400);
  }

  return (
    <ShellWithHeader>
      <div className={styles.detail}>
        <div className={styles.detailImg}>
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.imageUrl} alt={product.name} />
          ) : (
            <div className={styles.cardImgPlaceholder}>No image</div>
          )}
        </div>

        <div className={styles.detailInfo}>
          {product.category && <div className={styles.cardCategory}>{product.category}</div>}
          <h1 className={styles.detailName}>{product.name}</h1>
          <div className={styles.detailPrice}>{formatPHP(unitPrice)}</div>

          {product.description && (
            <p className={styles.detailDesc}>{product.description}</p>
          )}

          {groups.map((g) => (
            <div key={g.group} className={styles.optionGroup}>
              <div className={styles.optionGroupLabel}>{g.group}</div>
              <div className={styles.optionList}>
                {g.options.map((v) => {
                  const isSelected = selected[g.group] === v.option;
                  const disabled = v.stock === 0;
                  return (
                    <button
                      key={v.id}
                      disabled={disabled}
                      className={`${styles.optionBtn} ${isSelected ? styles.optionBtnActive : ""}`}
                      onClick={() =>
                        setSelected((p) => ({ ...p, [g.group]: v.option }))
                      }
                    >
                      {v.option}
                      {disabled && <span className={styles.optionOut}>Out</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className={styles.qtyRow}>
            <div className={styles.qtyLabel}>Quantity</div>
            <div className={styles.qtyControls}>
              <button
                className={styles.qtyBtn}
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >−</button>
              <input
                className={styles.qtyInput}
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
              />
              <button
                className={styles.qtyBtn}
                onClick={() => setQty((q) => q + 1)}
              >+</button>
            </div>
          </div>

          {hasVariants && !chosenVariant && (
            <div className={styles.hint}>Select an option to continue.</div>
          )}
          {chosenVariant && (
            <div className={styles.hint}>
              {chosenVariant.stock > 0
                ? `${chosenVariant.stock} in stock`
                : "Out of stock"}
            </div>
          )}

          <button
            className={styles.primaryBtn}
            onClick={handleAdd}
            disabled={!canAdd}
          >
            {flash || "Add to cart"}
          </button>

          <Link href="/store" className={styles.backLink}>Back to store</Link>
        </div>
      </div>
    </ShellWithHeader>
  );
}

function ShellWithHeader({ children }: { children: React.ReactNode; count?: number }) {
  return (
    <div className={styles.wrap}>
      <StoreHeader />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
