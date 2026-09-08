import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/products/:id
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id: Number(id) },
    include: { variants: { orderBy: { id: "asc" } } },
  });
  if (!product) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(product);
}

// PATCH /api/products/:id
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const data: {
    name?: string;
    description?: string | null;
    imageUrl?: string | null;
    imageUrls?: string[];
    sizeChartUrl?: string | null;
    category?: string | null;
    basePrice?: number;
    active?: boolean;
  } = {};

  if (typeof body.name        === "string")  data.name        = body.name.trim();
  if (typeof body.description === "string")  data.description = body.description.trim() || null;
  if (typeof body.imageUrl    === "string")  data.imageUrl    = body.imageUrl.trim() || null;
  if (typeof body.sizeChartUrl === "string") data.sizeChartUrl = body.sizeChartUrl.trim() || null;
  if (Array.isArray(body.imageUrls)) {
    const urls = body.imageUrls
      .filter((u: unknown): u is string => typeof u === "string" && u.trim().length > 0)
      .map((u: string) => u.trim());
    data.imageUrls = urls;
    // Keep legacy imageUrl in sync with primary image
    if (data.imageUrl === undefined) {
      data.imageUrl = urls[0] ?? null;
    }
  }
  if (typeof body.category    === "string")  data.category    = body.category.trim() || null;
  if (typeof body.basePrice   === "number")  data.basePrice   = Math.max(0, Math.round(body.basePrice));
  if (typeof body.active      === "boolean") data.active      = body.active;

  const product = await prisma.product.update({
    where: { id: Number(id) },
    data,
    include: { variants: { orderBy: { id: "asc" } } },
  });

  return NextResponse.json(product);
}

// DELETE /api/products/:id — cascades to variants
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.product.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
