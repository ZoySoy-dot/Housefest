import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/seed-orders?count=60 — inserts fake orders spanning the last 30 days.
// Uses whatever products/variants exist in the DB. If none, falls back to snapshot names.
// Idempotent-ish: won't run if orders already exist unless ?force=1 is set.

const FIRST_NAMES = [
  "Ana", "Marco", "Bea", "Carlo", "Denise", "Enzo", "Faye", "Gio", "Hana", "Iggy",
  "Jam", "Kai", "Lara", "Miko", "Nica", "Oli", "Paolo", "Quin", "Rica", "Seb",
  "Tin", "Uno", "Vince", "Winnie", "Xylie", "Yza", "Zeke", "Alex", "Bianca", "Chad",
];
const LAST_NAMES = [
  "Reyes", "Santos", "Cruz", "Garcia", "Torres", "Lim", "Tan", "Ong", "Sy", "Chua",
  "Dela Cruz", "Mendoza", "Ramos", "Gutierrez", "Aquino", "Villanueva", "Bautista",
  "Del Rosario", "Fernandez", "Concepcion", "Pascual", "Domingo", "Salazar",
];
const HOUSES = ["Mutien", "Benilde", "Jaime", "Miguel"];
const PAYMENTS = ["cash", "gcash", "maya", "card", "bank"] as const;
type Payment = typeof PAYMENTS[number];

type StatusPick = {
  status: "pending" | "paid" | "fulfilled" | "cancelled";
  weight: number;
};
const STATUS_MIX: StatusPick[] = [
  { status: "paid",      weight: 55 },
  { status: "fulfilled", weight: 30 },
  { status: "pending",   weight: 10 },
  { status: "cancelled", weight: 5  },
];

const PAYMENT_MIX: { method: Payment; weight: number }[] = [
  { method: "gcash", weight: 45 },
  { method: "cash",  weight: 30 },
  { method: "maya",  weight: 12 },
  { method: "card",  weight: 8  },
  { method: "bank",  weight: 5  },
];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function pickWeighted<T extends { weight: number }>(arr: T[]): T {
  const total = arr.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const x of arr) {
    r -= x.weight;
    if (r <= 0) return x;
  }
  return arr[arr.length - 1];
}
function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function slugEmail(first: string, last: string, i: number) {
  return `${first.toLowerCase().replace(/\s+/g, "")}.${last.toLowerCase().replace(/\s+/g, "")}${i}@dlsu.edu.ph`;
}
function fakePhone() {
  const num = String(randomInt(1000000, 9999999)).padStart(7, "0");
  return `+63 917 ${num.slice(0, 3)} ${num.slice(3)}`;
}

/** Skew a random date toward "today" — event ramp-up pattern. */
function pickCreatedAt(daysBack: number) {
  const now = Date.now();
  // Cube the random so more orders land near "now"
  const skew = Math.pow(Math.random(), 2.4);
  const day = Math.floor(skew * daysBack);
  const d = new Date(now - day * 24 * 60 * 60 * 1000);
  // Random hour skewed toward business hours 10am-9pm
  d.setHours(randomInt(9, 21), randomInt(0, 59), randomInt(0, 59), 0);
  return d;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const requested = Math.min(Math.max(Number(url.searchParams.get("count") ?? 60), 1), 300);
  const force = url.searchParams.get("force") === "1";

  const existing = await prisma.order.count();
  if (existing > 0 && !force) {
    return NextResponse.json({
      ok: false,
      message: `Skipped — ${existing} order(s) already exist. Pass ?force=1 to seed anyway.`,
    });
  }

  const products = await prisma.product.findMany({
    include: { variants: true },
  });

  if (products.length === 0) {
    return NextResponse.json({
      ok: false,
      message: "No products found. Seed products first via /api/seed-store.",
    }, { status: 400 });
  }

  const created: number[] = [];

  for (let i = 0; i < requested; i++) {
    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);
    const name = `${first} ${last}`;
    const email = Math.random() < 0.85 ? slugEmail(first, last, i) : null;
    const phone = Math.random() < 0.6 ? fakePhone() : null;
    const house = Math.random() < 0.9 ? pick(HOUSES) : null;
    const statusPick = pickWeighted(STATUS_MIX);
    const paymentPick = pickWeighted(PAYMENT_MIX);

    // 1–4 line items
    const itemCount = randomInt(1, 4);
    const chosen = new Set<string>();
    const items = [];
    for (let j = 0; j < itemCount; j++) {
      const p = pick(products);
      let unitPrice = p.basePrice;
      let variantLabel: string | null = null;
      let variantId: number | null = null;
      if (p.variants.length > 0) {
        const v = pick(p.variants);
        unitPrice = v.price;
        variantLabel = `${v.group} · ${v.option}`;
        variantId = v.id;
      }
      const dedupeKey = `${p.id}::${variantId ?? "base"}`;
      if (chosen.has(dedupeKey)) continue;
      chosen.add(dedupeKey);

      const qty = randomInt(1, 3);
      items.push({
        productId:    p.id,
        variantId,
        productName:  p.name,
        variantLabel,
        unitPrice,
        qty,
        lineTotal:    unitPrice * qty,
      });
    }
    if (items.length === 0) continue;

    const subtotal = items.reduce((s, it) => s + it.lineTotal, 0);
    const total = subtotal;

    // paidAmount rules per status
    let paidAmount = 0;
    if (statusPick.status === "paid" || statusPick.status === "fulfilled") paidAmount = total;
    else if (statusPick.status === "pending")   paidAmount = Math.random() < 0.3 ? Math.round(total / 2) : 0;
    else if (statusPick.status === "cancelled") paidAmount = 0;

    const createdAt = pickCreatedAt(30);

    const order = await prisma.order.create({
      data: {
        customerName:  name,
        customerEmail: email,
        customerPhone: phone,
        house,
        status:        statusPick.status,
        source:        Math.random() < 0.35 ? "online" : "manual",
        paymentMethod: statusPick.status === "cancelled" ? null : paymentPick.method,
        paidAmount,
        subtotal,
        total,
        createdAt,
        updatedAt: createdAt,
        items: { create: items },
      },
    });
    created.push(order.id);
  }

  return NextResponse.json({
    ok: true,
    created: created.length,
    message: `Created ${created.length} fake order(s). Refresh the admin Store → Overview to see charts populate.`,
  });
}

// DELETE /api/seed-orders — wipes ALL orders (careful!)
export async function DELETE() {
  const result = await prisma.order.deleteMany({});
  return NextResponse.json({ ok: true, deleted: result.count });
}
