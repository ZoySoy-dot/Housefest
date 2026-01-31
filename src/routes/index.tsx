import { Title } from "@solidjs/meta";
import { createSignal, onCleanup, For, createEffect, createResource, Show } from "solid-js";
import { getSheetData } from "../server/score"; 
import "./index.css";

// --- CONFIGURATION: Schedule Data ---
const SCHEDULE_DATA = [
  {
    date: "February 4 (Day 1)",
    events: [
      { id: "opening", title: "Opening Program", time: "8:00 - 9:00 AM", loc: "Covered Courts", hasScores: false },
      { id: "volleyball", title: "Volleyball", time: "9:00 AM - 3:00 PM", loc: "Pergola", hasScores: true },
      { id: "bball-boys", title: "Basketball Boys", time: "9:00 AM - 5:00 PM", loc: "Covered Courts", hasScores: true },
      { id: "bball-girls", title: "Basketball Girls", time: "9:00 AM - 5:00 PM", loc: "SMG", hasScores: true },
      { id: "frisbee", title: "Frisbee", time: "9:00 AM - 3:00 PM", loc: "Quad", hasScores: true },
      { id: "swimming", title: "Swimming", time: "9:00 - 11:00 AM", loc: "Pool", hasScores: true },
      { id: "tekken", title: "Tekken", time: "1:00 - 5:00 PM", loc: "Information Commons", hasScores: true },
      { id: "vr-game", title: "VR Game", time: "3:00 - 5:00 PM", loc: "Information Commons", hasScores: true },
      { id: "tug-of-war", title: "Tug-of-War", time: "3:30 - 5:00 PM", loc: "SMG", hasScores: true },
    ]
  },
  {
    date: "February 11 (Day 2)",
    events: [
      { id: "table-tennis", title: "Table Tennis", time: "8:00 AM - 12:00 NN", loc: "SMG", hasScores: true },
      { id: "badminton", title: "Badminton", time: "8:00 AM - 12:00 NN", loc: "SMG", hasScores: true },
      { id: "board-games", title: "Board Games", time: "8:00 AM - 12:00 NN", loc: "Information Commons", hasScores: true },
      { id: "dodgeball", title: "Dodgeball", time: "1:00 - 3:00 PM", loc: "SMG", hasScores: true },
      { id: "hiphop", title: "Hiphop Competition", time: "2:00 - 4:00 PM", loc: "Covered Courts", hasScores: true },
      { id: "battle-bands", title: "Battle of the Bands", time: "2:00 - 4:00 PM", loc: "Covered Courts", hasScores: true },
      { id: "closing", title: "Closing Program", time: "2:00 - 4:00 PM", loc: "Covered Courts", hasScores: false },
    ]
  }
];

const TEAMS = ["MUTIEN", "BENILDE", "JAIME", "MIGUEL"];

// --- UPDATED: Team Gradients Configuration ---
const TEAM_CONFIG: Record<string, { color: string, gradient: string, textColor?: string }> = {
    "MUTIEN": { 
        color: "#ffffff", 
        gradient: "linear-gradient(90deg, #ffffff 0%, #e0e0e0 100%)",
        textColor: "black" // Dark text for white background
    },
    "BENILDE": { 
        color: "#000000", 
        gradient: "linear-gradient(90deg, #000000 0%, #434343 100%)",
        textColor: "white"
    },
    "JAIME": { 
        color: "#17d430", 
        gradient: "linear-gradient(90deg, #17d430 0%, #2ecc71 100%)",
        textColor: "white"
    },
    "MIGUEL": { 
        color: "#1f800e", 
        gradient: "linear-gradient(90deg, #1f800e 0%, #27ae60 100%)",
        textColor: "white"
    }
};

type SheetData = {
  matchRows: string[][];
  overallRows: string[][];
};

const fetchSheetData = async (): Promise<SheetData> => {
  return await getSheetData(Date.now());
};

export default function Home() {
  const [resource, { refetch }] = createResource(fetchSheetData);
  const [viewData, setViewData] = createSignal<SheetData | null>(null);
  const [lastUpdated, setLastUpdated] = createSignal("...");
  const [currentDayIndex, setCurrentDayIndex] = createSignal(0);

  createEffect(() => {
    if (!resource.error && resource()) {
      setViewData(resource());
      const now = new Date();
      setLastUpdated(now.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      }));
    }
  });

  createEffect(() => {
    const timer = setInterval(() => {
        refetch();
    }, 30000);
    onCleanup(() => clearInterval(timer));
  });

  const getEventStats = (matchRows: string[][] | undefined, eventId: string, teamName: string) => {
    if (!matchRows) return { wins: "-", losses: "-", rank: "-" }; 

    const cleanId = eventId.toLowerCase().replace(/[^a-z0-9]/g, ""); 
    const cleanTeam = teamName.toLowerCase().replace(/[^a-z0-9]/g, "");

    const row = matchRows.find(r => {
      const sheetId = (r[0] || "").toString().toLowerCase().replace(/[^a-z0-9]/g, "");
      const sheetTeam = (r[1] || "").toString().toLowerCase().replace(/[^a-z0-9]/g, "");
      return sheetId === cleanId && sheetTeam === cleanTeam;
    });

    return {
      wins: row ? row[2] : "-",
      losses: row ? row[3] : "-",
      rank: row ? row[4] : "Nth"
    };
  };

  const getSortedEventTeams = (matchRows: string[][] | undefined, eventId: string) => {
    const teamStats = TEAMS.map(team => {
        const stats = getEventStats(matchRows, eventId, team);
        return { name: team, ...stats };
    });

    return teamStats.sort((a, b) => {
        const rankA = parseInt(a.rank) || 999; 
        const rankB = parseInt(b.rank) || 999;
        if (rankA !== rankB) return rankA - rankB; 

        const winsA = parseInt(a.wins) || 0;
        const winsB = parseInt(b.wins) || 0;
        if (winsA !== winsB) return winsB - winsA; 

        return a.name.localeCompare(b.name); 
    });
  };

  const getCalculatedTeamStats = (overallRows: string[][] | undefined, teamName: string) => {
    if (!overallRows) return { points: "0", rankStr: "TBD", rankNum: 4 };

    const teamScores = TEAMS.map(t => {
      const cleanTeam = t.toLowerCase().replace(/[^a-z0-9]/g, "");
      const row = overallRows.find(r => 
        (r[0] || "").toString().toLowerCase().replace(/[^a-z0-9]/g, "") === cleanTeam
      );
      const points = parseInt(row ? row[1] : "0") || 0;
      return { team: t, points: points };
    });

    teamScores.sort((a, b) => b.points - a.points);

    const index = teamScores.findIndex(item => item.team === teamName);
    const myScore = teamScores.find(item => item.team === teamName);
    
    const rankNum = index + 1; 
    const suffixes = ["st", "nd", "rd", "th"];
    const rankStr = rankNum + (suffixes[index] || "th");

    return {
      points: myScore ? myScore.points.toString() : "0",
      rankStr: rankStr,
      rankNum: rankNum
    };
  };

  const getHeightByRank = (rank: number) => {
    switch (rank) {
      case 1: return "22rem"; 
      case 2: return "18rem";
      case 3: return "15rem";
      case 4: return "12rem"; 
      default: return "12rem";
    }
  };

  const nextDay = () => setCurrentDayIndex((prev) => (prev + 1) % SCHEDULE_DATA.length);
  const prevDay = () => setCurrentDayIndex((prev) => (prev - 1 + SCHEDULE_DATA.length) % SCHEDULE_DATA.length);

  return (
    <main>
      <Title>DLSU Housefest</Title>
      
      <header id="main-header">
        <div id="left"><img src="/src/assests/SC_Logo.svg" alt="" class="Header-Logo" /></div>
        <div id="center">
          <h1>HOUSEFEST</h1>
          <h6>2025-2026</h6>
          <nav class="pill-nav">
            <a href="#Score">SCORE</a>
            <a href="#Live-section">
                LIVE <span class="live-dot" title={resource.loading ? "Refreshing..." : "Live"}></span>
            </a>
            <a href="#About">INFO</a>
          </nav>
        </div>
        <div id="right"><img src="/src/assests/DLSU_Logo.svg" alt="" class="Header-Logo" /></div>
      </header>

      <Show when={viewData()} fallback={<div class="loading-screen">Loading Scores...</div>}>
        
        <section id="Score" class="score-section" style="align-items: flex-end;">
          <For each={TEAMS}>
            {(team) => {
              const stats = () => getCalculatedTeamStats(viewData()?.overallRows, team);
              return (
                <div class="team-container">
                  <div 
                    class={`team-card ${team.toLowerCase()}`}
                    style={{ 
                        height: getHeightByRank(stats().rankNum),
                        transition: "height 0.5s ease"
                    }}
                  >
                    <h1 class="placement">{stats().rankStr}</h1>
                    <div class="bottom-stats">
                      <h2 class="points">{stats().points}</h2>
                      <span class="points-label">POINTS</span>
                    </div>
                  </div>
                  <h1 class="team-name">{team}</h1>
                </div>
              );
            }}
          </For>
        </section>

        <section id="Live-section" class="live-section" style="position: relative;">
          
          <div 
            class="last-updated-indicator" 
            style="
              position: absolute; 
              top: 1rem; 
              left: 1rem; 
              font-size: 0.75rem; 
              opacity: 0.7; 
              font-family: monospace;
              color: white; 
              z-index: 10;
            "
          >
            Last updated: {lastUpdated()}
          </div>

          <div id="Header">
            <button class="Live-Nav-Button" onClick={prevDay}>
              <img src="/src/assests/Icons/Arrow_Back.svg" class="back-arrow" />
            </button>
            <h3>{SCHEDULE_DATA[currentDayIndex()].date}</h3>
            <button class="Live-Nav-Button" onClick={nextDay}>
              <img src="/src/assests/Icons/Arrow_Forward.svg" class="forward-arrow" />
            </button>
          </div>

          <div id="Bulletin-Board">
            <For each={SCHEDULE_DATA[currentDayIndex()].events}>
              {(event) => (
                <div class="bulletin-entry" id={event.id}>
                  <div class="entry-header">
                    <h1 class="entry-title">{event.title}</h1>
                    <span class="entry-content">
                      <p class="entry-content-time">{event.time}</p>
                      <p class="entry-content-location">{event.loc}</p>
                    </span>
                  </div>

                  {event.hasScores && (
                    <div class="bulletin-body">
                      <For each={getSortedEventTeams(viewData()?.matchRows, event.id)}>
                        {(teamData) => {
                            const config = TEAM_CONFIG[teamData.name];
                            
                            return (
                                <div class="bulletin-body-team-entry">
                                  <p 
                                    class="bulletin-body-team-entry-team-name"
                                    style={{ 
                                        "background": config ? config.gradient : "#333",
                                        "color": config?.textColor || "white",
                                        "padding": "2px 8px", 
                                        "border-radius": "4px",
                                        "font-weight": "bold",
                                        "width": "auto", 
                                        "min-width": "40%", 
                                        "text-align": "center",
                                        "border-right": "none",
                                        "border": teamData.name === "MUTIEN" ? "1px solid #ccc" : "none"
                                    }}
                                  >
                                    {teamData.name}
                                  </p>
                                  
                                  <p class="team-score-w">W: {teamData.wins}</p>
                                  <p class="team-score-l">L: {teamData.losses}</p>
                                  
                                  <p class="team-score-rank">{teamData.rank}</p>
                                </div>
                            );
                        }}
                      </For>
                    </div>
                  )}
                </div>
              )}
            </For>
          </div>
        </section>
      </Show>
    </main>
  );
}
