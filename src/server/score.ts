import { google } from "googleapis";
import { getRequestEvent } from "solid-js/web";

// --- CONFIGURATION ---
const SPREADSHEET_ID = "11AtJle3iUOc1tD0Pcpf2UvSY9dtf4VqNEp0ZIdRNbCo";
const GALLERY_FOLDER_ID = "1aBiJh1VX5Jxwi4VXlSTDvhfSsi44FbAN"; 

const MATCH_RESULTS_RANGE = "Match_Results!A2:F"; 
const OVERALL_RANGE = "Overall_Standings!A2:C"; 
const ANNOUNCEMENTS_RANGE = "Announcements!A2:D"; 
const SCHEDULE_RANGE = "Schedule!A:H"; // Fetch entire sheet to keep row indices correct

const privateKey = process.env.GOOGLE_PRIVATE_KEY;
const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;

const serviceAccount = {
  client_email: clientEmail || '',
  private_key: privateKey ? privateKey.replace(/\\n/g, '\n') : undefined,
};

// --- TYPES ---
export type SubEvent = {
  round: string;
  division: string;
  match: string;
  time: string;
  loc: string;
};

// --- PARSER HELPERS ---

// Helper to safely get cell data from a row array
const getVal = (row: any[], index: number) => {
  return row && row[index] ? String(row[index]).replace(/^"|"$/g, '').trim() : "";
};

// Helper to parse a standard match row
const parseMatchRow = (row: any[], defaultDiv: string = ""): SubEvent | null => {
  // Column Mapping:
  // Col 0: Round | Col 1: Div | Col 2: Team A | Col 4: Team B | Col 5: Time | Col 6: Venue
  
  const r_round = getVal(row, 0);
  const div = getVal(row, 1) || defaultDiv;
  const t1 = getVal(row, 2);
  const t2 = getVal(row, 4); // Skip col 3 ("vs")
  const time = getVal(row, 5);
  const venue = getVal(row, 6);

  if (!t1 || !t2) return null;

  return {
    round: r_round,
    division: div,
    match: `${t1} vs ${t2}`,
    time: time,
    loc: venue
  };
};

// Main Parsing Function
const parseScheduleFromRows = (rows: any[][]) => {
  const events: Record<string, SubEvent[]> = {};

  // 1. Basketball Boys (Rows 1-7 in Excel = Indices 1-7 in Array)
  events['bball-boys'] = [];
  for (let i = 1; i <= 7; i++) {
    const data = parseMatchRow(rows[i] || []);
    if (data) events['bball-boys'].push(data);
  }

  // 2. Basketball Girls (Rows 10-15)
  events['bball-girls'] = [];
  for (let i = 10; i <= 15; i++) {
    const data = parseMatchRow(rows[i] || []);
    if (data) events['bball-girls'].push(data);
  }

  // 3. Volleyball (Rows 19-31)
  events['volleyball'] = [];
  for (let i = 19; i <= 31; i++) {
    const data = parseMatchRow(rows[i] || []);
    if (data) events['volleyball'].push(data);
  }

  // 4. Tug of War (Rows 35-46)
  events['tug-of-war'] = [];
  for (let i = 35; i <= 46; i++) {
    const data = parseMatchRow(rows[i] || []);
    if (data) events['tug-of-war'].push(data);
  }

  // 5. Frisbee (Boys: 50-55, Girls: 59-64)
  events['frisbee'] = [];
  for (let i = 50; i <= 55; i++) {
    const data = parseMatchRow(rows[i] || [], "Boys");
    if (data) events['frisbee'].push(data);
  }
  for (let i = 59; i <= 64; i++) {
    const data = parseMatchRow(rows[i] || [], "Girls");
    if (data) events['frisbee'].push(data);
  }

  // 6. Swimming (Rows 69-78)
  events['swimming'] = [];
  for (let i = 69; i <= 78; i++) {
    const row = rows[i] || [];
    const eventName = getVal(row, 0); 
    const div = getVal(row, 1);       
    if (eventName) {
      events['swimming'].push({
        round: "",
        division: div,
        match: `${eventName} (${div})`,
        time: "See Schedule",
        loc: "Swimming Pool"
      });
    }
  }

  // 7. Table Tennis (Rows 82-99)
  events['table-tennis'] = [];
  for (let i = 82; i <= 99; i++) {
    const data = parseMatchRow(rows[i] || []);
    if (data) events['table-tennis'].push(data);
  }

  // 8. Badminton (Rows 103-120)
  events['badminton'] = [];
  for (let i = 103; i <= 120; i++) {
    const data = parseMatchRow(rows[i] || []);
    if (data) events['badminton'].push(data);
  }

  // 9. Dodgeball (Rows 124-135)
  events['dodgeball'] = [];
  for (let i = 124; i <= 135; i++) {
    const data = parseMatchRow(rows[i] || []);
    if (data) events['dodgeball'].push(data);
  }

  // Fill empty "Round" cells downwards
  Object.values(events).forEach(eventList => {
    let lastRound = "";
    eventList.forEach(item => {
      if (item.round) lastRound = item.round;
      else item.round = lastRound;
    });
  });

  return events;
};

// --- MAIN SERVER ACTION ---
export async function getSheetData(_t?: number) {
  "use server";
  
  const event = getRequestEvent();
  if (event) {
    event.response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  }

  if (!serviceAccount.private_key || !serviceAccount.client_email) {
    console.error("[SERVER] ❌ CRITICAL: Google Credentials missing.");
    return { matchRows: [], overallRows: [], announcements: [], galleryImages: [], scheduleData: {} };
  }

  console.log(`[SERVER] 🚀 Fetching Gallery, Scores & Schedule...`);

  try {
    const auth = new google.auth.JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets.readonly",
        "https://www.googleapis.com/auth/drive.readonly"
      ],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const drive = google.drive({ version: "v3", auth });

    const [matchResponse, overallResponse, announceResponse, scheduleResponse, driveResponse] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: MATCH_RESULTS_RANGE }),
      sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: OVERALL_RANGE }),
      sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: ANNOUNCEMENTS_RANGE }),
      sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: SCHEDULE_RANGE }), 
      drive.files.list({
        q: `'${GALLERY_FOLDER_ID}' in parents and trashed = false and mimeType contains 'image/'`,
        fields: "files(id, name, webContentLink)",
        pageSize: 50,
        orderBy: "createdTime desc"
      })
    ]);

    const matchRows = matchResponse.data.values || [];
    const overallRows = overallResponse.data.values || [];
    const announcements = announceResponse.data.values || [];
    const scheduleRows = scheduleResponse.data.values || [];
    
    // Parse the schedule rows into structured data
    const scheduleData = parseScheduleFromRows(scheduleRows);

    const galleryImages = (driveResponse.data.files || []).map(file => ({
      id: file.id,
      // FIX 1: Added '$' before {file.id}
      // FIX 2: Switched to the reliable Drive thumbnail endpoint (&sz=w1000 sets width to 1000px)
      url: `https://drive.google.com/thumbnail?id=${file.id}&sz=w1000`, 
      name: file.name
    }));
    
    console.log(`[SERVER] ✅ Loaded data + ${galleryImages.length} photos.`);

    return { matchRows, overallRows, announcements, galleryImages, scheduleData };
  } catch (error) {
    console.error("[SERVER] ❌ CONNECTION FAILED:", error);
    return { matchRows: [], overallRows: [], announcements: [], galleryImages: [], scheduleData: {} };
  }
}