"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./AdminPanel.module.css";

type ScoreEntry = {
  id: number;
  gameId: number;
  teamId: number;
  wins: number;
  losses: number;
  points: number;
  game: { id: number; name: string };
};

type Team = {
  id: number;
  name: string;
  color: string;
  scores: ScoreEntry[];
};

type Game = {
  id: number;
  name: string;
  description?: string | null;
  venue?: string | null;
  startTime?: string | null;
  isActive: boolean;
};

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

type Field = "wins" | "losses" | "points";

const K = (teamId: number, gameId: number, field: Field) => `${teamId}_${gameId}_${field}`;

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString([], {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

export default function ScoreboardAdmin({
  onToast,
}: {
  onToast: (m: string, isError?: boolean) => void;
}) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);

  const [inputs, setInputs] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [savedFlash, setSavedFlash] = useState<Record<string, boolean>>({});

  const [newGame, setNewGame] = useState({ name: "", venue: "", startTime: "" });
  const [editingGameId, setEditingGameId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<{ name: string; venue: string; startTime: string }>({
    name: "", venue: "", startTime: "",
  });

  const loadAll = useCallback(async () => {
    const [t, g, s]: [Team[], Game[], Standing[]] = await Promise.all([
      fetch("/api/teams").then((r) => r.json()),
      fetch("/api/games").then((r) => r.json()),
      fetch("/api/scores").then((r) => r.json()),
    ]);
    setTeams(t);
    setGames(g);
    setStandings(s);

    const map: Record<string, number> = {};
    for (const team of t) {
      for (const sc of team.scores) {
        map[K(team.id, sc.gameId, "wins")]   = sc.wins;
        map[K(team.id, sc.gameId, "losses")] = sc.losses;
        map[K(team.id, sc.gameId, "points")] = sc.points;
      }
    }
    setInputs(map);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function addGame() {
    if (!newGame.name.trim()) return;
    const res = await fetch("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newGame.name,
        venue: newGame.venue,
        startTime: newGame.startTime || null,
      }),
    });
    if (!res.ok) return onToast("Failed to add game.", true);
    setNewGame({ name: "", venue: "", startTime: "" });
    await loadAll();
    onToast("Game added.");
  }

  function startEdit(g: Game) {
    setEditingGameId(g.id);
    setEditDraft({
      name: g.name,
      venue: g.venue ?? "",
      startTime: g.startTime ? toLocalInput(g.startTime) : "",
    });
  }

  async function saveEdit(id: number) {
    if (!editDraft.name.trim()) return;
    await fetch(`/api/games/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editDraft.name.trim(),
        venue: editDraft.venue,
        startTime: editDraft.startTime || null,
      }),
    });
    setEditingGameId(null);
    await loadAll();
    onToast("Game updated.");
  }

  async function toggleGame(g: Game) {
    await fetch(`/api/games/${g.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !g.isActive }),
    });
    await loadAll();
    onToast(g.isActive ? "Game paused." : "Game activated.");
  }

  async function deleteGame(id: number) {
    if (!confirm("Delete this game and ALL its scores? This cannot be undone.")) return;
    await fetch(`/api/games/${id}`, { method: "DELETE" });
    await loadAll();
    onToast("Game deleted.");
  }

  function setField(teamId: number, gameId: number, field: Field, value: number) {
    setInputs((p) => ({ ...p, [K(teamId, gameId, field)]: Math.max(0, value) }));
  }

  function adjust(teamId: number, gameId: number, field: Field, delta: number) {
    const cur = inputs[K(teamId, gameId, field)] ?? 0;
    setField(teamId, gameId, field, cur + delta);
  }

  async function saveRow(teamId: number, gameId: number) {
    const rowKey = `row_${teamId}_${gameId}`;
    setSaving((p) => ({ ...p, [rowKey]: true }));

    const wins   = inputs[K(teamId, gameId, "wins")]   ?? 0;
    const losses = inputs[K(teamId, gameId, "losses")] ?? 0;
    const points = inputs[K(teamId, gameId, "points")] ?? 0;

    const res = await fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId, gameId, wins, losses, points }),
    });

    setSaving((p) => ({ ...p, [rowKey]: false }));

    if (res.ok) {
      const data = await res.json();
      setStandings(data.standings);
      setSavedFlash((p) => ({ ...p, [rowKey]: true }));
      setTimeout(() => setSavedFlash((p) => ({ ...p, [rowKey]: false })), 1200);
    } else {
      onToast("Save failed.", true);
    }
  }

  return (
    <>
      {/* ═══ STANDINGS ═══ */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Live Standings</h2>
          <span className={styles.sectionHint}>Auto-updates when you save a score</span>
        </div>
        <div className={styles.standings}>
          {standings.map((s) => (
            <div key={s.id} className={styles.standingRow}>
              <div className={styles.standingRank}>{s.placement}</div>
              <div className={styles.standingName}>{s.name}</div>
              <div className={styles.standingStats}>
                <div className={styles.stat}>
                  <span className={styles.statNum}>{s.wins}</span>
                  <span className={styles.statLabel}>W</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statNum}>{s.losses}</span>
                  <span className={styles.statLabel}>L</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statNum}>{s.points}</span>
                  <span className={styles.statLabel}>PTS</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statNum}>{(s.winPct * 100).toFixed(0)}%</span>
                  <span className={styles.statLabel}>WIN</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ MANAGE GAMES ═══ */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Games</h2>
          <span className={styles.sectionHint}>Create, edit, pause, or delete events</span>
        </div>

        <div className={styles.addGrid}>
          <input
            placeholder="Game name (e.g. Volleyball)"
            value={newGame.name}
            onChange={(e) => setNewGame((p) => ({ ...p, name: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && addGame()}
            className={styles.input}
          />
          <input
            placeholder="Venue (e.g. Enrique Razon Sports Center)"
            value={newGame.venue}
            onChange={(e) => setNewGame((p) => ({ ...p, venue: e.target.value }))}
            className={styles.input}
          />
          <input
            type="datetime-local"
            value={newGame.startTime}
            onChange={(e) => setNewGame((p) => ({ ...p, startTime: e.target.value }))}
            className={styles.input}
          />
          <button onClick={addGame} className={styles.addBtn}>+ Add Game</button>
        </div>

        {games.length === 0 ? (
          <p className={styles.empty}>No games yet — add one above.</p>
        ) : (
          <div className={styles.gameManageList}>
            {games.map((g) => (
              <div key={g.id} className={styles.gameManageCard}>
                {editingGameId === g.id ? (
                  <div className={styles.editForm}>
                    <label className={styles.editLabel}>
                      <span>Name</span>
                      <input
                        autoFocus
                        value={editDraft.name}
                        onChange={(e) => setEditDraft((p) => ({ ...p, name: e.target.value }))}
                        className={styles.input}
                      />
                    </label>
                    <label className={styles.editLabel}>
                      <span>Venue</span>
                      <input
                        value={editDraft.venue}
                        onChange={(e) => setEditDraft((p) => ({ ...p, venue: e.target.value }))}
                        placeholder="e.g. Enrique Razon Sports Center"
                        className={styles.input}
                      />
                    </label>
                    <label className={styles.editLabel}>
                      <span>Start time</span>
                      <input
                        type="datetime-local"
                        value={editDraft.startTime}
                        onChange={(e) => setEditDraft((p) => ({ ...p, startTime: e.target.value }))}
                        className={styles.input}
                      />
                    </label>
                    <div className={styles.editActions}>
                      <button className={styles.addBtn} onClick={() => saveEdit(g.id)}>Save</button>
                      <button className={styles.chipBtn} onClick={() => setEditingGameId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={styles.gameManageInfo}>
                      <div className={styles.gameManageHead}>
                        <span
                          className={styles.chipDot}
                          style={{ background: g.isActive ? "#00ff88" : "#555" }}
                        />
                        <span className={styles.chipName}>{g.name}</span>
                      </div>
                      <div className={styles.gameManageMeta}>
                        <span className={styles.metaItem}>
                          Venue: <span>{g.venue || "—"}</span>
                        </span>
                        <span className={styles.metaItem}>
                          Starts: <span>{g.startTime ? formatDateTime(g.startTime) : "—"}</span>
                        </span>
                      </div>
                    </div>
                    <div className={styles.gameManageActions}>
                      <button className={styles.chipBtn} onClick={() => startEdit(g)}>Edit</button>
                      <button className={styles.chipBtn} onClick={() => toggleGame(g)}>
                        {g.isActive ? "Pause" : "Activate"}
                      </button>
                      <button
                        className={`${styles.chipBtn} ${styles.chipBtnDanger}`}
                        onClick={() => deleteGame(g.id)}
                      >Delete</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ═══ SCORE EDITOR ═══ */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Scores</h2>
          <span className={styles.sectionHint}>Adjust wins, losses, and points per team per game</span>
        </div>
        {games.length === 0 ? (
          <p className={styles.empty}>Add a game above to start entering scores.</p>
        ) : (
          <div className={styles.scoreGrid}>
            {games.map((game) => (
              <div key={game.id} className={styles.gameCard}>
                <div className={styles.gameCardHeader}>
                  <span className={styles.gameCardTitle}>{game.name}</span>
                  {!game.isActive && <span className={styles.pausedBadge}>PAUSED</span>}
                </div>

                <div className={styles.teamScores}>
                  {teams.map((team) => {
                    const rowKey = `row_${team.id}_${game.id}`;
                    const isSaving = saving[rowKey];
                    const isDone   = savedFlash[rowKey];

                    return (
                      <div key={team.id} className={styles.teamRow}>
                        <div className={styles.teamLabel}>
                          <span>{team.name}</span>
                        </div>

                        <div className={styles.wlpGrid}>
                          <ScoreField
                            label="W"
                            accent="#00ff88"
                            value={inputs[K(team.id, game.id, "wins")] ?? 0}
                            onChange={(v) => setField(team.id, game.id, "wins", v)}
                            onDec={() => adjust(team.id, game.id, "wins", -1)}
                            onInc={() => adjust(team.id, game.id, "wins", 1)}
                          />
                          <ScoreField
                            label="L"
                            accent="#ff5566"
                            value={inputs[K(team.id, game.id, "losses")] ?? 0}
                            onChange={(v) => setField(team.id, game.id, "losses", v)}
                            onDec={() => adjust(team.id, game.id, "losses", -1)}
                            onInc={() => adjust(team.id, game.id, "losses", 1)}
                          />
                          <ScoreField
                            label="PTS"
                            accent="#ffcc00"
                            value={inputs[K(team.id, game.id, "points")] ?? 0}
                            onChange={(v) => setField(team.id, game.id, "points", v)}
                            onDec={() => adjust(team.id, game.id, "points", -1)}
                            onInc={() => adjust(team.id, game.id, "points", 1)}
                          />
                        </div>

                        <button
                          className={`${styles.saveBtn} ${isDone ? styles.saveBtnDone : ""}`}
                          onClick={() => saveRow(team.id, game.id)}
                          disabled={isSaving}
                        >
                          {isSaving ? "..." : isDone ? "Saved" : "Save"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function ScoreField({
  label, accent, value, onChange, onDec, onInc,
}: {
  label: string; accent: string; value: number;
  onChange: (v: number) => void; onDec: () => void; onInc: () => void;
}) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel} style={{ color: accent }}>{label}</span>
      <div className={styles.fieldRow}>
        <button className={styles.fieldBtn} onClick={onDec}>−</button>
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={styles.fieldInput}
          style={{ borderColor: `${accent}40` }}
        />
        <button className={styles.fieldBtn} onClick={onInc}>+</button>
      </div>
    </div>
  );
}
