import { google } from "googleapis";
import { getRequestEvent } from "solid-js/web";

const SPREADSHEET_ID = "11AtJle3iUOc1tD0Pcpf2UvSY9dtf4VqNEp0ZIdRNbCo";

// --- RANGES ---
// We start from A2 to skip headers, or A1 if you want to inspect headers manually.
// Using A2 is safer for raw data arrays.
const MATCH_RESULTS_RANGE = "Match_Results!A2:E"; 
const OVERALL_RANGE = "Overall_Standings!A2:C"; 
const ANNOUNCEMENTS_RANGE = "Announcements!A2:D"; 

// --- AUTHENTICATION (Environment Variables) ---
// This safely loads credentials without crashing if they are missing
const privateKey = process.env.GOOGLE_PRIVATE_KEY;
const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;

const serviceAccount = {
  client_email: clientEmail || '',
  // This check prevents the 'reading properties of undefined' crash
  private_key: privateKey ? privateKey.replace(/\\n/g, '\n') : undefined,
};

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

  // 2. Early Exit if Credentials are Missing
  if (!serviceAccount.private_key || !serviceAccount.client_email) {
    console.error("[SERVER] ❌ CRITICAL: Google Credentials missing in Environment Variables.");
    return { matchRows: [], overallRows: [], announcements: [] };
  }

  console.log(`[SERVER] 🚀 Fetching Google Sheets... (Timestamp: ${_t})`);

  try {
    const auth = new google.auth.JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // 3. Fetch ALL 3 Ranges in Parallel
    const [matchResponse, overallResponse, announceResponse] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: MATCH_RESULTS_RANGE }),
      sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: OVERALL_RANGE }),
      sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: ANNOUNCEMENTS_RANGE })
    ]);

    const matchRows = matchResponse.data.values || [];
    const overallRows = overallResponse.data.values || [];
    // Note: Use 'announcements' key to match what your frontend expects
    const announcements = announceResponse.data.values || []; 
    
    console.log(`[SERVER] ✅ Loaded ${matchRows.length} matches, ${overallRows.length} overall, and ${announcements.length} announcements.`);

    return { matchRows, overallRows, announcements };
  } catch (error) {
    console.error("[SERVER] ❌ CONNECTION FAILED:", error);
    return { matchRows: [], overallRows: [], announcements: [] };
  }
}