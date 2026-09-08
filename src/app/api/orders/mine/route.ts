import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const orders = await prisma.order.findMany({
    where: {
      source: "online",
      customerEmail: { equals: email, mode: "insensitive" },
    },
    orderBy: { createdAt: "desc" },
    include: { items: true },
    take: 100,
  });

  return NextResponse.json(orders);
}
