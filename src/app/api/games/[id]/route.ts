import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { computeStandings } from "@/lib/standings";

// PATCH /api/games/:id — rename / toggle active / update venue / update time
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const data: {
    name?: string;
    description?: string | null;
    venue?: string | null;
    startTime?: Date | null;
    isActive?: boolean;
  } = {};

  if (typeof body.name        === "string")  data.name        = body.name;
  if (typeof body.description === "string")  data.description = body.description || null;
  if (typeof body.venue       === "string")  data.venue       = body.venue || null;
  if (typeof body.isActive    === "boolean") data.isActive    = body.isActive;

  if ("startTime" in body) {
    data.startTime = body.startTime ? new Date(body.startTime) : null;
  }

  const game = await prisma.game.update({
    where: { id: Number(id) },
    data,
  });

  const standings = await computeStandings();
  await pusherServer.trigger("score-channel", "score-update", standings);

  return NextResponse.json(game);
}

// DELETE /api/games/:id — remove game and all its scores
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.score.deleteMany({ where: { gameId: Number(id) } });
  await prisma.game.delete({ where: { id: Number(id) } });

  const standings = await computeStandings();
  await pusherServer.trigger("score-channel", "score-update", standings);

  return NextResponse.json({ ok: true });
}
