import { prisma } from "@/lib/prisma";

// Idempotent: safe to call multiple times for the same order.
// Marks order paid and decrements variant stock inside a single transaction.
export async function markOrderPaid(
  orderId: number,
  paymentId: string,
  amount: number,
): Promise<"already_paid" | "marked"> {
  return prisma.$transaction(async (tx) => {
    const o = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!o) throw new Error(`Order ${orderId} not found`);
    if (o.status === "paid" || o.status === "fulfilled") return "already_paid";

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

    return "marked";
  });
}
