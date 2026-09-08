import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

// PayMongo webhook. Configure the endpoint in PayMongo dashboard and put the
// signing secret into PAYMONGO_WEBHOOK_SECRET. Docs: https://developers.paymongo.com/docs/webhooks
//
// Signature header: `paymongo-signature: t=<ts>,te=<sig_test>,li=<sig_live>`
// Signed payload: `${t}.${rawBody}` HMAC-SHA256 with the webhook secret.

export const runtime = "nodejs";

function verifySignature(rawBody: string, header: string | null, secret: string) {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((kv) => kv.split("=").map((s) => s.trim())),
  ) as { t?: string; te?: string; li?: string };

  const ts = parts.t;
  const provided = parts.te ?? parts.li;
  if (!ts || !provided) return false;

  const signed = `${ts}.${rawBody}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(signed)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(provided, "hex"),
    );
  } catch {
    return false;
  }
}

type WebhookEvent = {
  data: {
    id: string;
    attributes: {
      type: string;
      data: {
        id: string;
        attributes: Record<string, unknown> & {
          status?: string;
          amount?: number;
          reference_number?: string;
          payments?: Array<{ id: string; attributes: { status: string; amount: number } }>;
          payment_intent?: {
            attributes?: {
              payments?: Array<{ id: string; attributes: { status: string; amount: number } }>;
            };
          };
        };
      };
    };
  };
};

export async function POST(req: NextRequest) {
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
  const raw = await req.text();

  if (!secret) {
    console.warn("PAYMONGO_WEBHOOK_SECRET not set — rejecting webhook");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const sigHeader = req.headers.get("paymongo-signature");
  if (!verifySignature(raw, sigHeader, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let evt: WebhookEvent;
  try {
    evt = JSON.parse(raw) as WebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = evt.data?.attributes?.type;
  const inner = evt.data?.attributes?.data;
  const innerAttrs = inner?.attributes;
  if (!type || !inner || !innerAttrs) {
    return NextResponse.json({ received: true });
  }

  // Relevant events: checkout_session.payment.paid, payment.paid
  if (type === "checkout_session.payment.paid" || type === "payment.paid") {
    const sessionId = type === "checkout_session.payment.paid" ? inner.id : null;

    const paidFromSession =
      innerAttrs.payments?.find((p) => p.attributes.status === "paid") ??
      innerAttrs.payment_intent?.attributes?.payments?.find(
        (p) => p.attributes.status === "paid",
      );

    // For payment.paid the inner object IS the payment
    const paymentId =
      paidFromSession?.id ??
      (type === "payment.paid" ? inner.id : undefined);
    const amount =
      paidFromSession?.attributes.amount ??
      (typeof innerAttrs.amount === "number" ? innerAttrs.amount : undefined);

    if (!paymentId || amount == null) {
      return NextResponse.json({ received: true });
    }

    // Find order
    let order = null;
    if (sessionId) {
      order = await prisma.order.findUnique({ where: { paymongoSessionId: sessionId } });
    }
    if (!order) {
      order = await prisma.order.findFirst({ where: { paymongoPaymentId: paymentId } });
    }
    if (!order) {
      const ref = innerAttrs.reference_number;
      if (ref && ref.startsWith("HF-")) {
        const id = Number(ref.slice(3));
        if (id) order = await prisma.order.findUnique({ where: { id } });
      }
    }
    if (!order) return NextResponse.json({ received: true });

    if (order.status === "paid" || order.status === "fulfilled") {
      return NextResponse.json({ received: true, alreadyPaid: true });
    }

    await prisma.$transaction(async (tx) => {
      const o = await tx.order.findUnique({
        where: { id: order!.id },
        include: { items: true },
      });
      if (!o || o.status === "paid" || o.status === "fulfilled") return;

      for (const item of o.items) {
        if (item.variantId != null) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { decrement: item.qty } },
          });
        }
      }

      await tx.order.update({
        where: { id: order!.id },
        data: {
          status: "paid",
          paidAmount: amount,
          paidAt: new Date(),
          paymongoPaymentId: paymentId,
        },
      });
    });
  }

  return NextResponse.json({ received: true });
}
