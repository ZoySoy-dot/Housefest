import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCheckoutSession, type PayMongoLineItem } from "@/lib/paymongo";
import { HOUSES, isHouse } from "@/lib/houses";
import { serviceFeeFor } from "@/lib/fees";

type CartItemInput = {
  productId: number;
  variantId: number | null;
  qty: number;
};

type CheckoutBody = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  house: string;
  notes?: string;
  items: CartItemInput[];
};

const PAYMENT_METHODS = ["gcash", "grab_pay", "paymaya", "qrph"];

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  let body: CheckoutBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.customerName?.trim();
  const email = body.customerEmail?.trim();
  const phone = body.customerPhone?.trim();
  const house = body.house?.trim();
  const notes = body.notes?.trim() || null;

  if (!name || !email || !phone || !house) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }
  if (!isHouse(house)) {
    return NextResponse.json(
      { error: `House must be one of: ${HOUSES.join(", ")}` },
      { status: 400 },
    );
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  // Load products + variants from DB to recompute prices authoritatively
  const productIds = Array.from(new Set(body.items.map((i) => i.productId)));
  const variantIds = body.items
    .map((i) => i.variantId)
    .filter((v): v is number => typeof v === "number");

  const [products, variants] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: productIds } } }),
    variantIds.length
      ? prisma.productVariant.findMany({ where: { id: { in: variantIds } } })
      : Promise.resolve([]),
  ]);

  const productById = new Map(products.map((p) => [p.id, p]));
  const variantById = new Map(variants.map((v) => [v.id, v]));

  const lineItems: PayMongoLineItem[] = [];
  const orderItemsData: {
    productId: number;
    variantId: number | null;
    productName: string;
    variantLabel: string | null;
    unitPrice: number;
    qty: number;
    lineTotal: number;
  }[] = [];

  for (const it of body.items) {
    const p = productById.get(it.productId);
    if (!p || !p.active) {
      return NextResponse.json(
        { error: `Product ${it.productId} not available` },
        { status: 400 },
      );
    }
    const qty = Math.max(1, Math.floor(it.qty || 0));
    let unitPrice = p.basePrice;
    let variantLabel: string | null = null;

    if (it.variantId != null) {
      const v = variantById.get(it.variantId);
      if (!v || v.productId !== p.id) {
        return NextResponse.json(
          { error: `Variant ${it.variantId} invalid` },
          { status: 400 },
        );
      }
      if (v.stock < qty) {
        return NextResponse.json(
          { error: `Not enough stock for ${p.name} (${v.group}: ${v.option})` },
          { status: 409 },
        );
      }
      unitPrice = v.price || p.basePrice;
      variantLabel = `${v.group} · ${v.option}`;
    }

    const lineTotal = unitPrice * qty;
    orderItemsData.push({
      productId: p.id,
      variantId: it.variantId ?? null,
      productName: p.name,
      variantLabel,
      unitPrice,
      qty,
      lineTotal,
    });

    lineItems.push({
      name: variantLabel ? `${p.name} — ${variantLabel}` : p.name,
      quantity: qty,
      amount: unitPrice,
      currency: "PHP",
      description: p.description ?? undefined,
      images: p.imageUrl ? [p.imageUrl] : undefined,
    });
  }

  const subtotal = orderItemsData.reduce((s, i) => s + i.lineTotal, 0);
  const serviceFee = serviceFeeFor(subtotal);
  const total = subtotal + serviceFee;

  if (subtotal <= 0) {
    return NextResponse.json({ error: "Invalid total" }, { status: 400 });
  }

  lineItems.push({
    name: "Service fee",
    quantity: 1,
    amount: serviceFee,
    currency: "PHP",
    description: "Payment processing & handling",
  });

  const order = await prisma.order.create({
    data: {
      customerName: name,
      customerEmail: email,
      customerPhone: phone,
      house,
      notes,
      status: "pending",
      source: "online",
      paymentMethod: "paymongo",
      subtotal,
      serviceFee,
      total,
      items: { create: orderItemsData },
    },
  });

  const base =
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000";

  try {
    const checkout = await createCheckoutSession({
      lineItems,
      paymentMethodTypes: PAYMENT_METHODS,
      successUrl: `${base}/store/checkout/success?order=${order.id}`,
      cancelUrl: `${base}/store/cart`,
      referenceNumber: `HF-${order.id}`,
      description: `Housefest order #${order.id}`,
      billing: { name, email, phone },
      metadata: { orderId: String(order.id), house },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { paymongoSessionId: checkout.id },
    });

    return NextResponse.json({
      orderId: order.id,
      checkoutUrl: checkout.attributes.checkout_url,
    });
  } catch (err) {
    await prisma.order
      .update({ where: { id: order.id }, data: { status: "cancelled" } })
      .catch(() => {});
    const msg = err instanceof Error ? err.message : "Checkout failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
