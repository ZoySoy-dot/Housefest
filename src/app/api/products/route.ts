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
  const { name, description, imageUrl, imageUrls, sizeChartUrl, category, basePrice, active } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

  const urls = Array.isArray(imageUrls)
    ? imageUrls.filter((u): u is string => typeof u === "string" && u.trim().length > 0).map((u) => u.trim())
    : [];

  const product = await prisma.product.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      imageUrl: imageUrl?.trim() || urls[0] || null,
      imageUrls: urls,
      sizeChartUrl: sizeChartUrl?.trim() || null,
      category: category?.trim() || null,
      basePrice: Math.max(0, Math.round(Number(basePrice) || 0)),
      active: typeof active === "boolean" ? active : true,
    },
    include: { variants: true },
  });

  return NextResponse.json(product, { status: 201 });
}
