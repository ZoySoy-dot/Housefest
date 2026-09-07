import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/orders/analytics — KPI + chart data for the Store Overview page.
// Excludes cancelled orders from all totals.
export async function GET() {
  const orders = await prisma.order.findMany({
    where: { status: { not: "cancelled" } },
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });

  // KPIs
  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
  const orderCount = orders.length;
  const unitsSold = orders.reduce(
    (s, o) => s + o.items.reduce((si, i) => si + i.qty, 0),
    0,
  );
  const avgOrderValue = orderCount === 0 ? 0 : Math.round(totalRevenue / orderCount);

  // Revenue over time — daily buckets (last 30 days rolling window)
  const daysBack = 30;
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (daysBack - 1));

  const dailyMap = new Map<string, { date: string; revenue: number; orders: number }>();
  for (let i = 0; i < daysBack; i++) {
    const d = new Date(cutoff);
    d.setDate(cutoff.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    dailyMap.set(key, { date: key, revenue: 0, orders: 0 });
  }

  for (const o of orders) {
    if (o.createdAt < cutoff) continue;
    const key = o.createdAt.toISOString().slice(0, 10);
    const bucket = dailyMap.get(key);
    if (bucket) {
      bucket.revenue += o.total;
      bucket.orders  += 1;
    }
  }
  const revenueByDay = Array.from(dailyMap.values());

  // Revenue by category — join items -> product for category
  const productIds = Array.from(
    new Set(
      orders.flatMap((o) => o.items.map((i) => i.productId).filter((id): id is number => !!id)),
    ),
  );
  const products = productIds.length === 0
    ? []
    : await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, category: true },
      });
  const productMeta = new Map(products.map((p) => [p.id, p]));

  const categoryRevenue = new Map<string, number>();
  for (const o of orders) {
    for (const it of o.items) {
      const meta = it.productId ? productMeta.get(it.productId) : null;
      const cat = meta?.category ?? "Uncategorized";
      categoryRevenue.set(cat, (categoryRevenue.get(cat) ?? 0) + it.lineTotal);
    }
  }
  const revenueByCategory = Array.from(categoryRevenue.entries())
    .map(([category, revenue]) => ({ category, revenue }))
    .sort((a, b) => b.revenue - a.revenue);

  // Top products by units + revenue
  const productAgg = new Map<string, { productId: number | null; name: string; units: number; revenue: number }>();
  for (const o of orders) {
    for (const it of o.items) {
      const key = it.productId ? `p_${it.productId}` : `n_${it.productName}`;
      const bucket = productAgg.get(key) ?? {
        productId: it.productId,
        name:      it.productName,
        units:     0,
        revenue:   0,
      };
      bucket.units += it.qty;
      bucket.revenue += it.lineTotal;
      productAgg.set(key, bucket);
    }
  }
  const topProducts = Array.from(productAgg.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Status breakdown
  const statusCounts: Record<string, number> = { pending: 0, paid: 0, fulfilled: 0, cancelled: 0 };
  const allOrdersIncludingCancelled = await prisma.order.findMany({
    select: { status: true },
  });
  for (const o of allOrdersIncludingCancelled) {
    statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;
  }

  // Revenue by payment method (excludes cancelled)
  const paymentTotals = new Map<string, number>();
  for (const o of orders) {
    const key = o.paymentMethod ?? "unspecified";
    paymentTotals.set(key, (paymentTotals.get(key) ?? 0) + o.paidAmount);
  }
  const revenueByPayment = Array.from(paymentTotals.entries())
    .map(([method, revenue]) => ({ method, revenue }))
    .sort((a, b) => b.revenue - a.revenue);

  const totalPaid = orders.reduce((s, o) => s + o.paidAmount, 0);
  const outstanding = totalRevenue - totalPaid;

  return NextResponse.json({
    kpis: {
      totalRevenue,
      totalPaid,
      outstanding,
      orderCount,
      unitsSold,
      avgOrderValue,
    },
    revenueByDay,
    revenueByCategory,
    revenueByPayment,
    topProducts,
    statusCounts,
  });
}
