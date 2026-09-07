import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type SeedVariant = { group: string; option: string; price: number; stock: number };
type SeedProduct = {
  name: string;
  description: string;
  imageUrl: string;
  category: string;
  basePrice: number;
  variants: SeedVariant[];
};

// Prices in centavos (₱1 = 100).
const SEED: SeedProduct[] = [
  {
    name: "Housefest Classic Shirt",
    description: "Official Housefest 2025 tee. 100% cotton, unisex fit, screen-printed logo on the chest and full-color house crest on the back.",
    imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=80&auto=format&fit=crop",
    category: "Apparel",
    basePrice: 45000,
    variants: [
      { group: "Size", option: "XS", price: 45000, stock: 12 },
      { group: "Size", option: "S",  price: 45000, stock: 24 },
      { group: "Size", option: "M",  price: 45000, stock: 30 },
      { group: "Size", option: "L",  price: 45000, stock: 22 },
      { group: "Size", option: "XL", price: 45000, stock: 15 },
      { group: "Size", option: "2XL", price: 50000, stock: 8 },
    ],
  },
  {
    name: "House Hoodie",
    description: "Heavyweight fleece hoodie with an embroidered house patch. Comes in your house colors.",
    imageUrl: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&q=80&auto=format&fit=crop",
    category: "Apparel",
    basePrice: 120000,
    variants: [
      { group: "Size", option: "S",  price: 120000, stock: 10 },
      { group: "Size", option: "M",  price: 120000, stock: 14 },
      { group: "Size", option: "L",  price: 120000, stock: 12 },
      { group: "Size", option: "XL", price: 120000, stock: 6 },
      { group: "Size", option: "2XL", price: 130000, stock: 0 },
    ],
  },
  {
    name: "Housefest Tote Bag",
    description: "Sturdy canvas tote, roomy enough for laptops and books. Printed with the Housefest 2025 logo.",
    imageUrl: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&q=80&auto=format&fit=crop",
    category: "Accessories",
    basePrice: 32500,
    variants: [],
  },
  {
    name: "Enamel Pin Set",
    description: "Set of four collectible enamel pins — one for each house. Perfect for lanyards and bags.",
    imageUrl: "https://images.unsplash.com/photo-1583744946564-b52ac1c389c8?w=800&q=80&auto=format&fit=crop",
    category: "Accessories",
    basePrice: 25000,
    variants: [
      { group: "House", option: "Mutien",  price: 8000, stock: 40 },
      { group: "House", option: "Benilde", price: 8000, stock: 35 },
      { group: "House", option: "Jaime",   price: 8000, stock: 42 },
      { group: "House", option: "Miguel",  price: 8000, stock: 38 },
      { group: "House", option: "Full Set", price: 25000, stock: 20 },
    ],
  },
  {
    name: "Housefest Water Bottle",
    description: "Insulated 750ml stainless steel bottle. Keeps drinks cold for 24 hours.",
    imageUrl: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&q=80&auto=format&fit=crop",
    category: "Accessories",
    basePrice: 55000,
    variants: [
      { group: "Color", option: "Matte Black", price: 55000, stock: 18 },
      { group: "Color", option: "Forest Green", price: 55000, stock: 22 },
      { group: "Color", option: "Cream", price: 55000, stock: 14 },
    ],
  },
  {
    name: "Housefest Cap",
    description: "Six-panel structured cap with embroidered wordmark. Adjustable strap fits all sizes.",
    imageUrl: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&q=80&auto=format&fit=crop",
    category: "Apparel",
    basePrice: 40000,
    variants: [
      { group: "Color", option: "Black", price: 40000, stock: 25 },
      { group: "Color", option: "White", price: 40000, stock: 18 },
    ],
  },
  {
    name: "Sticker Pack",
    description: "Ten die-cut vinyl stickers featuring house mascots, event slogans, and DLSU icons.",
    imageUrl: "https://images.unsplash.com/photo-1626785774573-4b799315345d?w=800&q=80&auto=format&fit=crop",
    category: "Accessories",
    basePrice: 15000,
    variants: [],
  },
  {
    name: "Lanyard",
    description: "Woven Housefest lanyard with a detachable ID clip.",
    imageUrl: "https://images.unsplash.com/photo-1600180758890-6b94519a8ba6?w=800&q=80&auto=format&fit=crop",
    category: "Accessories",
    basePrice: 12000,
    variants: [],
  },
];

// GET /api/seed-store — creates the mock products/variants (idempotent by name).
export async function GET() {
  let created = 0;
  let skipped = 0;

  for (const p of SEED) {
    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    if (existing) { skipped++; continue; }

    await prisma.product.create({
      data: {
        name: p.name,
        description: p.description,
        imageUrl: p.imageUrl,
        category: p.category,
        basePrice: p.basePrice,
        active: true,
        variants: {
          create: p.variants.map((v) => ({
            group: v.group,
            option: v.option,
            price: v.price,
            stock: v.stock,
          })),
        },
      },
    });
    created++;
  }

  return NextResponse.json({
    ok: true,
    created,
    skipped,
    message: `Seeded ${created} product(s); ${skipped} already existed.`,
  });
}

// DELETE /api/seed-store — wipes ONLY the seeded mock products (by name match).
export async function DELETE() {
  const names = SEED.map((p) => p.name);
  const result = await prisma.product.deleteMany({ where: { name: { in: names } } });
  return NextResponse.json({ ok: true, deleted: result.count });
}
