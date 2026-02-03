import { Title } from "@solidjs/meta";
import { createSignal, onCleanup, For, createEffect, createResource, Show, createMemo } from "solid-js";
import { getSheetData } from "../server/score"; 
import { marked } from "marked"; 
import "./index.css";

// --- 1. BASE SCHEDULE (Skeleton Only - Data comes from Google Sheets) ---
const BASE_SCHEDULE = [
  {
    date: "February 4 (Day 1)",
    events: [
      { id: "opening", title: "Opening Program", time: "7:30 AM", loc: "Covered Courts", hasScores: false },
      { id: "volleyball", title: "Volleyball", time: "9:00 AM - 4:00 PM", loc: "Pergola", hasScores: true },
      { id: "bball-boys", title: "Basketball Boys", time: "10:00 AM - 3:00 PM", loc: "Covered Courts", hasScores: true },
      { id: "bball-girls", title: "Basketball Girls", time: "10:00 AM - 1:00 PM", loc: "SMG", hasScores: true },
      { id: "frisbee", title: "Frisbee", time: "9:00 AM - 3:00 PM", loc: "Quad", hasScores: true },
      { id: "swimming", title: "Swimming", time: "9:30 - 11:30 AM", loc: "Pool", hasScores: true },
      { id: "tekken", title: "Tekken", time: "1:00 - 5:00 PM", loc: "Information Commons", hasScores: true },
      { id: "vr-game", title: "VR Game", time: "3:00 - 5:00 PM", loc: "Information Commons", hasScores: true },
      { id: "tug-of-war", title: "Tug-of-War", time: "2:00 - 5:00 PM", loc: "SMG", hasScores: true },
    ]
  },
  {
    date: "February 11 (Day 2)",
    events: [
      { id: "table-tennis", title: "Table Tennis", time: "10:00 - 12:00 NN", loc: "SMG", hasScores: true },
      { id: "badminton", title: "Badminton", time: "10:00 - 12:00 NN", loc: "SMG", hasScores: true },
      { id: "dodgeball", title: "Dodgeball", time: "1:00 - 3:00 PM", loc: "SMG", hasScores: true },
      { id: "board-games", title: "Board Games", time: "10:30 AM - 2:00 PM", loc: "Information Commons", hasScores: true },
      { id: "hiphop", title: "Hiphop Competition", time: "3:00 - 5:00 PM", loc: "Covered Courts", hasScores: true },
      { id: "battle-bands", title: "Battle of the Bands", time: "3:00 - 5:00 PM", loc: "Covered Courts", hasScores: true },
      { id: "closing", title: "Closing Program", time: "3:00 - 5:00 PM", loc: "Covered Courts", hasScores: false },
    ]
  }
];

const TEAMS = ["MUTIEN", "BENILDE", "JAIME", "MIGUEL"];

const TEAM_CONFIG: Record<string, { color: string, gradient: string, textColor?: string }> = {
    "MUTIEN": { color: "#ffffff", gradient: "linear-gradient(90deg, #ffffff 0%, #e0e0e0 100%)", textColor: "black" },
    "BENILDE": { color: "#000000", gradient: "linear-gradient(90deg, #000000 0%, #434343 100%)", textColor: "white" },
    "JAIME": { color: "#78be21", gradient: "linear-gradient(90deg, #78be21 0%, #78be21 100%)", textColor: "white" },
    "MIGUEL": { color: "#1f800e", gradient: "linear-gradient(90deg, #1f800e 0%, #27ae60 100%)", textColor: "white" }
};

const BANNER_PATHS: Record<string, string> = {
    "MUTIEN": "/assets/Houses/Banners/Mutien.jpeg",
    "BENILDE": "/assets/Houses/Banners/Benilde.jpeg",
    "JAIME": "/assets/Houses/Banners/Jaime.png", 
    "MIGUEL": "/assets/Houses/Banners/Miguel.jpeg"
};

const MERCH_IMAGES = Array.from({ length: 20 }, (_, i) => `/assets/Merch/${i + 2}.jpg`);

type GalleryImage = {
  id: string;
  url: string;
  name?: string;
}

type SubEvent = {
  round: string;
  division: string;
  match: string;
  time: string;
  loc: string;
};

type SheetData = {
  matchRows: string[][];
  overallRows: string[][];
  announcements: string[][];
  galleryImages: GalleryImage[];
  scheduleData?: Record<string, SubEvent[]>; // Added this from server response
};

type Announcement = {
  date: string;
  title: string;
  message: string;
  category: string;
}

const fetchSheetData = async (): Promise<SheetData> => {
  return await getSheetData(Date.now());
};

const formatRank = (rank: string | number | undefined | null) => {
  if (rank === undefined || rank === null || rank === "") return "-";
  
  const r = rank.toString().trim();
  if (r === "1" || r === "1st") return "1st";
  if (r === "2" || r === "2nd") return "2nd";
  if (r === "3" || r === "3rd") return "3rd";
  if (r === "4" || r === "4th") return "4th";
  return r; 
};

const getWinnerName = (matchRows: string[][] | undefined, eventId: string) => {
    if (!matchRows) return null;
    const cleanId = eventId.toLowerCase().replace(/[^a-z0-9]/g, "");
    const row = matchRows.find(r => {
      const sheetId = (r[0] || "").toString().toLowerCase().replace(/[^a-z0-9]/g, "");
      const rank = (r[4] || "").toString().trim().toLowerCase();
      return sheetId === cleanId && (rank === "1" || rank === "1st");
    });
    return row ? row[1].toUpperCase() : null; 
};

export default function Home() {
  const [resource, { refetch }] = createResource(fetchSheetData);
  const [viewData, setViewData] = createSignal<SheetData | null>(null);
  const [lastUpdated, setLastUpdated] = createSignal("...");
  const [currentDayIndex, setCurrentDayIndex] = createSignal(0);
  const [isGalleryExpanded, setIsGalleryExpanded] = createSignal(false);
  const [selectedImage, setSelectedImage] = createSignal<GalleryImage | null>(null);
  const [activeEvent, setActiveEvent] = createSignal<any>(null);

  const [currentMerchIndex, setCurrentMerchIndex] = createSignal(0);

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

  // --- MERGE BASE SCHEDULE WITH DYNAMIC GOOGLE SHEET DATA ---
  const scheduleWithData = createMemo(() => {
    const dynamicSchedule = viewData()?.scheduleData || {};

    return BASE_SCHEDULE.map(day => ({
        ...day,
        events: day.events.map(event => ({
            ...event,
            // Automatically inject subEvents if the ID matches a key from the server
            subEvents: dynamicSchedule[event.id] || undefined
        }))
    }));
  });

  createEffect(() => {
    const timer = setInterval(() => {
        refetch();
    }, 30000); 
    onCleanup(() => clearInterval(timer));
  });

  createEffect(() => {
    const timer = setInterval(() => {
        setCurrentMerchIndex((prev) => (prev + 1) % MERCH_IMAGES.length);
    }, 5000);
    onCleanup(() => clearInterval(timer));
  });

  const nextMerch = () => setCurrentMerchIndex((prev) => (prev + 1) % MERCH_IMAGES.length);
  const prevMerch = () => setCurrentMerchIndex((prev) => (prev - 1 + MERCH_IMAGES.length) % MERCH_IMAGES.length);

  const groupedAnnouncements = createMemo(() => {
    const rawData = viewData()?.announcements || [];
    const groups: Record<string, Announcement[]> = {};
    rawData.forEach(row => {
      const post: Announcement = {
        date: row[0] || "",
        title: row[1] || "No Title",
        message: row[2] || "",
        category: row[3] || "General Updates"
      };
      if (!groups[post.category]) groups[post.category] = [];
      groups[post.category].push(post);
    });
    return groups;
  });

  const getMaxPoints = (overallRows: string[][] | undefined) => {
    if (!overallRows) return 1; 
    const allScores = TEAMS.map(t => {
        const cleanTeam = t.toLowerCase().replace(/[^a-z0-9]/g, "");
        const row = overallRows.find(r => 
          (r[0] || "").toString().toLowerCase().replace(/[^a-z0-9]/g, "") === cleanTeam
        );
        return parseInt(row ? row[1] : "0") || 0;
    });
    return Math.max(...allScores) || 1; 
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
    return { points: myScore ? myScore.points.toString() : "0", rankStr: rankStr, rankNum: rankNum };
  };

  const getHeightProportional = (pointsStr: string, maxPoints: number) => {
    const points = parseInt(pointsStr) || 0;
    const VISUAL_CEILING = 22; 
    const VISUAL_FLOOR = 10;   
    if (maxPoints === 0) return `${VISUAL_FLOOR}rem`;
    const ratio = Math.min(points / maxPoints, 1);
    return `${VISUAL_FLOOR + (ratio * (VISUAL_CEILING - VISUAL_FLOOR))}rem`;
  };
  
  const getEventStats = (matchRows: string[][] | undefined, eventId: string, teamName: string) => {
    if (!matchRows) return { wins: "-", losses: "-", rank: "-", status: "Not started" }; 
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
        rank: row ? row[4] : "Nth",
        status: row ? row[5] || "Not started" : "Not started" 
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

  const nextDay = () => setCurrentDayIndex((prev) => (prev + 1) % BASE_SCHEDULE.length);
  const prevDay = () => setCurrentDayIndex((prev) => (prev - 1 + BASE_SCHEDULE.length) % BASE_SCHEDULE.length);

  const displayedImages = createMemo(() => {
    const images = viewData()?.galleryImages || [];
    return isGalleryExpanded() ? images : images.slice(0, 5);
  });

  return (
    <main>
      <Title>House Cup</Title>
      
      <header id="main-header">
        <div id="left"><img src="/assets/SC_Logo.svg" alt="" class="Header-Logo" /></div>
        <div id="center">
          <h1>HOUSE CUP</h1>
          <h6>2025-2026</h6>
          <nav class="pill-nav">
            <a href="#Score">SCORE</a>
            <a href="#Live-section">LIVE <span class="live-dot" title={resource.loading ? "Refreshing..." : "Live"}></span></a>
            <a href="#Gallery">GALLERY</a>
            <a href="#Announcements">INFO</a>
            <a href="#Merch" style="color: black;">MERCH</a>
          </nav>
        </div>
      </header>

      <Show when={viewData()} fallback={<div class="loading-screen" style="text-align:center; padding: 50px;">Loading Scores...</div>}>
        
        <section id="Score" class="score-section">
          <For each={TEAMS}>
            {(team) => {
              const stats = () => getCalculatedTeamStats(viewData()?.overallRows, team);
              const currentMaxPoints = getMaxPoints(viewData()?.overallRows);
              return (
                <div class="team-container">
                  <div 
                    class={`team-card ${team.toLowerCase()}`}
                    style={{ 
                        height: getHeightProportional(stats().points, currentMaxPoints),
                        transition: "height 0.8s ease-out"
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

        <section id="Live-section">
          <div class="last-updated-indicator">
            Last updated: {lastUpdated()}
          </div>
          <div id="Header">
            <button class="Live-Nav-Button" onClick={prevDay}>
              <img src="/assets/Icons/Arrow_Back.svg" class="back-arrow" />
            </button>
            <h3>{BASE_SCHEDULE[currentDayIndex()].date}</h3>
            <button class="Live-Nav-Button" onClick={nextDay}>
              <img src="/assets/Icons/Arrow_Forward.svg" class="forward-arrow" />
            </button>
          </div>
          <div id="Bulletin-Board">
            {/* USE THE MERGED SCHEDULE HERE */}
            <For each={scheduleWithData()[currentDayIndex()].events}>
              {(event) => {
                const headerStyle = createMemo(() => {
                    const winnerName = getWinnerName(viewData()?.matchRows, event.id);
                    const bannerUrl = winnerName ? BANNER_PATHS[winnerName] : null;

                    if (bannerUrl) {
                        return {
                            "background-image": `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url('${bannerUrl}')`,
                            "background-size": "cover",
                            "background-position": "center",
                            "color": "white",
                            "text-shadow": "0 2px 4px rgba(0,0,0,0.8)"
                        };
                    }
                    return {}; 
                });

                const isEventLive = () => {
                    const teams = getSortedEventTeams(viewData()?.matchRows, event.id);
                    return teams.some(t => (t.status || "").toLowerCase() === "started");
                };

                return (
                    <div 
                        class={`bulletin-entry ${isEventLive() ? 'live-glow' : ''}`} 
                        id={event.id}
                        onClick={() => setActiveEvent(event)}
                        style={{ "cursor": "pointer", "transition": "transform 0.2s" }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.01)"}
                        onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                    >
                      <div class="entry-header" style={headerStyle()}>
                        <h1 class="entry-title">{event.title}</h1>
                        <span class="entry-content">
                          <p class="entry-content-time">{event.time}</p>
                          <p class="entry-content-location">{event.loc}</p>
                          <span style="font-size: 0.8rem; text-decoration: underline; margin-top: 5px; opacity: 0.8;">
                            Tap for details ➜
                          </span>
                        </span>
                        
                        <Show when={isEventLive()}>
                            <div class="live-badge-corner">LIVE</div>
                        </Show>
                      </div>
                      
                      {event.hasScores && (
                        <div class="bulletin-body">
                          <For each={getSortedEventTeams(viewData()?.matchRows, event.id)}>
                            {(teamData) => {
                                const config = TEAM_CONFIG[teamData.name];
                                const status = (teamData.status || "").toLowerCase().trim();
                                const isStarted = status === "started";
                                const isNotStarted = status === "not started" || status === "";
                                const formattedRank = formatRank(teamData.rank);
                                const isWinner = formattedRank === "1st";

                                return (
                                    <div class="bulletin-body-team-entry">
                                      <div style="display: flex; align-items: center; gap: 8px; min-width: 40%;">
                                          <p class="bulletin-body-team-entry-team-name"
                                            style={{ 
                                                "background": config ? config.gradient : "#333",
                                                "color": config?.textColor || "white",
                                                "padding": "2px 8px", 
                                                "border-radius": "4px",
                                                "font-weight": "bold",
                                                "width": "100%", 
                                                "text-align": "center",
                                                "border": isWinner ? "2px solid #FFD700" : (teamData.name === "MUTIEN" ? "1px solid #ccc" : "none"),
                                                "box-shadow": "none",
                                                "transform": isWinner ? "scale(1.02)" : "scale(1)",
                                                "transition": "all 0.3s ease"
                                           }}
                                          >
                                            {teamData.name}
                                          </p>
                                      </div>

                                      <Show when={!isNotStarted} fallback={
                                        <span style="color: #666; font-size: 0.9em; font-style: italic; margin-left: auto; padding-right: 10px;">
                                          UPCOMING
                                        </span>
                                      }>
                                         <Show when={isStarted}>
                                            <span style="background-color: #ff3b30; color: white; font-size: 0.7em; padding: 2px 6px; border-radius: 4px; font-weight: bold; animation: pulse 1.5s infinite;">
                                              LIVE
                                            </span>
                                         </Show>

                                         <p class="team-score-w">W: {teamData.wins}</p>
                                         <p class="team-score-l">L: {teamData.losses}</p>
                                         <p class="team-score-rank" style={{ "color": isWinner ? "#DAA520" : "inherit", "font-weight": isWinner ? "bold" : "normal" }}>
                                            {formattedRank} {isWinner && "👑"}
                                         </p>
                                      </Show>
                                    </div>
                                );
                            }}
                          </For>
                        </div>
                      )}
                    </div>
                );
              }}
            </For>
          </div>
        </section>

        <section id="Gallery" class="gallery-section">
          <h2 style="text-align: center; margin-bottom: 2rem; font-family: 'Arial Black'; font-size: 2.5rem; text-transform: uppercase;">
            Gallery
          </h2>
          <div class="gallery-grid">
            <Show when={displayedImages().length > 0} fallback={<div style="text-align:center; width: 100%; grid-column: 1/-1;">No photos yet.</div>}>
              <For each={displayedImages()}>
                {(img) => (
                  <div class="gallery-item" onClick={() => setSelectedImage(img)}>
                    <img src={img.url} alt={img.name} class="gallery-img" loading="lazy" />
                  </div>
                )}
              </For>
            </Show>
          </div>
          <Show when={(viewData()?.galleryImages?.length || 0) > 5}>
            <div style="text-align: center; margin-top: 2rem;">
                <button 
                    onClick={() => setIsGalleryExpanded(!isGalleryExpanded())}
                    style="background: transparent; color: white; border: 2px solid white; padding: 10px 20px; font-family: 'Arial Black', sans-serif; font-size: 1rem; cursor: pointer; text-transform: uppercase; border-radius: 50px; transition: all 0.3s ease;"
                    onMouseEnter={(e) => { e.currentTarget.style.background = "white"; e.currentTarget.style.color = "black"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "white"; }}
                >
                    {isGalleryExpanded() ? "Show Less" : "View All Photos"}
                </button>
            </div>
          </Show>
        </section>

        <section id="Announcements" class="announcement-section" style="background: rgba(255, 255, 255, 0.9); padding: 4rem 2rem; min-height: 50vh;">
          <h2 style="text-align: center; color: black; margin-bottom: 2rem; font-family: 'Arial Black', sans-serif; font-size: 2rem; text-transform: uppercase;">Announcements</h2>
          <div class="announcements-list" style="display: flex; flex-direction: column; gap: 2rem; max-width: 900px; margin: 0 auto;">
            <Show when={Object.keys(groupedAnnouncements()).length > 0} fallback={<div style="text-align: center; color: black;">No announcements yet.</div>}>
                <For each={Object.keys(groupedAnnouncements())}>
                {(category) => (
                    <div class="announcement-category">
                    <h3 style="color: black; border-bottom: 3px solid black; padding-bottom: 0.5rem; margin-bottom: 1.5rem; font-family: 'Arial Black', sans-serif; font-size: 1.5rem; text-transform: uppercase;">{category}</h3>
                    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                        <For each={groupedAnnouncements()[category]}>
                        {(post) => (
                            <div class="bulletin-entry announcement-card" style="height: auto; min-height: auto;">
                                <div class="entry-header">
                                    <h1 class="entry-title" style="color: black; font-size: 1.2rem;">{post.title}</h1>
                                    <span class="entry-content">
                                    <p class="entry-content-time" style="font-size: 0.8rem; font-weight: bold; margin: 0; color: #555;">{post.date || "Update"}</p>
                                    </span>
                                </div>
                                <div class="bulletin-body" style="padding: 15px; color: black; font-family: Arial, sans-serif;">
                                    <div innerHTML={marked ? marked.parse(post.message || "") : post.message} />
                                </div>
                            </div>
                        )}
                        </For>
                    </div>
                    </div>
                )}
                </For>
            </Show>
          </div>
        </section>

        <section 
            id="Merch" 
            class="merch-section"
            style={{ 
                "background-image": `url('${MERCH_IMAGES[currentMerchIndex()]}')`
            }}
        >
            <h2 class="merch-title">MERCH</h2>
            
            <button class="merch-nav-btn prev" onClick={prevMerch}>❮</button>
            <button class="merch-nav-btn next" onClick={nextMerch}>❯</button>

            <div class="merch-cta-container">
                <p class="merch-deadline">AVAILABLE ONLY UNTIL FEB 4, 6:00 PM</p>
                <a href="https://bit.ly/HouseCup-Merch" target="_blank" rel="noopener noreferrer" class="merch-buy-btn">
                    BUY NOW
                </a>
            </div>
        </section>

      </Show>

      {/* --- EVENT DETAILS MODAL --- */}
      <Show when={activeEvent()}>
        <div class="modal-overlay" onClick={() => setActiveEvent(null)}>
            <div class="modal-content" onClick={(e) => e.stopPropagation()}>
                <button class="modal-close" onClick={() => setActiveEvent(null)}>&times;</button>
                
                <h2 style="font-family: 'Arial Black'; margin-bottom: 0;">{activeEvent().title}</h2>
                <p style="color: #666; margin-bottom: 20px;">{activeEvent().time} | {activeEvent().loc}</p>
                
                <div class="modal-scroll-area">
                    <Show when={activeEvent().hasScores}>
                        <h3 style="border-bottom: 2px solid #333; padding-bottom: 5px;">Current Standings</h3>
                        <div style="margin-bottom: 20px;">
                            <For each={getSortedEventTeams(viewData()?.matchRows, activeEvent().id)}>
                                {(team) => (
                                    <div class="modal-standing-row">
                                        <span class={`team-dot ${team.name}`}></span>
                                        <span class="t-name">{team.name}</span>
                                        <span class="t-stat">W: {team.wins} | L: {team.losses}</span>
                                        <Show when={(team.status||"").toLowerCase() === "started"}>
                                            <span class="status-live">PLAYING NOW</span>
                                        </Show>
                                    </div>
                                )}
                            </For>
                        </div>
                    </Show>

                    <Show when={activeEvent().subEvents}>
                        <h3 style="border-bottom: 2px solid #333; padding-bottom: 5px;">Match Schedule</h3>
                        <div style="overflow-x: auto;">
                            <table class="schedule-table">
                                <thead>
                                    <tr>
                                        <th>Round</th>
                                        <th>Div</th>
                                        <th>Matchup</th>
                                        <th>Time</th>
                                        <th>Court</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <For each={activeEvent().subEvents}>
                                        {(sub: any) => (
                                            <tr>
                                                <td>{sub.round}</td>
                                                <td><span class="division-badge">{sub.division}</span></td>
                                                <td style="font-weight: bold">{sub.match}</td>
                                                <td style="white-space: nowrap">{sub.time || "-"}</td>
                                                <td>{sub.loc}</td>
                                            </tr>
                                        )}
                                    </For>
                                </tbody>
                            </table>
                        </div>
                    </Show>
                    
                    <Show when={!activeEvent().subEvents && !activeEvent().hasScores}>
                        <p style="color: #888; text-align: center; margin-top: 20px;">No specific details available for this event yet.</p>
                    </Show>
                </div>
            </div>
        </div>
      </Show>

      {/* Gallery Modal */}
      <Show when={selectedImage()}>
        <div class="image-modal-overlay" onClick={() => setSelectedImage(null)}>
            <div class="image-modal-content" onClick={(e) => e.stopPropagation()}>
                <button class="modal-close-btn" onClick={() => setSelectedImage(null)}>&times;</button>
                <img src={selectedImage()?.url} alt="Full view" class="image-modal-img"/>
                <a href={selectedImage()?.url.replace('=s1000', '=d')} target="_blank" rel="noopener noreferrer" class="modal-download-btn"><span style="font-size: 1.2em;">⬇</span> Download</a>
            </div>
        </div>
      </Show>
      
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }

        .live-glow {
            border: 2px solid #ff3b30 !important;
            box-shadow: 0 0 15px rgba(255, 59, 48, 0.4);
            position: relative;
        }

        .live-badge-corner {
            background-color: #ff3b30;
            color: white;
            padding: 2px 8px;
            font-size: 0.7rem;
            font-weight: bold;
            position: absolute;
            top: 10px;
            right: 10px;
            border-radius: 4px;
            animation: pulse 1.5s infinite;
        }

        .modal-overlay {
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0,0,0,0.8);
            z-index: 1000;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
            backdrop-filter: blur(5px);
        }

        .modal-content {
            background: white;
            color: black;
            padding: 2rem;
            border-radius: 12px;
            width: 100%;
            max-width: 800px;
            max-height: 80vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            position: relative;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        }

        .modal-scroll-area {
            overflow-y: auto;
            margin-top: 1rem;
            padding-right: 5px;
        }

        .modal-close {
            position: absolute;
            top: 10px; right: 15px;
            font-size: 2rem;
            background: none;
            border: none;
            cursor: pointer;
            color: #333;
            z-index: 2;
        }

        .schedule-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.85rem;
            margin-top: 0.5rem;
            min-width: 500px; 
        }

        .schedule-table th { 
            text-align: left; 
            background: #f4f4f4; 
            padding: 8px; 
            font-weight: bold;
            position: sticky;
            top: 0;
        }
        
        .schedule-table td { 
            border-bottom: 1px solid #eee; 
            padding: 10px 8px; 
        }

        .division-badge {
            font-size: 0.7rem;
            padding: 2px 6px;
            border-radius: 4px;
            background: #eee;
            color: #555;
            font-weight: bold;
            text-transform: uppercase;
        }
        
        .modal-standing-row {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 0;
            border-bottom: 1px solid #eee;
            font-size: 1rem;
        }

        .t-name { font-weight: bold; flex-grow: 1; }
        .t-stat { color: #555; font-size: 0.9em; }

        .team-dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }
        .team-dot.MUTIEN { background: #ccc; border: 1px solid black; }
        .team-dot.BENILDE { background: black; }
        .team-dot.JAIME { background: #78be21; }
        .team-dot.MIGUEL { background: #1f800e; }

        .status-live {
            color: #ff3b30;
            font-weight: bold;
            font-size: 0.8rem;
            animation: pulse 1.5s infinite;
        }
      `}</style>
    </main>
  );
}