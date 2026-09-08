"use client";

import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { useCart, formatPHP } from "@/lib/cart";
import { serviceFeeFor } from "@/lib/fees";
import StoreHeader from "./StoreHeader";
import styles from "./Store.module.css";

export default function CartClient() {
  const { items, setQty, remove, subtotal, count, clear } = useCart();
  const { status } = useSession();
  const isSignedIn = status === "authenticated";

  return (
    <div className={styles.wrap}>
      <StoreHeader
        extraRight={
          <Link href="/store" className={styles.navLink}>Continue shopping</Link>
        }
      />

      <main className={styles.main}>
        <div className={styles.pageHead}>
          <h1 className={styles.pageTitle}>Your cart</h1>
          <p className={styles.pageSub}>
            {count === 0 ? "Your cart is empty" : `${count} item${count === 1 ? "" : "s"}`}
          </p>
        </div>

        {items.length === 0 ? (
          <div className={styles.empty}>
            Nothing here yet. <Link href="/store" className={styles.inlineLink}>Browse merch</Link>
          </div>
        ) : (
          <div className={styles.cartLayout}>
            <div className={styles.cartList}>
              {items.map((it) => (
                <div key={`${it.productId}-${it.variantId ?? "base"}`} className={styles.cartRow}>
                  <div className={styles.cartImg}>
                    {it.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.imageUrl} alt={it.name} />
                    ) : (
                      <div className={styles.cardImgPlaceholder}>No image</div>
                    )}
                  </div>
                  <div className={styles.cartInfo}>
                    <Link href={`/store/${it.productId}`} className={styles.cartName}>{it.name}</Link>
                    {it.variantLabel && <div className={styles.cartVariant}>{it.variantLabel}</div>}
                    <div className={styles.cartUnit}>{formatPHP(it.unitPrice)}</div>
                  </div>
                  <div className={styles.cartQty}>
                    <button
                      className={styles.qtyBtn}
                      onClick={() => setQty(it.productId, it.variantId, it.qty - 1)}
                    >−</button>
                    <input
                      className={styles.qtyInput}
                      type="number"
                      min={1}
                      value={it.qty}
                      onChange={(e) => setQty(it.productId, it.variantId, Math.max(1, Number(e.target.value) || 1))}
                    />
                    <button
                      className={styles.qtyBtn}
                      onClick={() => setQty(it.productId, it.variantId, it.qty + 1)}
                    >+</button>
                  </div>
                  <div className={styles.cartLine}>{formatPHP(it.unitPrice * it.qty)}</div>
                  <button
                    className={styles.cartRemove}
                    onClick={() => remove(it.productId, it.variantId)}
                    aria-label="Remove item"
                  >Remove</button>
                </div>
              ))}
            </div>

            <aside className={styles.summary}>
              <div className={styles.summaryTitle}>Order summary</div>
              <div className={styles.summaryRow}>
                <span>Subtotal</span>
                <span>{formatPHP(subtotal)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>Service fee</span>
                <span>{formatPHP(serviceFeeFor(subtotal))}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>Pickup</span>
                <span className={styles.muted}>Free</span>
              </div>
              <div className={styles.summaryDivider} />
              <div className={styles.summaryTotal}>
                <span>Total</span>
                <span>{formatPHP(subtotal + serviceFeeFor(subtotal))}</span>
              </div>
              {isSignedIn ? (
                <Link href="/store/checkout" className={styles.primaryBtn}>
                  Proceed to checkout
                </Link>
              ) : (
                <button
                  className={styles.primaryBtn}
                  onClick={() => signIn("google", { callbackUrl: "/store/checkout" })}
                >
                  Sign in to checkout
                </button>
              )}
              <button className={styles.linkBtn} onClick={clear}>Clear cart</button>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
