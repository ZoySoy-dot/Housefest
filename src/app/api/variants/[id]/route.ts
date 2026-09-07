import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/variants/:id
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const data: { group?: string; option?: string; price?: number; stock?: number } = {};
  if (typeof body.group  === "string") data.group  = body.group.trim();
  if (typeof body.option === "string") data.option = body.option.trim();
  if (typeof body.price  === "number") data.price  = Math.max(0, Math.round(body.price));
  if (typeof body.stock  === "number") data.stock  = Math.max(0, Math.round(body.stock));

  const variant = await prisma.productVariant.update({
    where: { id: Number(id) },
    data,
  });

  return NextResponse.json(variant);
}

// DELETE /api/variants/:id
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.productVariant.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
