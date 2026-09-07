"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart, formatPHP, type CartItem } from "@/lib/cart";
import styles from "./Store.module.css";

export default function StoreHeader({
  extraRight,
}: {
  extraRight?: React.ReactNode;
}) {
  const { count, items, setQty, remove, subtotal } = useCart();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toast, setToast] = useState<CartItem | null>(null);

  // Listen for global add-to-cart events and show a floating toast
  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    function onAdded(e: Event) {
      const detail = (e as CustomEvent).detail as CartItem;
      setToast(detail);
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => setToast(null), 3500);
    }
    window.addEventListener("cart:added", onAdded as EventListener);
    return () => {
      window.removeEventListener("cart:added", onAdded as EventListener);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, []);

  // Close drawer on Escape
  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    window.addEventListener("keydown", onKey);
    // lock body scroll while drawer open
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/store" className={styles.brand}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/SC_Logo.svg" alt="SC" className={styles.brandLogo} />
            <span className={styles.brandText}>
              <span className={styles.brandLine1}>STUDENT</span>
              <span className={styles.brandLine2}>COUNCIL</span>
            </span>
          </Link>
        </div>
        <div className={styles.headerRight}>
          {extraRight}
          <Link href="/" className={styles.navLink}>Scoreboard</Link>
          <button
            type="button"
            className={styles.cartBtn}
            onClick={() => setDrawerOpen(true)}
            aria-label="Open cart"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/cart.svg" alt="" aria-hidden className={styles.cartIcon} />
            <span>Cart</span>
            {count > 0 && <span className={styles.cartCount}>{count}</span>}
          </button>
        </div>
      </header>

      {/* Add-to-cart toast */}
      {toast && (
        <div className={styles.toast} role="status">
          <div className={styles.toastIcon} aria-hidden>✓</div>
          <div className={styles.toastBody}>
            <div className={styles.toastTitle}>Added to cart</div>
            <div className={styles.toastSub}>
              {toast.name}
              {toast.variantLabel && <> · {toast.variantLabel}</>}
            </div>
          </div>
          <button
            className={styles.toastAction}
            onClick={() => {
              setToast(null);
              setDrawerOpen(true);
            }}
          >
            View cart
          </button>
        </div>
      )}

      {/* Cart drawer */}
      {drawerOpen && (
        <div className={styles.drawerRoot}>
          <div
            className={styles.drawerBackdrop}
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <aside className={styles.drawer} role="dialog" aria-label="Shopping cart">
            <div className={styles.drawerHead}>
              <div>
                <div className={styles.drawerTitle}>Your cart</div>
                <div className={styles.drawerSub}>
                  {count === 0 ? "Empty" : `${count} item${count === 1 ? "" : "s"}`}
                </div>
              </div>
              <button
                className={styles.drawerClose}
                onClick={() => setDrawerOpen(false)}
                aria-label="Close cart"
              >×</button>
            </div>

            {items.length === 0 ? (
              <div className={styles.drawerEmpty}>
                Your cart is empty.
                <Link
                  href="/store"
                  className={styles.inlineLink}
                  onClick={() => setDrawerOpen(false)}
                >
                  Browse merch
                </Link>
              </div>
            ) : (
              <div className={styles.drawerList}>
                {items.map((it) => (
                  <div
                    key={`${it.productId}-${it.variantId ?? "base"}`}
                    className={styles.drawerRow}
                  >
                    <div className={styles.drawerImg}>
                      {it.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.imageUrl} alt={it.name} />
                      ) : (
                        <div className={styles.cardImgPlaceholder} />
                      )}
                    </div>
                    <div className={styles.drawerInfo}>
                      <div className={styles.drawerName}>{it.name}</div>
                      {it.variantLabel && (
                        <div className={styles.drawerVariant}>{it.variantLabel}</div>
                      )}
                      <div className={styles.drawerControls}>
                        <div className={styles.qtyControls}>
                          <button
                            className={styles.qtyBtn}
                            onClick={() => setQty(it.productId, it.variantId, it.qty - 1)}
                          >−</button>
                          <input
                            className={styles.qtyInput}
                            type="number"
                            min={1}
                            value={it.qty}
                            onChange={(e) =>
                              setQty(
                                it.productId,
                                it.variantId,
                                Math.max(1, Number(e.target.value) || 1),
                              )
                            }
                          />
                          <button
                            className={styles.qtyBtn}
                            onClick={() => setQty(it.productId, it.variantId, it.qty + 1)}
                          >+</button>
                        </div>
                        <button
                          className={styles.cartRemove}
                          onClick={() => remove(it.productId, it.variantId)}
                        >Remove</button>
                      </div>
                    </div>
                    <div className={styles.drawerLine}>
                      {formatPHP(it.unitPrice * it.qty)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {items.length > 0 && (
              <div className={styles.drawerFoot}>
                <div className={styles.drawerTotal}>
                  <span>Subtotal</span>
                  <span>{formatPHP(subtotal)}</span>
                </div>
                <Link
                  href="/store/cart"
                  className={styles.primaryBtn}
                  onClick={() => setDrawerOpen(false)}
                >
                  Go to checkout
                </Link>
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
