"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import StoreHeader from "./StoreHeader";
import { formatPHP } from "@/lib/cart";
import styles from "./Store.module.css";

type OrderStatus = "pending" | "paid" | "fulfilled" | "cancelled";

type OrderItem = {
  id: number;
  productName: string;
  variantLabel: string | null;
  unitPrice: number;
  qty: number;
  lineTotal: number;
};

type Order = {
  id: number;
  status: OrderStatus;
  house: string | null;
  notes: string | null;
  subtotal: number;
  serviceFee: number;
  total: number;
  paidAmount: number;
  paidAt: string | null;
  createdAt: string;
  items: OrderItem[];
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending payment",
  paid: "Paid",
  fulfilled: "Picked up",
  cancelled: "Cancelled",
};

function statusDotClass(s: OrderStatus) {
  return s === "pending"   ? styles.myOrderDotPending
       : s === "paid"      ? styles.myOrderDotPaid
       : s === "fulfilled" ? styles.myOrderDotFulfilled
       :                     styles.myOrderDotCancelled;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export default function MyOrdersClient() {
  const { status } = useSession();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resumingId, setResumingId] = useState<number | null>(null);

  async function resumePayment(id: number) {
    setResumingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/orders/mine/${id}/resume`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.checkoutUrl) {
        throw new Error(data.error ?? "Failed to resume payment");
      }
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resume payment");
      setResumingId(null);
    }
  }

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/orders/mine");
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error ?? "Failed to load");
        setOrders(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      }
    })();
    return () => { cancelled = true; };
  }, [status]);

  return (
    <div className={styles.wrap}>
      <StoreHeader
        extraRight={
          <Link href="/store" className={styles.navLink}>Continue shopping</Link>
        }
      />
      <main className={styles.main}>
        <div className={styles.pageHead}>
          <h1 className={styles.pageTitle}>My orders</h1>
          <p className={styles.pageSub}>
            {status === "authenticated"
              ? "Orders placed with your Google account."
              : "Sign in to see your orders."}
          </p>
        </div>

        {status === "loading" && (
          <div className={styles.empty}>Loading…</div>
        )}

        {status === "unauthenticated" && (
          <div className={styles.empty}>
            <button
              className={styles.primaryBtn}
              onClick={() => signIn("google", { callbackUrl: "/store/orders" })}
            >
              Sign in with Google
            </button>
          </div>
        )}

        {status === "authenticated" && error && (
          <div className={styles.formError}>{error}</div>
        )}

        {status === "authenticated" && orders && orders.length === 0 && (
          <div className={styles.empty}>
            No orders yet.{" "}
            <Link href="/store" className={styles.inlineLink}>Browse the store</Link>
          </div>
        )}

        {status === "authenticated" && orders && orders.length > 0 && (
          <div className={styles.myOrdersList}>
            {orders.map((o) => (
              <article key={o.id} className={styles.myOrderCard}>
                <header className={styles.myOrderHead}>
                  <div className={styles.myOrderHeadLeft}>
                    <span className={styles.myOrderId}>Order #{o.id}</span>
                    <span className={styles.myOrderDate}>{formatDate(o.createdAt)}</span>
                  </div>
                  <span className={`${styles.myOrderStatus} ${statusDotClass(o.status)}`}>
                    {STATUS_LABEL[o.status]}
                  </span>
                </header>

                <div className={styles.myOrderItems}>
                  {o.items.map((i) => (
                    <div key={i.id} className={styles.myOrderItemRow}>
                      <span className={styles.myOrderItemName}>
                        {i.productName}
                        {i.variantLabel && (
                          <span className={styles.myOrderItemVariant}> · {i.variantLabel}</span>
                        )}
                      </span>
                      <span className={styles.myOrderItemQty}>×{i.qty}</span>
                      <span className={styles.myOrderItemTotal}>{formatPHP(i.lineTotal)}</span>
                    </div>
                  ))}
                </div>

                <footer className={styles.myOrderFoot}>
                  <div className={styles.myOrderFootMeta}>
                    {o.house && <span>House: <strong>{o.house}</strong></span>}
                    {o.paidAt && (
                      <span>Paid {formatDate(o.paidAt)}</span>
                    )}
                    {o.status === "fulfilled" && (
                      <span>Picked up · thanks!</span>
                    )}
                    {o.status === "paid" && (
                      <span>Pickup instructions will be sent to your email.</span>
                    )}
                    {o.status === "pending" && (
                      <span>Payment not yet confirmed.</span>
                    )}
                  </div>
                  <div className={styles.myOrderFootRight}>
                    {o.status === "pending" && (
                      <button
                        className={styles.myOrderPayBtn}
                        onClick={() => resumePayment(o.id)}
                        disabled={resumingId === o.id}
                      >
                        {resumingId === o.id ? "Redirecting…" : "Complete payment"}
                      </button>
                    )}
                    <div className={styles.myOrderFootTotal}>
                      <span className={styles.myOrderFootTotalLabel}>Total</span>
                      <span className={styles.myOrderFootTotalValue}>{formatPHP(o.total)}</span>
                    </div>
                  </div>
                </footer>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
