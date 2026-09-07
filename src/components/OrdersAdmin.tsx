"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./AdminPanel.module.css";

type OrderStatus = "pending" | "paid" | "fulfilled" | "cancelled";
type OrderSource = "online" | "manual";
type PaymentMethod = "cash" | "gcash" | "maya" | "card" | "bank" | "other";

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
  card: "Card",
  bank: "Bank transfer",
  other: "Other",
};

type OrderItem = {
  id: number;
  productId: number | null;
  variantId: number | null;
  productName: string;
  variantLabel: string | null;
  unitPrice: number;
  qty: number;
  lineTotal: number;
};

type Order = {
  id: number;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  house: string | null;
  notes: string | null;
  status: OrderStatus;
  source: OrderSource;
  paymentMethod: PaymentMethod | null;
  paidAmount: number;
  subtotal: number;
  total: number;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
};

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
  basePrice: number;
  active: boolean;
  variants: Variant[];
};

function formatPHP(centavos: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency", currency: "PHP", minimumFractionDigits: 2,
  }).format(centavos / 100);
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
};

export default function OrdersAdmin({
  onToast,
}: {
  onToast: (m: string, isError?: boolean) => void;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [showRecord, setShowRecord] = useState(false);

  const load = useCallback(async () => {
    const url = new URL("/api/orders", window.location.origin);
    if (statusFilter !== "all") url.searchParams.set("status", statusFilter);
    if (search.trim()) url.searchParams.set("search", search.trim());
    const res = await fetch(url.toString());
    if (!res.ok) return;
    setOrders(await res.json());
    setLoaded(true);
  }, [statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  async function changeStatus(id: number, status: OrderStatus) {
    const res = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) return onToast("Failed to update order.", true);
    await load();
    onToast(`Order #${id} → ${STATUS_LABEL[status]}`);
  }

  async function deleteOrder(id: number) {
    if (!confirm(`Delete order #${id}? This cannot be undone.`)) return;
    await fetch(`/api/orders/${id}`, { method: "DELETE" });
    await load();
    onToast("Order deleted.");
  }

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exportCsv() {
    const header = [
      "id", "createdAt", "status", "source",
      "customerName", "customerEmail", "customerPhone", "house",
      "paymentMethod", "paidAmount_php",
      "items", "subtotal_php", "total_php",
    ];
    const rows = orders.map((o) => [
      o.id,
      new Date(o.createdAt).toISOString(),
      o.status,
      o.source,
      csvEscape(o.customerName),
      csvEscape(o.customerEmail ?? ""),
      csvEscape(o.customerPhone ?? ""),
      csvEscape(o.house ?? ""),
      csvEscape(o.paymentMethod ?? ""),
      (o.paidAmount / 100).toFixed(2),
      csvEscape(o.items.map((i) => `${i.qty}× ${i.productName}${i.variantLabel ? ` (${i.variantLabel})` : ""}`).join("; ")),
      (o.subtotal / 100).toFixed(2),
      (o.total / 100).toFixed(2),
    ].join(","));
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totals = useMemo(() => {
    const revenue = orders
      .filter((o) => o.status !== "cancelled")
      .reduce((s, o) => s + o.total, 0);
    return { count: orders.length, revenue };
  }, [orders]);

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Orders</h2>
        <span className={styles.sectionHint}>
          {totals.count} order{totals.count === 1 ? "" : "s"} · {formatPHP(totals.revenue)} (excl. cancelled)
        </span>
      </div>

      {/* filter/action bar */}
      <div className={styles.ordersBar}>
        <div className={styles.filterBar}>
          {(["all", "pending", "paid", "fulfilled", "cancelled"] as const).map((s) => (
            <button
              key={s}
              className={`${styles.filterBtn} ${statusFilter === s ? styles.filterBtnActive : ""}`}
              onClick={() => setStatusFilter(s)}
            >
              {s === "all" ? "All" : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <div className={styles.ordersBarRight}>
          <input
            placeholder="Search name, email, phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.input}
            style={{ flex: 1, minWidth: 220 }}
          />
          <button className={styles.chipBtn} onClick={exportCsv} disabled={orders.length === 0}>
            Export CSV
          </button>
          <button className={styles.addBtn} onClick={() => setShowRecord(true)}>
            + Record sale
          </button>
        </div>
      </div>

      {!loaded ? (
        <div className={styles.empty}>Loading orders…</div>
      ) : orders.length === 0 ? (
        <div className={styles.empty}>
          No orders yet. Use &ldquo;Record sale&rdquo; to log a manual booth sale.
        </div>
      ) : (
        <div className={styles.ordersTable}>
          <div className={`${styles.orderRow} ${styles.orderHeaderRow}`}>
            <span>Order</span>
            <span>Customer</span>
            <span>Contact</span>
            <span>Items</span>
            <span>Payment</span>
            <span>Paid</span>
            <span>Status</span>
            <span></span>
          </div>
          {orders.map((o) => (
            <div key={o.id}>
              <div className={styles.orderRow}>
                <div className={styles.orderIdCell}>
                  <span className={styles.orderId}>#{o.id}</span>
                  <span className={styles.orderMeta}>
                    {formatDate(o.createdAt)} · {o.source}
                  </span>
                </div>
                <div className={styles.orderCustomer}>
                  <span className={styles.orderName}>{o.customerName}</span>
                  {o.house && (
                    <span className={styles.orderMeta}>{o.house}</span>
                  )}
                </div>
                <div className={styles.orderCustomer}>
                  {o.customerEmail && (
                    <span className={styles.orderMeta} title={o.customerEmail}>
                      {o.customerEmail}
                    </span>
                  )}
                  {o.customerPhone && (
                    <span className={styles.orderMeta}>{o.customerPhone}</span>
                  )}
                  {!o.customerEmail && !o.customerPhone && (
                    <span className={styles.orderMeta}>—</span>
                  )}
                </div>
                <div className={styles.orderItems}>
                  {o.items.slice(0, 2).map((i) => (
                    <span key={i.id} className={styles.orderMeta}>
                      {i.qty}× {i.productName}{i.variantLabel && <> ({i.variantLabel})</>}
                    </span>
                  ))}
                  {o.items.length > 2 && (
                    <span className={styles.orderMeta}>+{o.items.length - 2} more</span>
                  )}
                </div>
                <div>
                  {o.paymentMethod ? (
                    <span className={styles.paymentTag}>{PAYMENT_LABEL[o.paymentMethod]}</span>
                  ) : (
                    <span className={styles.orderMeta}>—</span>
                  )}
                </div>
                <div className={styles.orderPaidCell}>
                  <span className={styles.orderTotal}>{formatPHP(o.paidAmount)}</span>
                  {o.paidAmount !== o.total && (
                    <span className={styles.orderMeta}>of {formatPHP(o.total)}</span>
                  )}
                </div>
                <div>
                  <select
                    className={`${styles.statusSelect} ${styles[`status_${o.status}`]}`}
                    value={o.status}
                    onChange={(e) => changeStatus(o.id, e.target.value as OrderStatus)}
                  >
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="fulfilled">Fulfilled</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div className={styles.orderRowActions}>
                  <button className={styles.chipBtn} onClick={() => toggle(o.id)}>
                    {expanded.has(o.id) ? "Hide" : "Details"}
                  </button>
                  <button
                    className={`${styles.chipBtn} ${styles.chipBtnDanger}`}
                    onClick={() => deleteOrder(o.id)}
                  >Delete</button>
                </div>
              </div>

              {expanded.has(o.id) && (
                <div className={styles.orderDetail}>
                  <div className={styles.orderDetailGrid}>
                    <div>
                      <div className={styles.orderDetailLabel}>Customer</div>
                      <div>{o.customerName}</div>
                      <div className={styles.orderMeta}>
                        {o.customerEmail ?? "—"} · {o.customerPhone ?? "—"}
                      </div>
                    </div>
                    <div>
                      <div className={styles.orderDetailLabel}>House</div>
                      <div>{o.house ?? "—"}</div>
                    </div>
                    <div>
                      <div className={styles.orderDetailLabel}>Payment</div>
                      <div>
                        {o.paymentMethod ? PAYMENT_LABEL[o.paymentMethod] : "—"} ·{" "}
                        <span className={styles.orderTotal} style={{ display: "inline" }}>
                          {formatPHP(o.paidAmount)}
                        </span>
                        {o.paidAmount !== o.total && (
                          <span className={styles.orderMeta}> of {formatPHP(o.total)}</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className={styles.orderDetailLabel}>Notes</div>
                      <div>{o.notes ?? "—"}</div>
                    </div>
                  </div>
                  <div className={styles.orderItemTable}>
                    <div className={`${styles.orderItemRow} ${styles.orderItemHeader}`}>
                      <span>Item</span>
                      <span>Qty</span>
                      <span>Unit</span>
                      <span>Line total</span>
                    </div>
                    {o.items.map((i) => (
                      <div key={i.id} className={styles.orderItemRow}>
                        <span>
                          {i.productName}
                          {i.variantLabel && <span className={styles.orderMeta}> · {i.variantLabel}</span>}
                        </span>
                        <span>{i.qty}</span>
                        <span>{formatPHP(i.unitPrice)}</span>
                        <span>{formatPHP(i.lineTotal)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showRecord && (
        <RecordSaleModal
          onClose={() => setShowRecord(false)}
          onSaved={() => { setShowRecord(false); load(); }}
          onToast={onToast}
        />
      )}
    </section>
  );
}

function csvEscape(v: string) {
  if (/[,"\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

/* ─── Record sale modal ─── */

type LineDraft = {
  key: string;
  productId: number | null;
  variantId: number | null;
  productName: string;
  variantLabel: string | null;
  unitPrice: number;   // centavos
  qty: number;
};

function RecordSaleModal({
  onClose, onSaved, onToast,
}: {
  onClose: () => void;
  onSaved: () => void;
  onToast: (m: string, isError?: boolean) => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [house, setHouse] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<OrderStatus>("paid");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("cash");
  const [paidAmount, setPaidAmount] = useState<string>("");   // pesos as string
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/products?includeInactive=1")
      .then((r) => r.json())
      .then(setProducts);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  function addLine(productId: number, variantId: number | null) {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    let unitPrice = p.basePrice;
    let variantLabel: string | null = null;
    if (variantId) {
      const v = p.variants.find((x) => x.id === variantId);
      if (v) { unitPrice = v.price; variantLabel = `${v.group} · ${v.option}`; }
    }
    setLines((prev) => [
      ...prev,
      {
        key: `${productId}_${variantId ?? "base"}_${Date.now()}`,
        productId,
        variantId,
        productName: p.name,
        variantLabel,
        unitPrice,
        qty: 1,
      },
    ]);
  }

  function updateLine(key: string, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l) => l.key === key ? { ...l, ...patch } : l));
  }
  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);

  async function save() {
    if (!customerName.trim()) return onToast("Customer name required.", true);
    if (lines.length === 0) return onToast("Add at least one item.", true);
    setSaving(true);
    const parsedPaid = paidAmount === "" ? undefined : Math.max(0, Math.round(parseFloat(paidAmount) * 100));
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName,
        customerEmail,
        customerPhone,
        house,
        notes,
        status,
        source: "manual",
        paymentMethod: paymentMethod || undefined,
        paidAmount: parsedPaid,
        items: lines.map((l) => ({
          productId: l.productId,
          variantId: l.variantId,
          productName: l.productName,
          variantLabel: l.variantLabel,
          unitPrice: l.unitPrice,
          qty: l.qty,
        })),
      }),
    });
    setSaving(false);
    if (!res.ok) return onToast("Failed to record sale.", true);
    onToast("Sale recorded.");
    onSaved();
  }

  return (
    <div className={styles.modalRoot}>
      <div className={styles.modalBackdrop} onClick={onClose} />
      <div className={styles.modal} role="dialog" aria-label="Record sale">
        <div className={styles.modalHead}>
          <div>
            <div className={styles.modalTitle}>Record a sale</div>
            <div className={styles.modalSub}>For manual bookkeeping (booth sales, walk-ins)</div>
          </div>
          <button className={styles.drawerClose} onClick={onClose}>×</button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.modalGrid}>
            <label className={styles.editLabel}>
              <span>Customer name *</span>
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={styles.input} autoFocus />
            </label>
            <label className={styles.editLabel}>
              <span>Email</span>
              <input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} className={styles.input} />
            </label>
            <label className={styles.editLabel}>
              <span>Phone</span>
              <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className={styles.input} />
            </label>
            <label className={styles.editLabel}>
              <span>House</span>
              <input value={house} onChange={(e) => setHouse(e.target.value)} placeholder="Mutien / Benilde / Jaime / Miguel" className={styles.input} />
            </label>
            <label className={styles.editLabel}>
              <span>Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)} className={styles.input}>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="fulfilled">Fulfilled</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
            <label className={styles.editLabel}>
              <span>Payment method</span>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod | "")}
                className={styles.input}
              >
                <option value="">—</option>
                <option value="cash">Cash</option>
                <option value="gcash">GCash</option>
                <option value="maya">Maya</option>
                <option value="card">Card</option>
                <option value="bank">Bank transfer</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className={styles.editLabel}>
              <span>Paid amount (₱)</span>
              <input
                type="number"
                step="0.01"
                placeholder="Leave empty to default to order total"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                className={styles.input}
              />
            </label>
            <label className={`${styles.editLabel} ${styles.editLabelFull}`}>
              <span>Notes</span>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} className={styles.input} />
            </label>
          </div>

          <div className={styles.modalDivider} />

          <div className={styles.modalSubhead}>Items</div>

          <ProductPicker products={products} onAdd={addLine} />

          {lines.length === 0 ? (
            <div className={styles.empty} style={{ marginTop: 12 }}>
              No items yet. Pick a product above.
            </div>
          ) : (
            <div className={styles.saleLines}>
              {lines.map((l) => (
                <div key={l.key} className={styles.saleLine}>
                  <div className={styles.saleLineInfo}>
                    <div className={styles.saleLineName}>{l.productName}</div>
                    {l.variantLabel && <div className={styles.saleLineVariant}>{l.variantLabel}</div>}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={(l.unitPrice / 100).toFixed(2)}
                    onChange={(e) => updateLine(l.key, { unitPrice: Math.max(0, Math.round(parseFloat(e.target.value || "0") * 100)) })}
                    className={styles.input}
                    style={{ width: 100 }}
                    aria-label="Unit price"
                  />
                  <input
                    type="number"
                    min={1}
                    value={l.qty}
                    onChange={(e) => updateLine(l.key, { qty: Math.max(1, Number(e.target.value) || 1) })}
                    className={styles.input}
                    style={{ width: 68 }}
                    aria-label="Quantity"
                  />
                  <div className={styles.saleLineTotal}>{formatPHP(l.unitPrice * l.qty)}</div>
                  <button className={`${styles.chipBtn} ${styles.chipBtnDanger}`} onClick={() => removeLine(l.key)}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.modalFoot}>
          <div className={styles.modalTotal}>
            <span>Total</span>
            <span>{formatPHP(subtotal)}</span>
          </div>
          <div className={styles.modalFootActions}>
            <button className={styles.chipBtn} onClick={onClose}>Cancel</button>
            <button className={styles.addBtn} onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Record sale"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductPicker({
  products, onAdd,
}: {
  products: Product[];
  onAdd: (productId: number, variantId: number | null) => void;
}) {
  const [productId, setProductId] = useState<number | "">("");
  const [variantId, setVariantId] = useState<number | "">("");

  const selected = products.find((p) => p.id === productId);

  return (
    <div className={styles.pickerRow}>
      <select
        value={productId}
        onChange={(e) => {
          const v = e.target.value ? Number(e.target.value) : "";
          setProductId(v);
          setVariantId("");
        }}
        className={styles.input}
        style={{ flex: 2 }}
      >
        <option value="">— Choose product —</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>{p.name}{p.active ? "" : " (hidden)"}</option>
        ))}
      </select>

      {selected && selected.variants.length > 0 && (
        <select
          value={variantId}
          onChange={(e) => setVariantId(e.target.value ? Number(e.target.value) : "")}
          className={styles.input}
          style={{ flex: 2 }}
        >
          <option value="">— Choose variant —</option>
          {selected.variants.map((v) => (
            <option key={v.id} value={v.id}>
              {v.group}: {v.option} · {formatPHP(v.price)} · stock {v.stock}
            </option>
          ))}
        </select>
      )}

      <button
        className={styles.chipBtn}
        disabled={
          !selected ||
          (selected.variants.length > 0 && !variantId)
        }
        onClick={() => {
          if (!selected) return;
          onAdd(selected.id, variantId ? Number(variantId) : null);
          setProductId("");
          setVariantId("");
        }}
      >Add item</button>
    </div>
  );
}
