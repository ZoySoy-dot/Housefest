import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type IncomingItem = {
  productId?: number | null;
  variantId?: number | null;
  productName?: string;   // fallback if productId not resolvable
  variantLabel?: string | null;
  unitPrice?: number;     // centavos
  qty: number;
};

// GET /api/orders?status=&search=&from=&to=
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  const search = req.nextUrl.searchParams.get("search")?.trim();
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");

  const where: {
    status?: "pending" | "paid" | "fulfilled" | "cancelled";
    createdAt?: { gte?: Date; lte?: Date };
    OR?: Array<Record<string, unknown>>;
  } = {};

  if (status && ["pending", "paid", "fulfilled", "cancelled"].includes(status)) {
    where.status = status as typeof where.status;
  }
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to)   where.createdAt.lte = new Date(to);
  }
  if (search) {
    where.OR = [
      { customerName:  { contains: search, mode: "insensitive" } },
      { customerEmail: { contains: search, mode: "insensitive" } },
      { customerPhone: { contains: search, mode: "insensitive" } },
    ];
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { items: true },
    take: 500,
  });

  return NextResponse.json(orders);
}

// POST /api/orders — create an order (manual sale from admin, or online later)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    customerName,
    customerEmail,
    customerPhone,
    house,
    notes,
    status,
    source,
    paymentMethod,
    paidAmount,
    items,
  } = body as {
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    house?: string;
    notes?: string;
    status?: "pending" | "paid" | "fulfilled" | "cancelled";
    source?: "online" | "manual";
    paymentMethod?: "cash" | "gcash" | "maya" | "card" | "bank" | "other";
    paidAmount?: number;
    items: IncomingItem[];
  };

  if (!customerName?.trim()) {
    return NextResponse.json({ error: "customerName required" }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "at least one item required" }, { status: 400 });
  }

  // Resolve prices/names from DB when productId is given, otherwise trust the payload
  const resolved = await Promise.all(items.map(async (it) => {
    const qty = Math.max(1, Math.round(it.qty || 1));
    let unitPrice = Math.max(0, Math.round(it.unitPrice ?? 0));
    let productName = (it.productName ?? "").trim();
    let variantLabel = it.variantLabel ?? null;

    if (it.variantId) {
      const v = await prisma.productVariant.findUnique({
        where: { id: it.variantId },
        include: { product: true },
      });
      if (v) {
        unitPrice = v.price;
        productName = v.product.name;
        variantLabel = `${v.group} · ${v.option}`;
      }
    } else if (it.productId) {
      const p = await prisma.product.findUnique({ where: { id: it.productId } });
      if (p) {
        unitPrice = p.basePrice;
        productName = p.name;
      }
    }

    if (!productName) productName = "Item";

    return {
      productId:    it.productId  ?? null,
      variantId:    it.variantId  ?? null,
      productName,
      variantLabel,
      unitPrice,
      qty,
      lineTotal: unitPrice * qty,
    };
  }));

  const subtotal = resolved.reduce((s, i) => s + i.lineTotal, 0);
  const total = subtotal;
  const resolvedStatus = status || "paid";
  // If paid amount not supplied but status is paid/fulfilled, assume the full total.
  const resolvedPaid =
    typeof paidAmount === "number"
      ? Math.max(0, Math.round(paidAmount))
      : (resolvedStatus === "paid" || resolvedStatus === "fulfilled" ? total : 0);

  const order = await prisma.order.create({
    data: {
      customerName:  customerName.trim(),
      customerEmail: customerEmail?.trim() || null,
      customerPhone: customerPhone?.trim() || null,
      house:         house?.trim() || null,
      notes:         notes?.trim() || null,
      status:        resolvedStatus,
      source:        source || "manual",
      paymentMethod: paymentMethod || null,
      paidAmount:    resolvedPaid,
      subtotal,
      total,
      items: { create: resolved },
    },
    include: { items: true },
  });

  return NextResponse.json(order, { status: 201 });
}
