"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatPHP } from "@/lib/cart";
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

const LOW_STOCK_THRESHOLD = 5;

export default function StoreClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((data: Product[]) => {
        setProducts(data);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const categories = useMemo(
    () =>
      Array.from(
        new Set(products.map((p) => p.category).filter((c): c is string => !!c)),
      ),
    [products],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (!q) return true;
      const inName = p.name.toLowerCase().includes(q);
      const inDesc = p.description?.toLowerCase().includes(q) ?? false;
      const inCat = p.category?.toLowerCase().includes(q) ?? false;
      return inName || inDesc || inCat;
    });
  }, [products, category, query]);

  return (
    <div className={styles.wrap}>
      <StoreHeader />

      {/* ═══ HERO ═══ */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroKicker}>OFFICIAL MERCH · A.Y. 2025–2026</div>
          <h1 className={styles.heroTitle}>SC STORE</h1>
          <p className={styles.heroSub}>
            Rep your house. Support your council. Limited-run apparel and accessories,
            available only during Housefest season.
          </p>
        </div>
      </section>

      <main className={styles.main}>
        {/* ═══ SEARCH ═══ */}
        <div className={styles.searchRow}>
          <div className={styles.searchWrap}>
            <SearchIcon />
            <input
              type="search"
              placeholder="Search merch..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={styles.searchInput}
              aria-label="Search products"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className={styles.searchClear}
                aria-label="Clear search"
              >×</button>
            )}
          </div>
        </div>

        {/* ═══ FILTER BAR ═══ */}
        <div className={styles.filterRow}>
          <div className={styles.filterBar}>
            <button
              className={`${styles.filterBtn} ${category === "all" ? styles.filterBtnActive : ""}`}
              onClick={() => setCategory("all")}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c}
                className={`${styles.filterBtn} ${category === c ? styles.filterBtnActive : ""}`}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <div className={styles.resultCount}>
            {loaded && `${filtered.length} ${filtered.length === 1 ? "product" : "products"}`}
          </div>
        </div>

        {!loaded ? (
          <div className={styles.grid}>
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            {query ? (
              <>
                No matches for &ldquo;{query}&rdquo;.{" "}
                <button className={styles.linkBtn} onClick={() => setQuery("")}>
                  Clear search
                </button>
              </>
            ) : (
              "No products available yet."
            )}
          </div>
        ) : (
          <div className={styles.grid}>
            {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span>De La Salle University Student Council · Housefest 2025–2026</span>
          <div className={styles.footerLinks}>
            <Link href="/" className={styles.footerLink}>Scoreboard</Link>
            <Link href="/store" className={styles.footerLink}>Store</Link>
            <Link href="/store/cart" className={styles.footerLink}>Cart</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  const prices = product.variants.length > 0
    ? product.variants.map((v) => v.price)
    : [product.basePrice];
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const priceLabel = min === max ? formatPHP(min) : `${formatPHP(min)} – ${formatPHP(max)}`;

  // Stock is only meaningful when variants exist; standalone products = unlimited (unknown).
  const totalStock = product.variants.length > 0
    ? product.variants.reduce((s, v) => s + v.stock, 0)
    : null;
  const isSoldOut = totalStock === 0;
  const isLowStock =
    totalStock !== null && totalStock > 0 && totalStock <= LOW_STOCK_THRESHOLD;

  return (
    <Link href={`/store/${product.id}`} className={styles.card}>
      <div className={styles.cardImg}>
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt={product.name} />
        ) : (
          <div className={styles.cardImgPlaceholder}>
            <ImageIcon />
          </div>
        )}
        {isSoldOut && <div className={styles.soldOut}>Sold out</div>}
        {isLowStock && (
          <div className={styles.lowStock}>
            Only {totalStock} left
          </div>
        )}
        <div className={styles.cardOverlay}>
          <span className={styles.cardOverlayText}>View product</span>
        </div>
      </div>
      <div className={styles.cardBody}>
        {product.category && <div className={styles.cardCategory}>{product.category}</div>}
        <div className={styles.cardName}>{product.name}</div>
        <div className={styles.cardPrice}>{priceLabel}</div>
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className={styles.card} aria-hidden>
      <div className={`${styles.cardImg} ${styles.skeleton}`} />
      <div className={styles.cardBody}>
        <div className={`${styles.skeletonLine} ${styles.skeletonLineSm}`} />
        <div className={`${styles.skeletonLine} ${styles.skeletonLineLg}`} />
        <div className={`${styles.skeletonLine} ${styles.skeletonLineMd}`} />
      </div>
    </div>
  );
}

function ImageIcon() {
  return (
    <svg
      width="40" height="40" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={styles.searchIcon}
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
