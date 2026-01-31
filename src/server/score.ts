import { google } from "googleapis";
import { getRequestEvent } from "solid-js/web";

// REMOVE: import serviceAccount from "../../service-account.json"; 

const SPREADSHEET_ID = "11AtJle3iUOc1tD0Pcpf2UvSY9dtf4VqNEp0ZIdRNbCo";
const MATCH_RESULTS_RANGE = "Match_Results!A2:E"; 
const OVERALL_RANGE = "Overall_Standings!A2:C"; 

// ADD THIS: Create serviceAccount object from ENV variables
const serviceAccount = {
  client_email: process.env.GOOGLE_CLIENT_EMAIL!,
  private_key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
};

// We accept a dummy '_t' timestamp to force unique requests
export async function getSheetData(_t?: number) {
  "use server";
  
  // 1. Force No-Cache Headers (Fix for Vercel/Netlify caching)
  const event = getRequestEvent();
  if (event) {
    event.response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    event.response.headers.set("Pragma", "no-cache");
    event.response.headers.set("Expires", "0");
    event.response.headers.set("Surrogate-Control", "no-store");
  }

  console.log(`[SERVER] 🚀 Fetching Google Sheets... (Timestamp: ${_t})`);

  try {
    const auth = new google.auth.JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // Fetch both ranges in parallel
    const [matchResponse, overallResponse] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: MATCH_RESULTS_RANGE }),
      sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: OVERALL_RANGE })
    ]);

    const matchRows = matchResponse.data.values || [];
    const overallRows = overallResponse.data.values || [];
    
    console.log(`[SERVER] ✅ Loaded ${matchRows.length} match rows and ${overallRows.length} overall rows.`);

    return { matchRows, overallRows };
  } catch (error) {
    console.error("[SERVER] ❌ CONNECTION FAILED:", error);
    return { matchRows: [], overallRows: [] };
  }
}
