import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { computeStandings } from "@/lib/standings";

// GET /api/scores — always returns current standings (auto-seeds teams if empty)
export async function GET() {
  const standings = await computeStandings();
  return NextResponse.json(standings);
}

// POST /api/scores — update wins/losses/points for a team+game
export async function POST(req: NextRequest) {
  const { teamId, gameId, wins, losses, points } = await req.json();

  if (!teamId || !gameId) {
    return NextResponse.json({ error: "teamId and gameId required" }, { status: 400 });
  }

  const data: { wins?: number; losses?: number; points?: number } = {};
  if (typeof wins   === "number") data.wins   = Math.max(0, wins);
  if (typeof losses === "number") data.losses = Math.max(0, losses);
  if (typeof points === "number") data.points = Math.max(0, points);

  await prisma.score.upsert({
    where:  { teamId_gameId: { teamId, gameId } },
    update: data,
    create: { teamId, gameId, ...data },
  });

  const standings = await computeStandings();
  await pusherServer.trigger("score-channel", "score-update", standings);

  return NextResponse.json({ ok: true, standings });
}
