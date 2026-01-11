import { Title } from "@solidjs/meta";
import { createSignal, onMount, onCleanup, For } from "solid-js";
import { getSheetData } from "../server/score"; // Make sure path is correct
import "./index.css";

export default function Home() {
  const [data, setData] = createSignal<string[][]>([]);
  const [status, setStatus] = createSignal("Initializing...");
  const [lastCheck, setLastCheck] = createSignal("");

  const fetchData = async () => {
    // 1. Log to console that we are trying
    console.log(`[CLIENT] 📡 Ping: Checking Google Sheet at ${new Date().toLocaleTimeString()}...`);
    setStatus("Fetching updates...");

    try {
      // 2. Call server
      const sheetRows = await getSheetData();

      // 3. Log success
      if (sheetRows && sheetRows.length > 0) {
        console.log(`[CLIENT] ✅ Success! Found ${sheetRows.length} rows.`);
        setData(sheetRows);
        setStatus("✅ Connected");
      } else {
        console.warn("[CLIENT] ⚠️ Connected, but sheet is empty.");
        setStatus("⚠️ Empty Sheet");
      }
    } catch (err) {
      console.error("[CLIENT] ❌ Fetch Error:", err);
      setStatus("❌ Connection Failed");
    } finally {
      // Always update the timestamp so you know it's alive
      setLastCheck(new Date().toLocaleTimeString());
    }
  };

  onMount(async () => {
    // Initial fetch
    await fetchData();

    // Loop every 5 seconds
    const timer = setInterval(fetchData, 5000);

    onCleanup(() => clearInterval(timer));
  });

  return (
    <main>
            <Title>DLSU Housefest</Title>
      
      <header id="main-header">
        {/* Left Space (or Logo) */}
        <div id="left">
          <img src="/src/assests/SC_Logo.svg" alt="" id="SC-Logo" class="Header-Logo" />
        </div>

        {/* Center Content */}
        <div id="center">
          <h1>HOUSEFEST</h1>
          <h6>2025-2026</h6>
          
          <nav class="pill-nav">
            <a href="#Score">SCORE</a>
            <a href="#Live">
              LIVE <span class="live-dot"></span>
            </a>
            <a href="#About">INFO</a>
          </nav>
        </div>

        {/* Right Space (or Logo) */}
        <div id="right">
          <img src="/src/assests/DLSU_Logo.svg" alt="" id="DLSU-Logo" class="Header-Logo" />
        </div>
      </header>
      <section id="Score" class="score-section">
    {/* Mutien - White */}
    <div class="team-container">
      <div class="team-card mutien">
        <h1 class="placement">1ST</h1>
        <div class="bottom-stats">
          <h2 class="points">0</h2>
          <span class="points-label">POINTS</span>
        </div>
      </div>
      <h1 class="team-name">MUTIEN</h1>
    </div>

    {/* Benilde - Black */}
    <div class="team-container">
      <div class="team-card benilde">
        <h1 class="placement">1ST</h1>
        <div class="bottom-stats">
          <h2 class="points">0</h2>
          <span class="points-label">POINTS</span>
        </div>
      </div>
      <h1 class="team-name">BENILDE</h1>
    </div>

    {/* Jaime - Bright Green */}
    <div class="team-container">
      <div class="team-card jaime">
        <h1 class="placement">1ST</h1>
        <div class="bottom-stats">
          <h2 class="points">0</h2>
          <span class="points-label">POINTS</span>
        </div>
      </div>
      <h1 class="team-name">JAIME</h1>
    </div>

    {/* Miguel - Dark Green */}
    <div class="team-container">
      <div class="team-card miguel">
        <h1 class="placement">1ST</h1>
        <div class="bottom-stats">
          <h2 class="points">0</h2>
          <span class="points-label">POINTS</span>
        </div>
      </div>
      <h1 class="team-name">MIGUEL</h1>
    </div>
  </section>

    </main>
  );
}
