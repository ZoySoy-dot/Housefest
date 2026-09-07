import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/products?includeInactive=1
export async function GET(req: NextRequest) {
  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "1";
  const products = await prisma.product.findMany({
    where: includeInactive ? {} : { active: true },
    orderBy: { createdAt: "asc" },
    include: { variants: { orderBy: { id: "asc" } } },
  });
  return NextResponse.json(products);
}

// POST /api/products — create a product
export async function POST(req: NextRequest) {
  const { name, description, imageUrl, category, basePrice, active } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

  const product = await prisma.product.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      imageUrl: imageUrl?.trim() || null,
      category: category?.trim() || null,
      basePrice: Math.max(0, Math.round(Number(basePrice) || 0)),
      active: typeof active === "boolean" ? active : true,
    },
    include: { variants: true },
  });

  return NextResponse.json(product, { status: 201 });
}
