// Standalone seed script. Uses raw SQL so it works even with a stale Prisma client.
// Run: node scripts/seed-orders.mjs [count]
// Requires DATABASE_URL in .env.

import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

// Tiny .env loader (no dotenv dep needed)
try {
  const raw = readFileSync(".env", "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/i);
    if (!m) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
} catch { /* .env optional */ }

const prisma = new PrismaClient();

const FIRST = ["Ana","Marco","Bea","Carlo","Denise","Enzo","Faye","Gio","Hana","Iggy","Jam","Kai","Lara","Miko","Nica","Oli","Paolo","Quin","Rica","Seb","Tin","Uno","Vince","Winnie","Xylie","Yza","Zeke","Alex","Bianca","Chad"];
const LAST = ["Reyes","Santos","Cruz","Garcia","Torres","Lim","Tan","Ong","Sy","Chua","Dela Cruz","Mendoza","Ramos","Gutierrez","Aquino","Villanueva","Bautista","Del Rosario","Fernandez","Concepcion","Pascual","Domingo","Salazar"];
const HOUSES = ["Mutien","Benilde","Jaime","Miguel"];

const STATUS_MIX = [
  { status: "paid",      weight: 55 },
  { status: "fulfilled", weight: 30 },
  { status: "pending",   weight: 10 },
  { status: "cancelled", weight: 5  },
];
const PAYMENT_MIX = [
  { method: "gcash", weight: 45 },
  { method: "cash",  weight: 30 },
  { method: "maya",  weight: 12 },
  { method: "card",  weight: 8  },
  { method: "bank",  weight: 5  },
];

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const pickWeighted = (arr) => {
  const total = arr.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const x of arr) { r -= x.weight; if (r <= 0) return x; }
  return arr[arr.length - 1];
};
const rint = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const slugEmail = (f, l, i) => `${f.toLowerCase().replace(/\s+/g,"")}.${l.toLowerCase().replace(/\s+/g,"")}${i}@dlsu.edu.ph`;
const fakePhone = () => {
  const n = String(rint(1000000, 9999999)).padStart(7, "0");
  return `+63 917 ${n.slice(0, 3)} ${n.slice(3)}`;
};
function pickCreatedAt(daysBack) {
  const skew = Math.pow(Math.random(), 2.4);
  const day = Math.floor(skew * daysBack);
  const d = new Date(Date.now() - day * 86400_000);
  d.setHours(rint(9, 21), rint(0, 59), rint(0, 59), 0);
  return d;
}

async function main() {
  const requested = Math.min(Math.max(Number(process.argv[2] ?? 60), 1), 300);
  const force = process.argv.includes("--force");

  // Count existing orders using raw SQL (avoids stale-type issues)
  const [{ count }] = await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "Order"`;
  if (count > 0 && !force) {
    console.log(`Skipping: ${count} order(s) already exist. Pass --force to seed anyway.`);
    await prisma.$disconnect();
    return;
  }

  const products = await prisma.$queryRaw`
    SELECT p.id, p.name, p."basePrice",
           COALESCE(
             (SELECT json_agg(json_build_object(
               'id', v.id, 'group', v."group", 'option', v.option, 'price', v.price, 'stock', v.stock
             )) FROM "ProductVariant" v WHERE v."productId" = p.id),
             '[]'
           )::text AS variants_json
    FROM "Product" p
  `;
  if (products.length === 0) {
    console.log("No products found. Seed products first via /api/seed-store.");
    await prisma.$disconnect();
    return;
  }

  // Parse variants JSON
  const productsWithVariants = products.map((p) => ({
    ...p,
    variants: JSON.parse(p.variants_json),
  }));

  let created = 0;
  for (let i = 0; i < requested; i++) {
    const first = pick(FIRST);
    const last = pick(LAST);
    const name = `${first} ${last}`;
    const email = Math.random() < 0.85 ? slugEmail(first, last, i) : null;
    const phone = Math.random() < 0.6 ? fakePhone() : null;
    const house = Math.random() < 0.9 ? pick(HOUSES) : null;
    const statusPick = pickWeighted(STATUS_MIX);
    const paymentPick = pickWeighted(PAYMENT_MIX);

    const itemCount = rint(1, 4);
    const chosen = new Set();
    const items = [];
    for (let j = 0; j < itemCount; j++) {
      const p = pick(productsWithVariants);
      let unitPrice = p.basePrice;
      let variantLabel = null;
      let variantId = null;
      if (p.variants.length > 0) {
        const v = pick(p.variants);
        unitPrice = v.price;
        variantLabel = `${v.group} · ${v.option}`;
        variantId = v.id;
      }
      const key = `${p.id}::${variantId ?? "base"}`;
      if (chosen.has(key)) continue;
      chosen.add(key);
      const qty = rint(1, 3);
      items.push({ productId: p.id, variantId, productName: p.name, variantLabel, unitPrice, qty, lineTotal: unitPrice * qty });
    }
    if (items.length === 0) continue;

    const subtotal = items.reduce((s, it) => s + it.lineTotal, 0);
    const total = subtotal;
    let paidAmount = 0;
    if (statusPick.status === "paid" || statusPick.status === "fulfilled") paidAmount = total;
    else if (statusPick.status === "pending") paidAmount = Math.random() < 0.3 ? Math.round(total / 2) : 0;
    else if (statusPick.status === "cancelled") paidAmount = 0;

    const createdAt = pickCreatedAt(30);
    const source = Math.random() < 0.35 ? "online" : "manual";
    const paymentMethod = statusPick.status === "cancelled" ? null : paymentPick.method;

    const [{ id: orderId }] = await prisma.$queryRaw`
      INSERT INTO "Order" (
        "customerName", "customerEmail", "customerPhone", "house",
        "status", "source", "paymentMethod", "paidAmount",
        "subtotal", "total", "createdAt", "updatedAt"
      ) VALUES (
        ${name}, ${email}, ${phone}, ${house},
        ${statusPick.status}::"OrderStatus", ${source}::"OrderSource",
        ${paymentMethod}::"PaymentMethod", ${paidAmount},
        ${subtotal}, ${total}, ${createdAt}, ${createdAt}
      )
      RETURNING id
    `;

    for (const it of items) {
      await prisma.$executeRaw`
        INSERT INTO "OrderItem" (
          "orderId", "productId", "variantId", "productName", "variantLabel",
          "unitPrice", "qty", "lineTotal"
        ) VALUES (
          ${orderId}, ${it.productId}, ${it.variantId}, ${it.productName}, ${it.variantLabel},
          ${it.unitPrice}, ${it.qty}, ${it.lineTotal}
        )
      `;
    }
    created++;
  }

  console.log(`Created ${created} order(s).`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
