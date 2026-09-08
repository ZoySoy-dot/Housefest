"use client";

import { useEffect, useRef, useState } from "react";
import Pusher from "pusher-js";

type Standing = {
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

type GameRow = {
  teamId: number;
  name: string;
  color: string;
  wins: number;
  losses: number;
  points: number;
};

type GameStanding = {
  id: number;
  name: string;
  description: string | null;
  venue: string | null;
  startTime: string | null;
  isActive: boolean;
  leader: GameRow | null;
  rows: GameRow[];
};

const TEAM = {
  white:     { primary: "#ffffff", text: "#000000", glow: "rgba(255,255,255,0.25)" },
  black:     { primary: "#1a1a1a", text: "#ffffff", glow: "rgba(0,255,170,0.2)"   },
  lime:      { primary: "#00cc44", text: "#000000", glow: "rgba(0,204,68,0.3)"    },
  darkgreen: { primary: "#00701f", text: "#ffffff", glow: "rgba(0,255,102,0.25)"  },
} as const;

const MEDAL_COLOR = ["#FFD700", "#C0C0C0", "#CD7F32", "#888888"];

const TEAM_BANNER: Record<string, string> = {
  MUTIEN:  "/banners/Mutien.jpeg",
  BENILDE: "/banners/Benilde.jpeg",
  JAIME:   "/banners/Jaime.png",
  MIGUEL:  "/banners/Miguel.jpeg",
};

function useLiveData() {
  const [teams, setTeams] = useState<Standing[]>([]);
  const [games, setGames] = useState<GameStanding[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [conn, setConn] = useState<"live" | "connecting" | "offline">("connecting");
  const [updated, setUpdated] = useState("");

  useEffect(() => {
    const refresh = async () => {
      try {
        const [s, g]: [Standing[], GameStanding[]] = await Promise.all([
          fetch("/api/scores").then((r) => r.json()),
          fetch("/api/games-standings").then((r) => r.json()),
        ]);
        setTeams(s);
        setGames(g);
        setLoaded(true);
        setConn("live");
        setUpdated(ts());
      } catch {
        setConn("offline");
        setLoaded(true);
      }
    };
    refresh();

    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });
    const ch = pusher.subscribe("score-channel");
    ch.bind("score-update", (d: Standing[]) => {
      setTeams(d);
      setConn("live");
      setUpdated(ts());
      // Also refresh per-game standings whenever anything changes
      fetch("/api/games-standings").then((r) => r.json()).then(setGames).catch(() => {});
    });
    pusher.connection.bind("connected",    () => setConn("live"));
    pusher.connection.bind("disconnected", () => setConn("offline"));

    return () => { ch.unbind_all(); pusher.disconnect(); };
  }, []);

  return { teams, games, loaded, conn, updated };
}

function ts() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/* Animated integer counter */
function AnimatedNum({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const ref = useRef(value);

  useEffect(() => {
    const from = ref.current;
    const to = value;
    if (from === to) return;
    const dur = 500;
    const start = performance.now();

    function step(now: number) {
      const t = Math.min((now - start) / dur, 1);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) requestAnimationFrame(step);
      else { setDisplay(to); ref.current = to; }
    }
    requestAnimationFrame(step);
  }, [value]);

  return <>{display}</>;
}

export default function Scoreboard() {
  const { teams, games, loaded } = useLiveData();
  const leader = teams[0];
  const maxWins = teams.reduce((m, t) => Math.max(m, t.wins), 0) || 1;

  return (
    <div style={S.root}>
      {/* ═══ HEADER ═══ */}
      <header style={S.header} className="hf-header">
        <img src="/DLSUBackground.jpg" alt="" aria-hidden style={S.headerBg} />
        <div style={S.headerScrim} />

        {/* LEFT — SC brand */}
        <div style={S.headerBrand} className="hf-header-brand">
          <img src="/SC_Logo.svg" alt="SC" style={S.brandLogo} className="hf-header-logo" />
          <div style={S.brandText} className="hf-header-brand-text">
            <span style={S.brandLine1}>STUDENT</span>
            <span style={S.brandLine2}>COUNCIL</span>
          </div>
        </div>

        {/* CENTER — event title */}
        <div style={S.headerCenter} className="hf-header-center">
          <div style={S.eventBadge} className="hf-header-badge">A.Y. 2026–2027</div>
          <h1 style={S.eventTitle} className="hf-header-title">HOUSEFEST</h1>
        </div>

        {/* RIGHT — store link */}
        <div style={S.headerActions}>
          <a href="/store" style={S.storeLink} className="hf-header-store">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 01-8 0"/>
            </svg>
            Shop merch
          </a>
        </div>
      </header>

      {/* ═══ LEADER HERO ═══ */}
      {leader && (() => {
        const banner = TEAM_BANNER[leader.name];
        return (
          <div style={{ ...S.hero, color: "#fff" }}>
            {banner && (
              <img
                src={banner}
                alt=""
                aria-hidden
                style={S.heroBanner}
              />
            )}
            {/* dark scrim so text stays readable */}
            <div style={{
              ...S.heroScrim,
              background: `linear-gradient(90deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.75) 100%)`,
            }} />
            <div style={{ ...S.heroLeft, position: "relative", zIndex: 2 }}>
              <div style={S.heroPlacement}>
                <span style={S.heroPlacementOrd}>{leader.placement}</span>
              </div>
              <div style={S.heroTeamName}>{leader.name}</div>
            </div>

            <div style={{ ...S.heroRight, position: "relative", zIndex: 2 }}>
              <div style={S.heroRecord}>
                <span style={S.heroPointsPrimary}>
                  <AnimatedNum value={leader.points} />
                </span>
                <span style={{ ...S.heroRecordLabel, opacity: 0.7 }}>POINTS</span>
              </div>
              <div style={S.heroWLBox}>
                <span style={S.heroWLSecondary}>
                  <AnimatedNum value={leader.wins} />
                  <span style={S.heroDashSmall}>–</span>
                  <AnimatedNum value={leader.losses} />
                </span>
                <span style={{ ...S.heroWLLabel, opacity: 0.7 }}>W – L</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══ STANDINGS ═══ */}
      <main style={S.main}>
        <div style={S.standingsHeader}>
          <span style={S.standingsLabel}>OVERALL STANDINGS</span>
          <span style={S.standingsCount}>{teams.length} TEAMS</span>
        </div>

        <div style={S.rows}>
          {teams.slice(1).map((team, idx) => {
            const i = idx + 1;
            const pct = (team.wins / maxWins) * 100;
            const isFirst = i === 0 && team.wins > 0;
            const banner = TEAM_BANNER[team.name];

            return (
              <div
                key={team.id}
                style={{
                  ...S.row,
                  ...(isFirst ? S.rowFirst : {}),
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {banner && (
                  <>
                    <img
                      src={banner}
                      alt=""
                      aria-hidden
                      style={{
                        ...S.rowBanner,
                        opacity: isFirst ? 0.6 : 0.32,
                      }}
                    />
                    <div style={{
                      ...S.rowBannerScrim,
                      background: isFirst
                        ? "linear-gradient(90deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.65) 100%)"
                        : "linear-gradient(90deg, rgba(10,10,10,0.88) 0%, rgba(10,10,10,0.62) 50%, rgba(10,10,10,0.85) 100%)",
                    }} />
                  </>
                )}
                {/* rank */}
                <div style={S.rankBox}>
                  <span style={{ ...S.rankOrd, color: MEDAL_COLOR[i] ?? "#666" }}>
                    {team.placement}
                  </span>
                </div>

                {/* team */}
                <div style={S.teamBox}>
                  <div style={S.teamInfo}>
                    <span style={S.teamName}>{team.name}</span>
                    <span style={S.teamSub}>
                      {team.gamesPlayed} {team.gamesPlayed === 1 ? "GAME" : "GAMES"}
                    </span>
                  </div>
                  {isFirst && <span style={S.crownBadge}>👑 LEADING</span>}
                </div>

                {/* progress bar */}
                <div style={S.barBox}>
                  <div style={S.barTrack}>
                    <div style={{
                      ...S.barFill,
                      width: `${pct}%`,
                      background: "#555",
                    }} />
                  </div>
                  <span style={S.barPct}>
                    {team.gamesPlayed > 0 ? `${(team.winPct * 100).toFixed(0)}%` : "—"}
                  </span>
                </div>

                {/* W-L record */}
                <div style={S.recordBox}>
                  <span style={S.recordText}>
                    <AnimatedNum value={team.wins} />
                    <span style={S.recordDash}>–</span>
                    <AnimatedNum value={team.losses} />
                  </span>
                  <span style={S.recordLabel}>W – L</span>
                </div>

                {/* points */}
                <div style={S.scoreBox}>
                  <span style={S.scoreNum}><AnimatedNum value={team.points} /></span>
                  <span style={S.scoreSub}>PTS</span>
                </div>
              </div>
            );
          })}

          {loaded && teams.length === 0 && (
            <div style={S.empty}>
              <div style={S.emptyIcon}>⚠</div>
              <div style={S.emptyTitle}>No teams found</div>
              <div style={S.emptySub}>
                Visit <a href="/admin" style={{ color: "#00ff88" }}>/admin</a> to set up.
              </div>
            </div>
          )}

          {!loaded && (
            <div style={S.empty}>
              <div style={S.spinner} />
              <span>Loading...</span>
            </div>
          )}
        </div>

        {/* ═══ GAMES SECTION ═══ */}
        {games.length > 0 && (
          <>
            <div style={{ ...S.standingsHeader, marginTop: "2rem" }}>
              <span style={S.standingsLabel}>GAMES</span>
              <span style={S.standingsCount}>{games.length} {games.length === 1 ? "EVENT" : "EVENTS"}</span>
            </div>

            <div style={S.gamesGrid}>
              {games.map((game) => {
                const leaderCfg = game.leader
                  ? TEAM[game.leader.color as keyof typeof TEAM] ?? TEAM.white
                  : null;

                return (
                  <div key={game.id} style={S.gameCard}>
                    {/* header strip */}
                    <div style={{
                      ...S.gameCardHeader,
                      background: leaderCfg
                        ? `linear-gradient(135deg, ${leaderCfg.primary} 0%, ${adjustBrightness(leaderCfg.primary, -25)} 100%)`
                        : "#1a1a1a",
                      color: leaderCfg?.text ?? "#666",
                    }}>
                      <div style={S.gameCardTitleRow}>
                        <span style={S.gameCardTitle}>{game.name}</span>
                        {!game.isActive && <span style={S.pausedTag}>PAUSED</span>}
                      </div>

                      {(game.venue || game.startTime) && (
                        <div style={{ ...S.gameMetaRow, color: leaderCfg?.text ?? "#888", opacity: 0.75 }}>
                          {game.venue && (
                            <span style={S.gameMetaItem}>
                              <span style={S.gameMetaIcon}>📍</span>
                              {game.venue}
                            </span>
                          )}
                          {game.startTime && (
                            <span style={S.gameMetaItem}>
                              <span style={S.gameMetaIcon}>🕒</span>
                              {formatGameTime(game.startTime)}
                            </span>
                          )}
                        </div>
                      )}
                      {game.leader ? (
                        <>
                          <div style={{ ...S.gameLeaderLabel, opacity: 0.65 }}>LEADING</div>
                          <div style={S.gameLeaderName}>{game.leader.name}</div>
                          <div style={S.gameLeaderStats}>
                            <span style={S.gameLeaderStat}>
                              <AnimatedNum value={game.leader.wins} />
                              <span style={{ opacity: 0.5, margin: "0 3px" }}>–</span>
                              <AnimatedNum value={game.leader.losses} />
                              <span style={{ ...S.gameLeaderStatLabel, opacity: 0.6 }}>W-L</span>
                            </span>
                            <span style={S.gameLeaderStat}>
                              <AnimatedNum value={game.leader.points} />
                              <span style={{ ...S.gameLeaderStatLabel, opacity: 0.6 }}>PTS</span>
                            </span>
                          </div>
                        </>
                      ) : (
                        <div style={{ ...S.gameLeaderLabel, opacity: 0.5, paddingTop: 8 }}>
                          NO RESULTS YET
                        </div>
                      )}
                    </div>

                    {/* per-team rows */}
                    <div style={S.gameRows}>
                      {game.rows.map((r, i) => {
                        const cfg = TEAM[r.color as keyof typeof TEAM] ?? TEAM.white;
                        const isLeader = game.leader?.teamId === r.teamId && (r.wins > 0 || r.losses > 0 || r.points > 0);
                        return (
                          <div key={r.teamId} style={{
                            ...S.gameRow,
                            background: isLeader ? "#141200" : "transparent",
                          }}>
                            <span style={S.gameRowRank}>{i + 1}</span>
                            <div style={{ ...S.gameRowDot, background: cfg.primary }} />
                            <span style={S.gameRowName}>{r.name}</span>
                            <span style={S.gameRowRecord}>
                              {r.wins}<span style={{ color: "#444" }}>–</span>{r.losses}
                            </span>
                            <span style={S.gameRowPts}>{r.points}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

      </main>

      <style>{`
        @keyframes hfPulse { 0%,100% { opacity: 1 } 50% { opacity: 0.25 } }
        @keyframes hfSpin  { to { transform: rotate(360deg) } }
        a[href="/store"]:hover {
          background: #171b21 !important;
          border-color: #3a414b !important;
          color: #ffffff !important;
        }

        /* Mobile header: relax the grid, shrink chrome */
        @media (max-width: 720px) {
          .hf-header {
            grid-template-columns: auto 1fr auto !important;
            padding: 0.6rem 0.75rem !important;
            gap: 10px;
          }
          .hf-header-logo {
            width: 40px !important;
            height: 40px !important;
          }
          .hf-header-brand-text { display: none !important; }
          .hf-header-badge {
            font-size: 0.5rem !important;
            padding: 2px 8px !important;
          }
          .hf-header-title {
            font-size: 1.35rem !important;
            letter-spacing: 0.05em !important;
          }
          .hf-header-sub {
            font-size: 0.5rem !important;
          }
          .hf-header-store {
            font-size: 0.75rem !important;
            padding: 7px 10px !important;
          }
          .hf-header-store svg { width: 12px; height: 12px; }
        }

        @media (max-width: 400px) {
          .hf-header-sub { display: none !important; }
          .hf-header-title { font-size: 1.15rem !important; }
        }
      `}</style>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "#080808",
    color: "#fff",
    fontFamily: "'Arial Black', Arial, sans-serif",
  },

  /* header */
  header: {
    position: "sticky",
    top: 0,
    zIndex: 50,
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    padding: "0.9rem clamp(1rem, 3vw, 2rem)",
    background: "#0a0a0a",
    color: "#fff",
    borderBottom: "3px solid #00ff88",
    overflow: "hidden",
    isolation: "isolate",
  },
  headerBg: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    opacity: 0.15,
    zIndex: -2,
    pointerEvents: "none",
  },
  headerScrim: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(10,10,10,0.85) 100%)",
    zIndex: -1,
    pointerEvents: "none",
  },

  /* LEFT — SC brand */
  headerBrand: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },
  brandLogo: {
    width: 52,
    height: 52,
    objectFit: "contain",
    flexShrink: 0,
  },
  brandText: {
    display: "flex",
    flexDirection: "column",
    lineHeight: 1,
    gap: 1,
  },
  brandLine1: {
    fontSize: "0.62rem",
    fontWeight: 800,
    letterSpacing: "0.1em",
    color: "#aaa",
  },
  brandLine2: {
    fontSize: "0.78rem",
    fontWeight: 800,
    letterSpacing: "0.1em",
    color: "#fff",
  },

  /* CENTER — event title */
  headerCenter: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  },
  eventBadge: {
    fontSize: "0.55rem",
    fontWeight: 800,
    letterSpacing: "0.12em",
    background: "#00ff88",
    color: "#000",
    padding: "3px 10px",
    borderRadius: 2,
    clipPath: "polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)",
  },
  eventTitle: {
    fontFamily: "var(--font-display)",
    fontSize: "clamp(1.8rem, 5.5vw, 3.2rem)",
    fontWeight: 400,
    letterSpacing: "0.08em",
    margin: 0,
    lineHeight: 1,
    color: "#fff",
  },
  eventSub: {
    fontSize: "0.58rem",
    fontWeight: 700,
    letterSpacing: "0.1em",
    color: "#888",
  },

  /* RIGHT — live + admin */
  headerActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
  },
  storeLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontFamily: "var(--font-body)",
    fontSize: "0.82rem",
    fontWeight: 600,
    letterSpacing: "0.02em",
    color: "#e6e8eb",
    textDecoration: "none",
    padding: "9px 14px",
    border: "1px solid #2b3038",
    borderRadius: 6,
    background: "rgba(255, 255, 255, 0.03)",
    transition: "background 0.12s, border-color 0.12s, color 0.12s",
  },
  /* ticker */
  ticker: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "6px 1.2rem",
    background: "#0d0d0d", borderBottom: "1px solid #1a1a1a",
    fontSize: "0.7rem", letterSpacing: 1,
    overflowX: "auto", whiteSpace: "nowrap",
  },
  dot: { width: 7, height: 7, borderRadius: "50%", flexShrink: 0 },
  tickerStatus: { fontWeight: 900, fontSize: "0.7rem" },
  tickerTime: { color: "#444", fontSize: "0.65rem" },
  tickerSep: { color: "#222", padding: "0 4px" },
  tickerEntry: { display: "flex", alignItems: "center", gap: 5, color: "#888" },
  tickerDot: { width: 7, height: 7, borderRadius: "50%", flexShrink: 0 },

  /* hero */
  hero: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    overflow: "hidden",
    padding: "clamp(2rem,6vw,4rem) clamp(1.5rem,6vw,4rem)",
    minHeight: "clamp(280px, 40vh, 460px)",
    borderBottom: "4px solid #000",
    gap: "1rem",
    flexWrap: "wrap",
  },
  heroLeft:  { display: "flex", flexDirection: "column", gap: 6, position: "relative", zIndex: 1 },
  heroRight: {
    display: "flex", flexDirection: "column", alignItems: "flex-end",
    position: "relative", zIndex: 1, gap: 8,
  },
  heroChip: {
    display: "inline-flex", alignItems: "center",
    borderLeft: "3px solid",
    padding: "3px 10px", fontSize: "0.6rem",
    fontWeight: 800, letterSpacing: "0.1em", alignSelf: "flex-start",
    background: "rgba(255,255,255,0.06)",
  },
  heroTeamName: {
    fontFamily: "var(--font-display)",
    fontSize: "clamp(3rem, 10vw, 6.5rem)",
    fontWeight: 400,
    letterSpacing: "0.04em",
    lineHeight: 0.95,
    textTransform: "uppercase",
  },
  heroPlacement: {
    display: "inline-flex",
    alignItems: "baseline",
    gap: 8,
    padding: "5px 12px",
    background: "rgba(255, 215, 0, 0.12)",
    border: "1px solid rgba(255, 215, 0, 0.55)",
    borderLeft: "3px solid #FFD700",
    borderRadius: 2,
    color: "#FFD700",
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  heroPlacementOrd: {
    fontFamily: "var(--font-body)",
    fontSize: "0.95rem",
    fontWeight: 800,
    letterSpacing: "0.05em",
    lineHeight: 1,
  },
  heroPlacementLabel: {
    fontSize: "0.6rem",
    fontWeight: 700,
    letterSpacing: "0.14em",
    color: "rgba(255, 215, 0, 0.75)",
    lineHeight: 1,
  },
  heroHouse: { fontSize: "0.8rem", fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase" },
  heroRecord: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 },
  heroPointsPrimary: {
    fontFamily: "var(--font-body)",
    fontSize: "clamp(3.5rem, 9vw, 6rem)",
    fontWeight: 800,
    lineHeight: 1,
    letterSpacing: "-0.03em",
    fontVariantNumeric: "tabular-nums",
    display: "flex", alignItems: "baseline",
  },
  heroRecordLabel: {
    fontSize: "0.65rem",
    fontWeight: 700,
    letterSpacing: "0.14em",
    fontFamily: "var(--font-body)",
    marginTop: 2,
  },
  heroWLBox: {
    display: "flex", flexDirection: "column", alignItems: "flex-end",
    gap: 2,
    borderTop: "1px solid",
    borderColor: "currentColor",
    paddingTop: 6,
    marginTop: 6,
    opacity: 0.85,
  },
  heroWLSecondary: {
    fontFamily: "var(--font-body)",
    fontSize: "clamp(1.1rem, 2.4vw, 1.5rem)",
    fontWeight: 600,
    lineHeight: 1,
    letterSpacing: "-0.01em",
    fontVariantNumeric: "tabular-nums",
    display: "flex", alignItems: "baseline",
  },
  heroDashSmall: { padding: "0 3px", opacity: 0.5, fontWeight: 400 },
  heroWLLabel: {
    fontSize: "0.55rem",
    fontWeight: 700,
    letterSpacing: "0.12em",
    fontFamily: "var(--font-body)",
  },
  heroBanner: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center",
    zIndex: 0,
    pointerEvents: "none",
  },
  heroScrim: {
    position: "absolute",
    inset: 0,
    zIndex: 1,
    pointerEvents: "none",
  },
  rowBanner: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center",
    zIndex: 0,
    pointerEvents: "none",
    opacity: 0.55,
  },
  rowBannerScrim: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(90deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0.75) 100%)",
    zIndex: 0,
    pointerEvents: "none",
  },

  /* main */
  main: {
    flex: 1,
    display: "flex", flexDirection: "column",
    padding: "clamp(1rem,3vw,2rem) clamp(1rem,5vw,2.5rem)",
    gap: "1rem",
  },
  standingsHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  standingsLabel: { fontSize: "0.65rem", fontWeight: 800, letterSpacing: "0.15em", color: "#444", textTransform: "uppercase" },
  standingsCount: { fontSize: "0.65rem", fontWeight: 800, letterSpacing: "0.1em", color: "#333" },

  /* rows */
  rows: { display: "flex", flexDirection: "column", gap: 10 },

  row: {
    display: "grid",
    gridTemplateColumns: "56px minmax(160px, 1fr) 1fr auto auto",
    alignItems: "center",
    gap: 14,
    padding: "20px 22px",
    minHeight: 96,
    background: "#111",
    borderRadius: 14,
    border: "1px solid #1e1e1e",
    transition: "border-color 0.3s",
  },
  rowFirst: {
    background: "#000",
    border: "1px solid #FFD70055",
  },

  rankBox: { display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1 },
  rankOrd: { fontSize: "0.75rem", fontWeight: 800, letterSpacing: "0.05em" },

  teamBox: { display: "flex", alignItems: "center", gap: 10, minWidth: 0, position: "relative", zIndex: 1 },
  teamSwatch: { width: 18, height: 18, borderRadius: "50%", flexShrink: 0, border: "2px solid #333" },
  teamInfo: { display: "flex", flexDirection: "column", gap: 1, minWidth: 0 },
  teamName: {
    fontFamily: "var(--font-display)",
    fontSize: "clamp(1.1rem, 2.8vw, 1.35rem)",
    fontWeight: 400,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    lineHeight: 1,
  },
  teamSub: { fontSize: "0.55rem", fontWeight: 600, letterSpacing: "0.12em", color: "#555", textTransform: "uppercase" },
  crownBadge: {
    background: "#2a2000", color: "#FFD700",
    borderLeft: "3px solid #FFD700",
    padding: "3px 8px",
    fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.08em",
    whiteSpace: "nowrap", flexShrink: 0,
  },

  barBox: { display: "flex", alignItems: "center", gap: 8, minWidth: 0, position: "relative", zIndex: 1 },
  barTrack: { flex: 1, background: "#1a1a1a", borderRadius: 4, height: 8, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 4, transition: "width 0.7s ease", minWidth: 0 },
  barPct: { fontSize: "0.6rem", fontWeight: 700, color: "#555", flexShrink: 0, minWidth: 28, textAlign: "right" },

  recordBox: {
    display: "flex", flexDirection: "column", alignItems: "flex-end",
    gap: 4, position: "relative", zIndex: 1,
    minWidth: 62,
  },
  recordText: {
    fontFamily: "var(--font-body)",
    fontSize: "clamp(0.95rem, 1.9vw, 1.15rem)",
    fontWeight: 600,
    lineHeight: 1,
    letterSpacing: "-0.01em",
    fontVariantNumeric: "tabular-nums",
    display: "inline-flex", alignItems: "baseline", gap: 1,
    height: "1em",
  },
  recordDash: { padding: "0 3px", color: "#555", fontWeight: 400 },
  recordLabel: {
    fontSize: "0.5rem",
    fontWeight: 600,
    letterSpacing: "0.1em",
    color: "#555",
    fontFamily: "var(--font-body)",
    lineHeight: 1,
  },

  scoreBox: {
    display: "flex", flexDirection: "column", alignItems: "flex-end",
    gap: 4, position: "relative", zIndex: 1,
    minWidth: 40,
  },
  scoreNum: {
    fontFamily: "var(--font-body)",
    fontSize: "clamp(0.95rem, 1.9vw, 1.15rem)",
    fontWeight: 600,
    lineHeight: 1,
    letterSpacing: "-0.01em",
    fontVariantNumeric: "tabular-nums",
    color: "#00ff88",
    display: "inline-flex",
    alignItems: "baseline",
    height: "1em",
  },
  scoreSub: {
    fontSize: "0.5rem",
    fontWeight: 600,
    letterSpacing: "0.1em",
    color: "#3a5a4a",
    fontFamily: "var(--font-body)",
    lineHeight: 1,
  },

  empty: {
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    gap: 8, padding: "3rem", color: "#333", fontSize: "0.9rem",
  },
  emptyIcon: { fontSize: "2rem", opacity: 0.5 },
  emptyTitle: { fontSize: "1rem", fontWeight: 900, letterSpacing: 1, color: "#555" },
  emptySub: { fontSize: "0.75rem", color: "#444" },
  spinner: {
    width: 28, height: 28, borderRadius: "50%",
    border: "2px solid #1e1e1e", borderTopColor: "#444",
    animation: "hfSpin 0.8s linear infinite",
  },
  /* ── GAMES SECTION ── */
  gamesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: 14,
  },
  gameCard: {
    background: "#111",
    border: "1px solid #1e1e1e",
    borderRadius: 14,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    transition: "transform 0.2s ease, border-color 0.2s ease",
  },
  gameCardHeader: {
    padding: "1rem 1.2rem 1.1rem",
    display: "flex",
    flexDirection: "column",
    gap: 3,
    position: "relative",
  },
  gameCardTitleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  gameMetaRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 10,
    fontSize: "0.68rem",
    fontWeight: 700,
    letterSpacing: 0.5,
  },
  gameMetaItem: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    whiteSpace: "nowrap",
  },
  gameMetaIcon: {
    fontSize: "0.75rem",
    filter: "grayscale(0.2)",
  },
  gameCardTitle: {
    fontSize: "0.85rem",
    fontWeight: 900,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  pausedTag: {
    fontSize: "0.5rem",
    fontWeight: 900,
    letterSpacing: 1.5,
    padding: "2px 6px",
    border: "1px solid currentColor",
    borderRadius: 3,
    opacity: 0.65,
  },
  gameLeaderLabel: {
    fontSize: "0.55rem",
    fontWeight: 900,
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  gameLeaderName: {
    fontSize: "clamp(1.4rem, 3.5vw, 1.9rem)",
    fontWeight: 900,
    letterSpacing: 2,
    lineHeight: 1,
    textTransform: "uppercase",
    marginTop: 2,
    marginBottom: 6,
  },
  gameLeaderStats: {
    display: "flex",
    gap: 14,
    alignItems: "baseline",
  },
  gameLeaderStat: {
    fontSize: "1.15rem",
    fontWeight: 900,
    lineHeight: 1,
    display: "flex",
    alignItems: "baseline",
    gap: 4,
  },
  gameLeaderStatLabel: {
    fontSize: "0.55rem",
    fontWeight: 900,
    letterSpacing: 2,
    marginLeft: 3,
  },

  gameRows: {
    display: "flex",
    flexDirection: "column",
  },
  gameRow: {
    display: "grid",
    gridTemplateColumns: "20px 10px 1fr auto auto",
    alignItems: "center",
    gap: 10,
    padding: "9px 1.2rem",
    borderTop: "1px solid #1a1a1a",
  },
  gameRowRank: {
    fontSize: "0.65rem",
    fontWeight: 900,
    color: "#444",
    textAlign: "center",
  },
  gameRowDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    border: "1.5px solid #2a2a2a",
    flexShrink: 0,
  },
  gameRowName: {
    fontSize: "0.75rem",
    fontWeight: 900,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#ddd",
  },
  gameRowRecord: {
    fontSize: "0.8rem",
    fontWeight: 900,
    color: "#fff",
    minWidth: 44,
    textAlign: "right",
  },
  gameRowPts: {
    fontSize: "0.8rem",
    fontWeight: 900,
    color: "#00ff88",
    minWidth: 32,
    textAlign: "right",
  },
};

function formatGameTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function adjustBrightness(hex: string, amount: number) {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amount));
  const b = Math.max(0, Math.min(255, (num & 0x0000ff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
