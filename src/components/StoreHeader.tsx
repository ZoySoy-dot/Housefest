"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { useCart, formatPHP, type CartItem } from "@/lib/cart";
import { serviceFeeFor } from "@/lib/fees";
import styles from "./Store.module.css";

export default function StoreHeader({
  extraRight,
}: {
  extraRight?: React.ReactNode;
}) {
  const { count, items, setQty, remove, subtotal } = useCart();
  const { data: session, status } = useSession();
  const isSignedIn = status === "authenticated";
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
          <nav className={styles.headerNav} aria-label="Store">
            <Link href="/store" className={styles.navLink}>Store</Link>
            {isSignedIn && (
              <Link href="/store/orders" className={styles.navLink}>My orders</Link>
            )}
            <Link href="/" className={styles.navLink}>Housefest</Link>
          </nav>
        </div>
        <div className={styles.headerRight}>
          {extraRight}
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
          {isSignedIn ? (
            <button
              type="button"
              className={styles.authBtn}
              onClick={() => signOut({ callbackUrl: "/store" })}
              title={session?.user?.email ?? ""}
            >
              Sign out
            </button>
          ) : (
            <button
              type="button"
              className={`${styles.authBtn} ${styles.authBtnPrimary}`}
              onClick={() => signIn("google")}
            >
              <GoogleIcon />
              Sign in
            </button>
          )}
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
                <div
                  className={styles.drawerTotal}
                  style={{ color: "#a8adb5", fontSize: "0.8rem", fontWeight: 500 }}
                >
                  <span>Service fee applied at checkout</span>
                  <span>{formatPHP(serviceFeeFor(subtotal))}</span>
                </div>
                <Link
                  href={isSignedIn ? "/store/checkout" : "/store/cart"}
                  className={styles.primaryBtn}
                  onClick={() => setDrawerOpen(false)}
                >
                  {isSignedIn ? "Go to checkout" : "Review cart"}
                </Link>
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}
