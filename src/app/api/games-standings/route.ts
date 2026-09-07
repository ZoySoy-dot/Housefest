import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSeed } from "@/lib/standings";

// GET /api/games-standings — every game with each team's W/L/PTS ranked
export async function GET() {
  await ensureSeed();

  const [games, teams] = await Promise.all([
    prisma.game.findMany({
      include: { scores: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.team.findMany({ orderBy: { id: "asc" } }),
  ]);

  const result = games.map((game) => {
    const rows = teams.map((team) => {
      const s = game.scores.find((x) => x.teamId === team.id);
      return {
        teamId:  team.id,
        name:    team.name,
        color:   team.color,
        wins:    s?.wins   ?? 0,
        losses:  s?.losses ?? 0,
        points:  s?.points ?? 0,
      };
    });

    // Rank teams within this game — same rules as overall
    rows.sort((a, b) =>
        b.wins   - a.wins
     || b.points - a.points
     || a.losses - b.losses
     || a.name.localeCompare(b.name)
    );

    const leader = rows[0];
    const hasAnyActivity = rows.some((r) => r.wins > 0 || r.losses > 0 || r.points > 0);

    return {
      id: game.id,
      name: game.name,
      description: game.description,
      venue: game.venue,
      startTime: game.startTime,
      isActive: game.isActive,
      leader: hasAnyActivity ? leader : null,
      rows,
    };
  });

  return NextResponse.json(result);
}
