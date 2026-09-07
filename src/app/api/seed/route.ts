import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/seed — seeds the 4 default teams (run once)
export async function GET() {
  const teams = [
    { name: "MUTIEN", color: "white" },
    { name: "BENILDE", color: "black" },
    { name: "JAIME", color: "lime" },
    { name: "MIGUEL", color: "darkgreen" },
  ];

  for (const team of teams) {
    await prisma.team.upsert({
      where: { name: team.name },
      update: {},
      create: team,
    });
  }

  return NextResponse.json({ ok: true, message: "Teams seeded." });
}
