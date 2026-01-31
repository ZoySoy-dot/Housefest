import { Title } from "@solidjs/meta";
import { createSignal, onCleanup, For, createEffect, createResource, Show, createMemo } from "solid-js";
import { getSheetData } from "../server/score"; 
import { marked } from "marked"; 
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

const TEAM_CONFIG: Record<string, { color: string, gradient: string, textColor?: string }> = {
    "MUTIEN": { color: "#ffffff", gradient: "linear-gradient(90deg, #ffffff 0%, #e0e0e0 100%)", textColor: "black" },
    "BENILDE": { color: "#000000", gradient: "linear-gradient(90deg, #000000 0%, #434343 100%)", textColor: "white" },
    "JAIME": { color: "#17d430", gradient: "linear-gradient(90deg, #17d430 0%, #2ecc71 100%)", textColor: "white" },
    "MIGUEL": { color: "#1f800e", gradient: "linear-gradient(90deg, #1f800e 0%, #27ae60 100%)", textColor: "white" }
};

type GalleryImage = {
  id: string;
  url: string;
  name?: string;
}

type SheetData = {
  matchRows: string[][];
  overallRows: string[][];
  announcements: string[][];
  galleryImages: GalleryImage[];
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

export default function Home() {
  const [resource, { refetch }] = createResource(fetchSheetData);
  const [viewData, setViewData] = createSignal<SheetData | null>(null);
  const [lastUpdated, setLastUpdated] = createSignal("...");
  const [currentDayIndex, setCurrentDayIndex] = createSignal(0);
  
  // Controls Gallery "Load More"
  const [isGalleryExpanded, setIsGalleryExpanded] = createSignal(false);
  
  // --- NEW: Controls which image is open in the modal ---
  const [selectedImage, setSelectedImage] = createSignal<GalleryImage | null>(null);

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
    if (!matchRows) return { wins: "-", losses: "-", rank: "-" }; 
    const cleanId = eventId.toLowerCase().replace(/[^a-z0-9]/g, ""); 
    const cleanTeam = teamName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const row = matchRows.find(r => {
      const sheetId = (r[0] || "").toString().toLowerCase().replace(/[^a-z0-9]/g, "");
      const sheetTeam = (r[1] || "").toString().toLowerCase().replace(/[^a-z0-9]/g, "");
      return sheetId === cleanId && sheetTeam === cleanTeam;
    });
    return { wins: row ? row[2] : "-", losses: row ? row[3] : "-", rank: row ? row[4] : "Nth" };
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

  const nextDay = () => setCurrentDayIndex((prev) => (prev + 1) % SCHEDULE_DATA.length);
  const prevDay = () => setCurrentDayIndex((prev) => (prev - 1 + SCHEDULE_DATA.length) % SCHEDULE_DATA.length);

  const displayedImages = createMemo(() => {
    const images = viewData()?.galleryImages || [];
    if (isGalleryExpanded()) {
        return images;
    }
    return images.slice(0, 5);
  });

  return (
    <main>
      <Title>DLSU Housefest</Title>
      
      <header id="main-header">
        <div id="left"><img src="/assets/SC_Logo.svg" alt="" class="Header-Logo" /></div>
        <div id="center">
          <h1>HOUSEFEST</h1>
          <h6>2025-2026</h6>
          <nav class="pill-nav">
            <a href="#Score">SCORE</a>
            <a href="#Live-section">LIVE <span class="live-dot" title={resource.loading ? "Refreshing..." : "Live"}></span></a>
            <a href="#Gallery">GALLERY</a>
            <a href="#Announcements">INFO</a>
          </nav>
        </div>
        <div id="right"><img src="/assets/DLSU_Logo.svg" alt="" class="Header-Logo" /></div>
      </header>

      <Show when={viewData()} fallback={<div class="loading-screen">Loading Scores...</div>}>
        
        <section id="Score" class="score-section" style="align-items: flex-end;">
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

        <section id="Live-section" class="live-section" style="position: relative;">
          <div class="last-updated-indicator">
            Last updated: {lastUpdated()}
          </div>
          <div id="Header">
            <button class="Live-Nav-Button" onClick={prevDay}>
              <img src="/assets/Icons/Arrow_Back.svg" class="back-arrow" />
            </button>
            <h3>{SCHEDULE_DATA[currentDayIndex()].date}</h3>
            <button class="Live-Nav-Button" onClick={nextDay}>
              <img src="/assets/Icons/Arrow_Forward.svg" class="forward-arrow" />
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
                                  <p class="bulletin-body-team-entry-team-name"
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

        <section id="Gallery" class="gallery-section">
          <h2 style="text-align: center; margin-bottom: 2rem; font-family: 'Arial Black'; font-size: 2.5rem;">
            GALLERY
          </h2>
          
          <div class="gallery-grid">
            <Show 
              when={displayedImages().length > 0} 
              fallback={<div style="text-align:center; width: 100%; grid-column: 1/-1;">No photos yet.</div>}
            >
              <For each={displayedImages()}>
                {(img) => (
                  <div 
                    class="gallery-item" 
                    onClick={() => setSelectedImage(img)} // --- CLICK TO OPEN MODAL ---
                  >
                    <img 
                      src={img.url} 
                      alt={img.name} 
                      class="gallery-img" 
                      loading="lazy" 
                    />
                  </div>
                )}
              </For>
            </Show>
          </div>

          <Show when={(viewData()?.galleryImages?.length || 0) > 5}>
            <div style="text-align: center; margin-top: 2rem;">
                <button 
                    onClick={() => setIsGalleryExpanded(!isGalleryExpanded())}
                    style="
                        background: transparent;
                        color: white;
                        border: 2px solid white;
                        padding: 10px 20px;
                        font-family: 'Arial Black', sans-serif;
                        font-size: 1rem;
                        cursor: pointer;
                        text-transform: uppercase;
                        border-radius: 50px;
                        transition: all 0.3s ease;
                    "
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = "white";
                        e.currentTarget.style.color = "black";
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "white";
                    }}
                >
                    {isGalleryExpanded() ? "Show Less" : "View All Photos"}
                </button>
            </div>
          </Show>
        </section>

        <section id="Announcements" class="announcement-section" style="background: rgba(255, 255, 255, 0.9); padding: 4rem 2rem; min-height: 50vh;">
          <h2 style="text-align: center; color: black; margin-bottom: 2rem; font-family: 'Arial Black', sans-serif; font-size: 2.5rem; text-transform: uppercase;">
            Announcements
          </h2>
          <div class="announcements-list" style="display: flex; flex-direction: column; gap: 2rem; max-width: 900px; margin: 0 auto;">
            <Show when={Object.keys(groupedAnnouncements()).length > 0} fallback={<div style="text-align: center; color: black;">No announcements yet.</div>}>
                <For each={Object.keys(groupedAnnouncements())}>
                {(category) => (
                    <div class="announcement-category">
                    <h3 style="color: black; border-bottom: 3px solid black; padding-bottom: 0.5rem; margin-bottom: 1.5rem; font-family: 'Arial Black', sans-serif; font-size: 1.5rem; text-transform: uppercase;">
                        {category}
                    </h3>
                    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                        <For each={groupedAnnouncements()[category]}>
                        {(post) => (
                            <div class="bulletin-entry announcement-card" style="height: auto; min-height: auto;">
                                <div class="entry-header">
                                    <h1 class="entry-title" style="color: black; font-size: 1.2rem;">{post.title}</h1>
                                    <span class="entry-content">
                                    <p class="entry-content-time" style="font-size: 0.8rem; font-weight: bold; margin: 0; color: #555;">
                                        {post.date || "Update"}
                                    </p>
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

      </Show>

      {/* --- NEW: LIGHTBOX MODAL --- */}
      <Show when={selectedImage()}>
        <div 
            class="image-modal-overlay" 
            onClick={() => setSelectedImage(null)} // Click outside to close
        >
            <div 
                class="image-modal-content" 
                onClick={(e) => e.stopPropagation()} // Prevent click from closing when clicking image
            >
                <button 
                    class="modal-close-btn" 
                    onClick={() => setSelectedImage(null)}
                >
                    &times;
                </button>
                
                <img 
                    src={selectedImage()?.url} 
                    alt="Full view" 
                    class="image-modal-img"
                />
                
                {/* DOWNLOAD BUTTON: Force download param '=d' */}
                <a 
                    href={selectedImage()?.url.replace('=s1000', '=d')} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    class="modal-download-btn"
                >
                    <span style="font-size: 1.2em;">⬇</span> Download
                </a>
            </div>
        </div>
      </Show>

    </main>
  );
}