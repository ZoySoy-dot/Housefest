"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/lib/cart";
import StoreHeader from "./StoreHeader";
import styles from "./Store.module.css";

type ConfirmState = "checking" | "paid" | "pending" | "error";

export default function CheckoutSuccessClient() {
  const params = useSearchParams();
  const orderId = params.get("order");
  const { clear } = useCart();

  const [state, setState] = useState<ConfirmState>("checking");
  const [error, setError] = useState<string | null>(null);
  const cleared = useRef(false);

  useEffect(() => {
    if (!orderId) {
      setState("error");
      setError("Missing order id");
      return;
    }

    let cancelled = false;
    let attempts = 0;

    async function poll() {
      attempts++;
      try {
        const res = await fetch("/api/checkout/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        });
        const data = (await res.json()) as { status?: string; error?: string };
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error ?? "Confirmation failed");
        if (data.status === "paid" || data.status === "fulfilled") {
          setState("paid");
          if (!cleared.current) {
            cleared.current = true;
            clear();
          }
          return;
        }
        if (attempts >= 8) {
          setState("pending");
          return;
        }
        setTimeout(poll, 1500);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Confirmation failed");
        setState("error");
      }
    }

    poll();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  return (
    <div className={styles.wrap}>
      <StoreHeader />
      <main className={styles.main}>
        <div className={styles.pageHead}>
          <h1 className={styles.pageTitle}>
            {state === "paid" && "Payment received"}
            {state === "checking" && "Confirming your payment…"}
            {state === "pending" && "Payment pending"}
            {state === "error" && "Something went wrong"}
          </h1>
          <p className={styles.pageSub}>
            {state === "paid" &&
              `Order #${orderId} — thank you! We’ll email pickup details shortly.`}
            {state === "checking" &&
              "Please don’t close this page while we verify with PayMongo."}
            {state === "pending" &&
              `Order #${orderId} — payment is still processing. It’ll update once PayMongo confirms.`}
            {state === "error" && (error ?? "Please contact the SC Store.")}
          </p>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/store" className={styles.primaryBtn}>
            Back to store
          </Link>
          <Link href="/store/orders" className={styles.inlineLink}>
            View my orders
          </Link>
          {state !== "paid" && orderId && (
            <button
              className={styles.inlineLink}
              onClick={() => window.location.reload()}
              style={{ background: "none", border: "none", cursor: "pointer", font: "inherit" }}
            >
              Check again
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
