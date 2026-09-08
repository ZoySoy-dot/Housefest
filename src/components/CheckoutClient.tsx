"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { useCart, formatPHP } from "@/lib/cart";
import { HOUSES } from "@/lib/houses";
import { serviceFeeFor } from "@/lib/fees";
import StoreHeader from "./StoreHeader";
import styles from "./Store.module.css";

export default function CheckoutClient() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { items, subtotal, count } = useCart();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [house, setHouse] = useState<string>("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill from Google session once loaded
  useEffect(() => {
    if (status !== "authenticated") return;
    if (!name && session?.user?.name) setName(session.user.name);
    if (!email && session?.user?.email) setEmail(session.user.email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const canSubmit = useMemo(
    () =>
      name.trim() &&
      email.trim() &&
      phone.trim() &&
      house &&
      items.length > 0 &&
      !submitting,
    [name, email, phone, house, items.length, submitting],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (status !== "authenticated") {
      signIn("google", { callbackUrl: "/store/checkout" });
      return;
    }
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name.trim(),
          customerEmail: email.trim(),
          customerPhone: phone.trim(),
          house,
          notes: notes.trim() || undefined,
          items: items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            qty: i.qty,
          })),
        }),
      });
      const data = (await res.json()) as {
        checkoutUrl?: string;
        error?: string;
      };
      if (!res.ok || !data.checkoutUrl) {
        throw new Error(data.error ?? "Checkout failed");
      }
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className={styles.wrap}>
        <StoreHeader />
        <main className={styles.main}>
          <div className={styles.pageHead}>
            <h1 className={styles.pageTitle}>Checkout</h1>
          </div>
          <div className={styles.empty}>
            Your cart is empty.{" "}
            <Link href="/store" className={styles.inlineLink}>
              Browse merch
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <StoreHeader
        extraRight={
          <Link href="/store/cart" className={styles.navLink}>
            Back to cart
          </Link>
        }
      />
      <main className={styles.main}>
        <div className={styles.pageHead}>
          <h1 className={styles.pageTitle}>Checkout</h1>
          <p className={styles.pageSub}>
            {count} item{count === 1 ? "" : "s"} · pickup only
          </p>
        </div>

        <div className={styles.checkoutLayout}>
          <form onSubmit={submit} className={styles.formGrid}>
            {status !== "authenticated" && (
              <div className={styles.formError}>
                Please{" "}
                <button
                  type="button"
                  onClick={() => signIn("google", { callbackUrl: "/store/checkout" })}
                  className={styles.inlineLink}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}
                >
                  sign in with Google
                </button>{" "}
                to continue.
              </div>
            )}

            <div className={styles.field}>
              <label className={styles.label} htmlFor="name">Full name</label>
              <input
                id="name"
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="phone">Phone</label>
              <input
                id="phone"
                type="tel"
                className={styles.input}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09XXXXXXXXX"
                autoComplete="tel"
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="house">House</label>
              <select
                id="house"
                className={styles.select}
                value={house}
                onChange={(e) => setHouse(e.target.value)}
                required
              >
                <option value="" disabled>Select your house</option>
                {HOUSES.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="notes">Notes (optional)</label>
              <textarea
                id="notes"
                className={styles.textarea}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything we should know about pickup?"
              />
            </div>

            {error && <div className={styles.formError}>{error}</div>}

            <button
              type="submit"
              className={styles.primaryBtn}
              disabled={!canSubmit}
            >
              {submitting ? "Redirecting to PayMongo…" : "Pay with PayMongo"}
            </button>

            <div className={styles.payMethods}>
              <div className={styles.payMethodsLabel}>We accept</div>
              <div className={styles.payMethodsRow}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <span className={styles.payMethodLogo} title="GCash">
                  <img src="/pay/gcash.svg" alt="GCash" />
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <span className={styles.payMethodLogo} title="Maya">
                  <img src="/pay/maya.svg" alt="Maya" />
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <span className={styles.payMethodLogo} title="GrabPay">
                  <img src="/pay/grabpay.png" alt="GrabPay" />
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <span className={styles.payMethodLogo} title="QR Ph">
                  <img src="/pay/qrph.png" alt="QR Ph" />
                </span>
              </div>
            </div>

            <button
              type="button"
              className={styles.linkBtn ?? styles.inlineLink}
              onClick={() => router.push("/store/cart")}
            >
              Back to cart
            </button>
          </form>

          <aside className={styles.summary}>
            <div className={styles.summaryTitle}>Order summary</div>
            {items.map((it) => (
              <div key={`${it.productId}-${it.variantId ?? "base"}`} className={styles.summaryRow}>
                <span>
                  {it.name}
                  {it.variantLabel ? ` · ${it.variantLabel}` : ""} × {it.qty}
                </span>
                <span>{formatPHP(it.unitPrice * it.qty)}</span>
              </div>
            ))}
            <div className={styles.summaryDivider} />
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
          </aside>
        </div>
      </main>
    </div>
  );
}

