import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCheckoutSession, type PayMongoLineItem } from "@/lib/paymongo";

const PAYMENT_METHODS = ["gcash", "grab_pay", "paymaya", "qrph"];

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { id } = await params;
  const orderId = Number(id);
  if (!orderId) {
    return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.source !== "online") {
    return NextResponse.json({ error: "Not an online order" }, { status: 400 });
  }
  if ((order.customerEmail ?? "").toLowerCase() !== email) {
    return NextResponse.json({ error: "Not your order" }, { status: 403 });
  }
  if (order.status !== "pending") {
    return NextResponse.json(
      { error: `Order is ${order.status}, cannot resume payment` },
      { status: 400 },
    );
  }

  const lineItems: PayMongoLineItem[] = order.items.map((it) => ({
    name: it.variantLabel ? `${it.productName} — ${it.variantLabel}` : it.productName,
    quantity: it.qty,
    amount: it.unitPrice,
    currency: "PHP",
  }));

  if (order.serviceFee > 0) {
    lineItems.push({
      name: "Service fee",
      quantity: 1,
      amount: order.serviceFee,
      currency: "PHP",
      description: "Payment processing & handling",
    });
  }

  const base =
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000";

  try {
    const checkout = await createCheckoutSession({
      lineItems,
      paymentMethodTypes: PAYMENT_METHODS,
      successUrl: `${base}/store/checkout/success?order=${order.id}`,
      cancelUrl: `${base}/store/orders`,
      referenceNumber: `HF-${order.id}`,
      description: `Housefest order #${order.id}`,
      billing: {
        name: order.customerName,
        email: order.customerEmail ?? undefined,
        phone: order.customerPhone ?? undefined,
      },
      metadata: { orderId: String(order.id), house: order.house ?? "" },
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
    const msg = err instanceof Error ? err.message : "Failed to create checkout session";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
