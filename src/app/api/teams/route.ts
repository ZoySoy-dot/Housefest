import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSeed } from "@/lib/standings";

// GET /api/teams — teams with their per-game scores
export async function GET() {
  await ensureSeed();
  const teams = await prisma.team.findMany({
    include: {
      scores: {
        include: { game: true },
      },
    },
    orderBy: { id: "asc" },
  });
  return NextResponse.json(teams);
}
