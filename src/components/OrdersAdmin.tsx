"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./AdminPanel.module.css";

type OrderStatus = "pending" | "paid" | "fulfilled" | "cancelled";
type OrderSource = "online" | "manual";
type PaymentMethod = "cash" | "gcash" | "maya" | "card" | "bank" | "paymongo" | "other";

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
  card: "Card",
  bank: "Bank transfer",
  paymongo: "PayMongo",
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
  serviceFee: number;
  total: number;
  paymongoSessionId: string | null;
  paymongoPaymentId: string | null;
  paidAt: string | null;
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

const ALL_STATUSES: OrderStatus[] = ["pending", "paid", "fulfilled", "cancelled"];

type SortKey = "id" | "createdAt" | "customerName" | "total" | "status";
const STATUS_ORDER: Record<OrderStatus, number> = {
  pending: 0, paid: 1, fulfilled: 2, cancelled: 3,
};

// Online (PayMongo) orders can only move forward: paid → fulfilled or cancelled.
// Pending can only be cancelled (PayMongo owns paid).
function allowedStatusOptions(o: Pick<Order, "source" | "status">): OrderStatus[] {
  if (o.source !== "online") return ALL_STATUSES;
  const map: Record<OrderStatus, OrderStatus[]> = {
    pending:   ["pending", "cancelled"],
    paid:      ["paid", "fulfilled", "cancelled"],
    fulfilled: ["fulfilled"],
    cancelled: ["cancelled"],
  };
  return map[o.status];
}

export default function OrdersAdmin({
  onToast,
}: {
  onToast: (m: string, isError?: boolean) => void;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [showRecord, setShowRecord] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [drawerOrderId, setDrawerOrderId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [menuOpen, setMenuOpen] = useState<number | null>(null);

  function toggleSort(key: SortKey) {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir(key === "customerName" || key === "status" ? "asc" : "desc");
    }
  }

  function toggleSelected(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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

  function exportCsv() {
    const header = [
      "id", "createdAt", "status", "source",
      "customerName", "customerEmail", "customerPhone", "house",
      "paymentMethod", "paidAmount_php",
      "items", "subtotal_php", "serviceFee_php", "total_php",
    ];
    const rows = sortedOrders.map((o) => [
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
      (o.serviceFee / 100).toFixed(2),
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

  const sortedOrders = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...orders].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "id": cmp = a.id - b.id; break;
        case "createdAt":
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "customerName":
          cmp = a.customerName.localeCompare(b.customerName);
          break;
        case "total": cmp = a.total - b.total; break;
        case "status":
          cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
          break;
      }
      return cmp * dir;
    });
  }, [orders, sortBy, sortDir]);

  const drawerOrder = drawerOrderId != null ? orders.find((o) => o.id === drawerOrderId) ?? null : null;

  const tabCounts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    for (const o of orders) c[o.status] = (c[o.status] ?? 0) + 1;
    return c;
  }, [orders]);

  async function bulkChangeStatus(status: OrderStatus) {
    const ids = Array.from(selected);
    await Promise.all(
      ids.map((id) =>
        fetch(`/api/orders/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }),
      ),
    );
    setSelected(new Set());
    await load();
    onToast(`${ids.length} order${ids.length === 1 ? "" : "s"} → ${STATUS_LABEL[status]}`);
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Orders</h2>
        <span className={styles.sectionHint}>
          {totals.count} order{totals.count === 1 ? "" : "s"} · {formatPHP(totals.revenue)} (excl. cancelled)
        </span>
      </div>

      {/* Tabs */}
      <div className={styles.ordersTabs}>
        {STATUS_TAB_ORDER.map((s) => (
          <button
            key={s}
            className={`${styles.ordersTab} ${statusFilter === s ? styles.ordersTabActive : ""}`}
            onClick={() => setStatusFilter(s)}
          >
            {s === "all" ? "All" : STATUS_LABEL[s]}
            {tabCounts[s] != null && <span className={styles.ordersTabCount}>{tabCounts[s]}</span>}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className={styles.ordersToolbar}>
        <input
          type="search"
          placeholder="Search name, email, phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.ordersSearch}
        />
        <div className={styles.ordersToolbarSpacer} />
        <button className={styles.ordersToolbarBtn} onClick={exportCsv} disabled={orders.length === 0}>
          Export CSV
        </button>
        <button className={styles.ordersToolbarPrimary} onClick={() => setShowRecord(true)}>
          Record sale
        </button>
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className={styles.bulkBar}>
          <strong>{selected.size} selected</strong>
          <span className={styles.bulkBarSpacer} />
          <button className={styles.ordersToolbarBtn} onClick={() => bulkChangeStatus("fulfilled")}>
            Mark fulfilled
          </button>
          <button className={styles.ordersToolbarBtn} onClick={() => bulkChangeStatus("cancelled")}>
            Cancel
          </button>
          <button className={styles.ordersToolbarBtn} onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      <div className={styles.ordersTableV2}>
        <div className={styles.ordersTableGrid}>
          <div className={styles.ordersTableHead}>
            <div className={styles.ordersCellCheck}>
              <input
                type="checkbox"
                aria-label="Select all"
                checked={sortedOrders.length > 0 && sortedOrders.every((o) => selected.has(o.id))}
                onChange={(e) => {
                  if (e.target.checked) setSelected(new Set(sortedOrders.map((o) => o.id)));
                  else setSelected(new Set());
                }}
              />
            </div>
            <SortHead label="Order" active={sortBy === "createdAt"} dir={sortDir} onClick={() => toggleSort("createdAt")} />
            <SortHead label="Customer" active={sortBy === "customerName"} dir={sortDir} onClick={() => toggleSort("customerName")} />
            <div className={styles.ordersColHideSm}>Items</div>
            <div className={styles.ordersColHideMd}>Payment</div>
            <SortHead label="Total" active={sortBy === "total"} dir={sortDir} onClick={() => toggleSort("total")} align="right" />
            <SortHead label="Status" active={sortBy === "status"} dir={sortDir} onClick={() => toggleSort("status")} />
            <div className={styles.ordersColHideMd}>Updated</div>
            <div />
          </div>

          {!loaded ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`${styles.ordersTableRow} ${styles.skeletonRow}`}>
                {Array.from({ length: 9 }).map((_, j) => (
                  <div key={j}><div className={styles.skeletonBar} /></div>
                ))}
              </div>
            ))
          ) : sortedOrders.length === 0 ? (
            <div style={{ gridColumn: "1 / -1" }} className={styles.ordersEmpty}>
              <div className={styles.ordersEmptyTitle}>No orders match this view</div>
              <div>Try clearing the search or switching tabs.</div>
            </div>
          ) : (
            sortedOrders.map((o) => {
              const summary = itemsSummary(o.items);
              const isSelected = selected.has(o.id);
              return (
                <div
                  key={o.id}
                  className={`${styles.ordersTableRow} ${isSelected ? styles.ordersTableRowSelected : ""}`}
                  onClick={() => setDrawerOrderId(o.id)}
                >
                  <div className={styles.ordersCellCheck} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Select order ${o.id}`}
                      checked={isSelected}
                      onChange={() => toggleSelected(o.id)}
                    />
                  </div>
                  <div>
                    <span className={styles.ordersCellId}>#{o.id}</span>
                  </div>
                  <div className={styles.ordersCellCustomer}>
                    <span className={styles.ordersCellCustomerName}>{o.customerName}</span>
                    {(o.customerEmail || o.house) && (
                      <span className={styles.ordersCellCustomerSub}>
                        {o.customerEmail ?? o.house}
                      </span>
                    )}
                  </div>
                  <div className={`${styles.ordersCellItems} ${styles.ordersColHideSm}`}>
                    {summary.first}
                    {summary.extra > 0 && (
                      <span className={styles.ordersCellItemsCount}>+{summary.extra}</span>
                    )}
                  </div>
                  <div className={`${styles.ordersCellPayment} ${styles.ordersColHideMd}`}>
                    {o.paymentMethod ? PAYMENT_LABEL[o.paymentMethod] : <span className={styles.ordersCellPaymentNone}>—</span>}
                  </div>
                  <div className={styles.ordersCellTotal}>{formatPHP(o.total)}</div>
                  <div>
                    <span className={`${styles.ordersCellStatus} ${statusDotClass(o.status)}`}>
                      {STATUS_LABEL[o.status]}
                    </span>
                  </div>
                  <div className={`${styles.ordersCellUpdated} ${styles.ordersColHideMd}`}>
                    {timeAgo(o.updatedAt)}
                  </div>
                  <div className={styles.ordersCellAction} onClick={(e) => e.stopPropagation()}>
                    <RowMenu
                      order={o}
                      open={menuOpen === o.id}
                      onOpen={() => setMenuOpen(o.id)}
                      onClose={() => setMenuOpen(null)}
                      onView={() => setDrawerOrderId(o.id)}
                      onChangeStatus={(s) => changeStatus(o.id, s)}
                      onDelete={() => deleteOrder(o.id)}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {drawerOrder && (
        <OrderDrawer
          order={drawerOrder}
          onClose={() => setDrawerOrderId(null)}
          onChangeStatus={(s) => {
            changeStatus(drawerOrder.id, s);
          }}
          onDelete={() => {
            setDrawerOrderId(null);
            deleteOrder(drawerOrder.id);
          }}
        />
      )}

      {/* legacy hidden bar preserved for reference (nothing rendered) */}
      <div style={{ display: "none" }} className={styles.ordersBar} />

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

/* Small sortable header cell */
function SortHead({
  label, active, dir, onClick, align,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  align?: "right";
}) {
  return (
    <div style={{ textAlign: align === "right" ? "right" : "left", justifyContent: align === "right" ? "flex-end" : undefined, display: "flex" }}>
      <button
        type="button"
        onClick={onClick}
        className={`${styles.ordersHeadSort} ${active ? styles.ordersHeadSortActive : ""}`}
      >
        {label}
        {active && (
          <span className={styles.ordersHeadSortArrow}>
            {dir === "asc" ? "↑" : "↓"}
          </span>
        )}
      </button>
    </div>
  );
}

function csvEscape(v: string) {
  if (/[,"\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

const STATUS_TAB_ORDER: (OrderStatus | "all")[] = ["all", "pending", "paid", "fulfilled", "cancelled"];

function statusDotClass(s: OrderStatus) {
  return s === "pending"   ? styles.statusDotPending
       : s === "paid"      ? styles.statusDotPaid
       : s === "fulfilled" ? styles.statusDotFulfilled
       :                     styles.statusDotCancelled;
}

function itemsSummary(items: OrderItem[]) {
  const qty = items.reduce((s, i) => s + i.qty, 0);
  const first = items[0]?.productName ?? "—";
  return { qty, first, extra: items.length - 1 };
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

/* Kebab (three-dot) icon */
function MoreIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="1"/>
      <circle cx="12" cy="5" r="1"/>
      <circle cx="12" cy="19" r="1"/>
    </svg>
  );
}

/* Row menu popover */
function RowMenu({
  order, open, onOpen, onClose, onChangeStatus, onDelete, onView,
}: {
  order: Order;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onChangeStatus: (s: OrderStatus) => void;
  onDelete: () => void;
  onView: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, onClose]);

  const opts = allowedStatusOptions(order).filter((s) => s !== order.status);
  const isOnline = order.source === "online";

  return (
    <div ref={ref} className={styles.rowMenuAnchor}>
      <button
        type="button"
        aria-label="Row actions"
        className={`${styles.ordersRowMenuBtn} ${open ? styles.ordersRowMenuBtnOpen : ""}`}
        onClick={(e) => { e.stopPropagation(); open ? onClose() : onOpen(); }}
      >
        <MoreIcon />
      </button>
      {open && (
        <div className={styles.rowMenu} onClick={(e) => e.stopPropagation()}>
          <button className={styles.rowMenuItem} onClick={() => { onClose(); onView(); }}>
            View details
          </button>
          {opts.length > 0 && <div className={styles.rowMenuSep} />}
          {opts.map((s) => (
            <button
              key={s}
              className={styles.rowMenuItem}
              onClick={() => { onClose(); onChangeStatus(s); }}
            >
              Mark as {STATUS_LABEL[s].toLowerCase()}
            </button>
          ))}
          {!isOnline && (
            <>
              <div className={styles.rowMenuSep} />
              <button
                className={`${styles.rowMenuItem} ${styles.rowMenuItemDanger}`}
                onClick={() => { onClose(); onDelete(); }}
              >
                Delete order
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* Detail side drawer */
function OrderDrawer({
  order, onClose, onChangeStatus, onDelete,
}: {
  order: Order;
  onClose: () => void;
  onChangeStatus: (s: OrderStatus) => void;
  onDelete: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const isOnline = order.source === "online";
  const opts = allowedStatusOptions(order).filter((s) => s !== order.status);

  return (
    <div className={styles.orderDrawerRoot} role="dialog" aria-label={`Order ${order.id}`}>
      <div className={styles.orderDrawerBackdrop} onClick={onClose} />
      <aside className={styles.orderDrawer}>
        <div className={styles.orderDrawerHead}>
          <div className={styles.orderDrawerHeadLeft}>
            <span className={styles.orderDrawerTitle}>
              #{order.id}
              <span className={`${styles.ordersCellStatus} ${statusDotClass(order.status)}`}>
                {STATUS_LABEL[order.status]}
              </span>
            </span>
            <span className={styles.orderDrawerTitleSub}>
              {isOnline ? "Online order" : "Manual sale"} · {new Date(order.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
            </span>
          </div>
          <button className={styles.orderDrawerClose} onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className={styles.orderDrawerBody}>
          <div className={styles.orderDrawerSection}>
            <div className={styles.orderDrawerSectionTitle}>Customer</div>
            <dl className={styles.orderDrawerFields}>
              <dt>Name</dt><dd>{order.customerName}</dd>
              <dt>Email</dt><dd>{order.customerEmail ?? "—"}</dd>
              <dt>Phone</dt><dd>{order.customerPhone ?? "—"}</dd>
              <dt>House</dt><dd>{order.house ?? "—"}</dd>
            </dl>
          </div>

          <div className={styles.orderDrawerSection}>
            <div className={styles.orderDrawerSectionTitle}>Items</div>
            <div className={styles.orderDrawerItems}>
              {order.items.map((i) => (
                <div key={i.id} className={styles.orderDrawerItemRow}>
                  <div className={styles.orderDrawerItemName}>
                    {i.productName}
                    {i.variantLabel && (
                      <div className={styles.orderDrawerItemVariant}>{i.variantLabel}</div>
                    )}
                  </div>
                  <span className={styles.orderDrawerItemQty}>×{i.qty}</span>
                  <span className={styles.orderDrawerItemTotal}>{formatPHP(i.lineTotal)}</span>
                </div>
              ))}
            </div>
            <div className={styles.orderDrawerTotals}>
              <div className={styles.orderDrawerTotalRow}>
                <span>Subtotal</span>
                <span>{formatPHP(order.subtotal)}</span>
              </div>
              {order.serviceFee > 0 && (
                <div className={styles.orderDrawerTotalRow}>
                  <span>Service fee</span>
                  <span>{formatPHP(order.serviceFee)}</span>
                </div>
              )}
              <div className={`${styles.orderDrawerTotalRow} ${styles.orderDrawerTotalGrand}`}>
                <span>Total</span>
                <span>{formatPHP(order.total)}</span>
              </div>
              {order.paidAmount !== order.total && (
                <div className={styles.orderDrawerTotalRow}>
                  <span>Paid</span>
                  <span>{formatPHP(order.paidAmount)}</span>
                </div>
              )}
            </div>
          </div>

          <div className={styles.orderDrawerSection}>
            <div className={styles.orderDrawerSectionTitle}>Payment</div>
            <dl className={styles.orderDrawerFields}>
              <dt>Method</dt>
              <dd>{order.paymentMethod ? PAYMENT_LABEL[order.paymentMethod] : "—"}</dd>
              {order.paidAt && (
                <>
                  <dt>Paid at</dt>
                  <dd>{new Date(order.paidAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</dd>
                </>
              )}
              {order.paymongoPaymentId && (
                <>
                  <dt>Payment ID</dt>
                  <dd className={styles.orderDrawerMono}>{order.paymongoPaymentId}</dd>
                </>
              )}
              {order.paymongoSessionId && !order.paymongoPaymentId && (
                <>
                  <dt>Session</dt>
                  <dd className={styles.orderDrawerMono}>{order.paymongoSessionId}</dd>
                </>
              )}
            </dl>
          </div>

          {order.notes && (
            <div className={styles.orderDrawerSection}>
              <div className={styles.orderDrawerSectionTitle}>Notes</div>
              <div style={{ color: "#e6e8eb", fontSize: "0.85rem", whiteSpace: "pre-wrap" }}>
                {order.notes}
              </div>
            </div>
          )}
        </div>

        <div className={styles.orderDrawerFoot}>
          {opts.map((s) => (
            <button
              key={s}
              className={styles.ordersToolbarBtn}
              onClick={() => onChangeStatus(s)}
            >
              Mark as {STATUS_LABEL[s].toLowerCase()}
            </button>
          ))}
          {!isOnline && (
            <button
              className={styles.ordersToolbarBtn}
              style={{ color: "#f87171", borderColor: "rgba(248, 113, 113, 0.35)", marginLeft: "auto" }}
              onClick={onDelete}
            >
              Delete
            </button>
          )}
        </div>
      </aside>
    </div>
  );
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
