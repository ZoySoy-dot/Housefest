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
      <h1>DLSU Housefest Live Feed</h1>
      
      {/* IMPROVED STATUS BAR */}
      <div style={{ 
        "background": "#222", 
        "color": status().includes("Failed") ? "#ff5555" : "#0f0", 
        "padding": "1rem", 
        "font-family": "monospace", 
        "margin-bottom": "2rem",
        "border-left": "4px solid #0f0"
      }}>
         <div>Status: <strong>{status()}</strong></div>
         <div style={{"font-size": "0.8em", "opacity": 0.7, "margin-top": "5px"}}>
           Last Check: {lastCheck()}
         </div>
      </div>

      <div class="score-display">
        {data().length === 0 ? (
          <p>Waiting for data...</p>
        ) : (
          <table style={{ width: "100%", "text-align": "left" }}>
            <thead>
              <tr style={{"background": "#f0f0f0"}}>
                <For each={data()[0]}>{(header) => <th style={{"padding": "10px"}}>{header}</th>}</For>
              </tr>
            </thead>
            <tbody>
              <For each={data().slice(1)}>
                {(row) => (
                  <tr style={{"border-bottom": "1px solid #eee"}}>
                    <For each={row}>{(cell) => <td style={{"padding": "10px"}}>{cell}</td>}</For>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
