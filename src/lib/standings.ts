import { prisma } from "./prisma";

const DEFAULT_TEAMS = [
  { name: "MUTIEN",  color: "white"     },
  { name: "BENILDE", color: "black"     },
  { name: "JAIME",   color: "lime"      },
  { name: "MIGUEL",  color: "darkgreen" },
];

const PLACEMENTS = ["1ST", "2ND", "3RD", "4TH", "5TH", "6TH", "7TH", "8TH"];

export type Standing = {
  id: number;
  name: string;
  color: string;
  wins: number;
  losses: number;
  points: number;
  gamesPlayed: number;
  winPct: number;
  placement: string;
};

// Ensures the 4 default teams exist. Idempotent.
export async function ensureSeed() {
  const count = await prisma.team.count();
  if (count === 0) {
    for (const t of DEFAULT_TEAMS) {
      await prisma.team.upsert({ where: { name: t.name }, update: {}, create: t });
    }
  }
}

/**
 * Ranking rules (in order):
 *   1. Total wins (desc)
 *   2. Win % (desc)   — tiebreak
 *   3. Points (desc)  — tiebreak
 *   4. Fewer losses (asc)
 *   5. Team name (asc)  — stable
 */
export async function computeStandings(): Promise<Standing[]> {
  await ensureSeed();

  const teams = await prisma.team.findMany({
    include: { scores: true },
    orderBy: { id: "asc" },
  });

  const rows: Omit<Standing, "placement">[] = teams.map((t) => {
    const wins   = t.scores.reduce((s, sc) => s + sc.wins,   0);
    const losses = t.scores.reduce((s, sc) => s + sc.losses, 0);
    const points = t.scores.reduce((s, sc) => s + sc.points, 0);
    const played = wins + losses;
    return {
      id: t.id,
      name: t.name,
      color: t.color,
      wins, losses, points,
      gamesPlayed: played,
      winPct: played > 0 ? wins / played : 0,
    };
  });

  rows.sort((a, b) =>
      b.wins   - a.wins
   || b.winPct - a.winPct
   || b.points - a.points
   || a.losses - b.losses
   || a.name.localeCompare(b.name)
  );

  return rows.map((r, i) => ({ ...r, placement: PLACEMENTS[i] ?? `${i + 1}TH` }));
}
