import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { computeStandings } from "@/lib/standings";

// GET /api/games
export async function GET() {
  const games = await prisma.game.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(games);
}

// POST /api/games — create a game
export async function POST(req: NextRequest) {
  const { name, description, venue, startTime } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

  const game = await prisma.game.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      venue: venue?.trim() || null,
      startTime: startTime ? new Date(startTime) : null,
    },
  });

  const standings = await computeStandings();
  await pusherServer.trigger("score-channel", "score-update", standings);

  return NextResponse.json(game, { status: 201 });
}
