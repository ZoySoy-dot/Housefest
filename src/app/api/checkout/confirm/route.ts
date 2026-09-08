import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { retrieveCheckoutSession, getPaidPaymentId } from "@/lib/paymongo";

// Success-page fallback: query PayMongo for the order's session and mark paid
// if the session shows a successful payment. Idempotent — safe to call twice.
export async function POST(req: NextRequest) {
  const { orderId } = await req.json().catch(() => ({}));
  const id = Number(orderId);
  if (!id) return NextResponse.json({ error: "Missing orderId" }, { status: 400 });

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.status === "paid" || order.status === "fulfilled") {
    return NextResponse.json({ status: order.status, orderId: order.id });
  }
  if (!order.paymongoSessionId) {
    return NextResponse.json({ error: "Order has no PayMongo session" }, { status: 400 });
  }

  const sess = await retrieveCheckoutSession(order.paymongoSessionId);
  const paid = getPaidPaymentId(sess);
  if (!paid) {
    return NextResponse.json({ status: order.status, orderId: order.id });
  }

  await markOrderPaid(order.id, paid.paymentId, paid.amount);
  return NextResponse.json({ status: "paid", orderId: order.id });
}

async function markOrderPaid(
  orderId: number,
  paymentId: string,
  amount: number,
) {
  await prisma.$transaction(async (tx) => {
    const o = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!o) return;
    if (o.status === "paid" || o.status === "fulfilled") return;

    // Decrement variant stock
    for (const item of o.items) {
      if (item.variantId != null) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { decrement: item.qty } },
        });
      }
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "paid",
        paidAmount: amount,
        paidAt: new Date(),
        paymongoPaymentId: paymentId,
      },
    });
  });
}
