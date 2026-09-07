import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/products/:id/variants — create a variant on a product
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { group, option, price, stock } = await req.json();

  if (!group?.trim() || !option?.trim()) {
    return NextResponse.json({ error: "group and option required" }, { status: 400 });
  }

  const variant = await prisma.productVariant.create({
    data: {
      productId: Number(id),
      group: group.trim(),
      option: option.trim(),
      price: Math.max(0, Math.round(Number(price) || 0)),
      stock: Math.max(0, Math.round(Number(stock) || 0)),
    },
  });

  return NextResponse.json(variant, { status: 201 });
}
