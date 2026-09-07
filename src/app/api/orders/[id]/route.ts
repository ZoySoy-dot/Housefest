import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/orders/:id
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id: Number(id) },
    include: { items: true },
  });
  if (!order) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(order);
}

// PATCH /api/orders/:id — mainly to update status
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const data: {
    status?: "pending" | "paid" | "fulfilled" | "cancelled";
    notes?: string | null;
    customerName?: string;
    customerEmail?: string | null;
    customerPhone?: string | null;
    house?: string | null;
    paymentMethod?: "cash" | "gcash" | "maya" | "card" | "bank" | "other" | null;
    paidAmount?: number;
  } = {};

  if (typeof body.status === "string" &&
      ["pending", "paid", "fulfilled", "cancelled"].includes(body.status)) {
    data.status = body.status;
  }
  if (typeof body.notes         === "string") data.notes         = body.notes || null;
  if (typeof body.customerName  === "string") data.customerName  = body.customerName.trim();
  if (typeof body.customerEmail === "string") data.customerEmail = body.customerEmail.trim() || null;
  if (typeof body.customerPhone === "string") data.customerPhone = body.customerPhone.trim() || null;
  if (typeof body.house         === "string") data.house         = body.house.trim() || null;
  if (body.paymentMethod === null) data.paymentMethod = null;
  else if (typeof body.paymentMethod === "string" &&
    ["cash", "gcash", "maya", "card", "bank", "other"].includes(body.paymentMethod)) {
    data.paymentMethod = body.paymentMethod as typeof data.paymentMethod;
  }
  if (typeof body.paidAmount === "number") data.paidAmount = Math.max(0, Math.round(body.paidAmount));

  const order = await prisma.order.update({
    where: { id: Number(id) },
    data,
    include: { items: true },
  });

  return NextResponse.json(order);
}

// DELETE /api/orders/:id — cascades to items
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.order.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
