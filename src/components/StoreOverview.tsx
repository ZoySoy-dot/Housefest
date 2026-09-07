"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart, Bar,
  XAxis, YAxis,
  Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import styles from "./AdminPanel.module.css";

type Analytics = {
  kpis: {
    totalRevenue: number;
    totalPaid: number;
    outstanding: number;
    orderCount: number;
    unitsSold: number;
    avgOrderValue: number;
  };
  revenueByDay: { date: string; revenue: number; orders: number }[];
  revenueByCategory: { category: string; revenue: number }[];
  revenueByPayment: { method: string; revenue: number }[];
  topProducts: { productId: number | null; name: string; units: number; revenue: number }[];
  statusCounts: Record<string, number>;
};

const PAYMENT_LABEL: Record<string, string> = {
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
  card: "Card",
  bank: "Bank transfer",
  other: "Other",
  unspecified: "Unspecified",
};

function formatPHP(centavos: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(centavos / 100);
}

function shortDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

const CATEGORY_COLORS = ["#22d38f", "#4c9aff", "#f0b429", "#ef4b5c", "#a78bfa", "#38bdf8", "#f97316", "#84cc16"];

export default function StoreOverview() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/orders/analytics");
    if (!res.ok) { setLoaded(true); return; }
    setData(await res.json());
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!loaded) {
    return (
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Overview</h2>
        </div>
        <div className={styles.empty}>Loading analytics…</div>
      </section>
    );
  }

  if (!data) {
    return (
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Overview</h2>
        </div>
        <div className={styles.empty}>Failed to load analytics.</div>
      </section>
    );
  }

  const { kpis, revenueByDay, revenueByCategory, revenueByPayment, topProducts, statusCounts } = data;

  const hasAnyRevenue = kpis.totalRevenue > 0;

  return (
    <>
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Overview</h2>
          <span className={styles.sectionHint}>All figures exclude cancelled orders</span>
        </div>

        {/* KPI TILES */}
        <div className={styles.kpiGrid}>
          <KpiTile label="Revenue"     value={formatPHP(kpis.totalRevenue)} sub={`${kpis.orderCount} orders`} />
          <KpiTile label="Collected"   value={formatPHP(kpis.totalPaid)}
                   sub={kpis.outstanding > 0 ? `${formatPHP(kpis.outstanding)} outstanding` : "Fully collected"} />
          <KpiTile label="Orders"      value={kpis.orderCount.toLocaleString()} sub={`${statusCounts.pending ?? 0} pending`} />
          <KpiTile label="Units sold"  value={kpis.unitsSold.toLocaleString()} sub="Across all products" />
          <KpiTile label="Avg order"   value={formatPHP(kpis.avgOrderValue)} sub={kpis.orderCount === 0 ? "No data yet" : "Per order (excl. cancelled)"} />
        </div>

        {/* REVENUE OVER TIME */}
        <div className={styles.chartCard}>
          <div className={styles.chartHead}>
            <h3 className={styles.chartTitle}>Revenue — last 30 days</h3>
            <span className={styles.chartHint}>Daily total, PHP</span>
          </div>
          {hasAnyRevenue ? (
            <div className={styles.chartBody}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={revenueByDay} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                  <CartesianGrid stroke="#1a1e24" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    stroke="#6c7280"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: "#232830" }}
                  />
                  <YAxis
                    stroke="#6c7280"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => formatPHP(Number(v))}
                    width={72}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(34, 211, 143, 0.06)" }}
                    contentStyle={{
                      background: "#0e1116",
                      border: "1px solid #232830",
                      borderRadius: 6,
                      fontSize: 12,
                      color: "#e6e8eb",
                    }}
                    labelFormatter={(l) => shortDate(String(l))}
                    formatter={(v, name) =>
                      name === "revenue"
                        ? [formatPHP(Number(v)), "Revenue"]
                        : [v as string | number, String(name)]
                    }
                  />
                  <Bar dataKey="revenue" fill="#22d38f" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className={styles.chartEmpty}>
              No sales in the last 30 days yet. Record a sale to see this chart populate.
            </div>
          )}
        </div>

        {/* CATEGORY + TOP PRODUCTS */}
        <div className={styles.chartGrid2}>
          <div className={styles.chartCard}>
            <div className={styles.chartHead}>
              <h3 className={styles.chartTitle}>Revenue by category</h3>
            </div>
            {revenueByCategory.length > 0 ? (
              <div className={styles.chartBody}>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={revenueByCategory}
                      dataKey="revenue"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={2}
                      stroke="#0b0d10"
                      strokeWidth={2}
                    >
                      {revenueByCategory.map((_, i) => (
                        <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "#0e1116",
                        border: "1px solid #232830",
                        borderRadius: 6,
                        fontSize: 12,
                        color: "#e6e8eb",
                      }}
                      formatter={(v) => formatPHP(Number(v))}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 12, color: "#a8adb5" }}
                      iconType="square"
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className={styles.chartEmpty}>No category data yet.</div>
            )}
          </div>

          <div className={styles.chartCard}>
            <div className={styles.chartHead}>
              <h3 className={styles.chartTitle}>Top products</h3>
              <span className={styles.chartHint}>By revenue</span>
            </div>
            {topProducts.length > 0 ? (
              <div className={styles.topTable}>
                <div className={`${styles.topRow} ${styles.topHeaderRow}`}>
                  <span>Product</span>
                  <span>Units</span>
                  <span>Revenue</span>
                </div>
                {topProducts.map((p, i) => (
                  <div key={i} className={styles.topRow}>
                    <span className={styles.topName}>{p.name}</span>
                    <span className={styles.topNum}>{p.units}</span>
                    <span className={styles.topRevenue}>{formatPHP(p.revenue)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.chartEmpty}>No sales yet.</div>
            )}
          </div>
        </div>

        {/* PAYMENT METHOD BREAKDOWN */}
        <div className={styles.chartCard}>
          <div className={styles.chartHead}>
            <h3 className={styles.chartTitle}>Revenue by payment method</h3>
            <span className={styles.chartHint}>Based on amount collected</span>
          </div>
          {revenueByPayment.length > 0 && kpis.totalPaid > 0 ? (
            <div className={styles.paymentBars}>
              {revenueByPayment.map((p) => {
                const pct = kpis.totalPaid === 0 ? 0 : (p.revenue / kpis.totalPaid) * 100;
                return (
                  <div key={p.method} className={styles.paymentBarRow}>
                    <span className={styles.paymentBarLabel}>{PAYMENT_LABEL[p.method] ?? p.method}</span>
                    <div className={styles.paymentBarTrack}>
                      <div className={styles.paymentBarFill} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={styles.paymentBarValue}>{formatPHP(p.revenue)}</span>
                    <span className={styles.paymentBarPct}>{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.chartEmpty}>No payments recorded yet.</div>
          )}
        </div>
      </section>
    </>
  );
}

function KpiTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={styles.kpiTile}>
      <div className={styles.kpiLabel}>{label}</div>
      <div className={styles.kpiValue}>{value}</div>
      {sub && <div className={styles.kpiSub}>{sub}</div>}
    </div>
  );
}
