import { google } from "googleapis";
import { getRequestEvent } from "solid-js/web";

const SPREADSHEET_ID = "11AtJle3iUOc1tD0Pcpf2UvSY9dtf4VqNEp0ZIdRNbCo";
// 🔴 REPLACE THIS WITH YOUR ACTUAL GALLERY FOLDER ID
const GALLERY_FOLDER_ID = "1aBiJh1VX5Jxwi4VXlSTDvhfSsi44FbAN"; 

const MATCH_RESULTS_RANGE = "Match_Results!A2:E"; 
const OVERALL_RANGE = "Overall_Standings!A2:C"; 
const ANNOUNCEMENTS_RANGE = "Announcements!A2:D"; 

const privateKey = process.env.GOOGLE_PRIVATE_KEY;
const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;

const serviceAccount = {
  client_email: clientEmail || '',
  private_key: privateKey ? privateKey.replace(/\\n/g, '\n') : undefined,
};

export async function getSheetData(_t?: number) {
  "use server";
  
  const event = getRequestEvent();
  if (event) {
    event.response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  }

  if (!serviceAccount.private_key || !serviceAccount.client_email) {
    console.error("[SERVER] ❌ CRITICAL: Google Credentials missing.");
    return { matchRows: [], overallRows: [], announcements: [], galleryImages: [] };
  }

  console.log(`[SERVER] 🚀 Fetching Gallery & Sheets...`);

  try {
    const auth = new google.auth.JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets.readonly",
        "https://www.googleapis.com/auth/drive.readonly" // Added Drive Scope
      ],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const drive = google.drive({ version: "v3", auth });

    // Fetch Sheets + Drive Images in Parallel
    const [matchResponse, overallResponse, announceResponse, driveResponse] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: MATCH_RESULTS_RANGE }),
      sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: OVERALL_RANGE }),
      sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: ANNOUNCEMENTS_RANGE }),
      // Fetch images from the Gallery Folder
      drive.files.list({
        q: `'${GALLERY_FOLDER_ID}' in parents and trashed = false and mimeType contains 'image/'`,
        fields: "files(id, name, webContentLink)",
        pageSize: 50, // Limit to 50 newest photos
        orderBy: "createdTime desc" // Newest first
      })
    ]);

    const matchRows = matchResponse.data.values || [];
    const overallRows = overallResponse.data.values || [];
    const announcements = announceResponse.data.values || [];
    
    // Process Drive Images into a clean list
    const galleryImages = (driveResponse.data.files || []).map(file => ({
      id: file.id,
      // Use the high-speed Google CDN link logic
      url: `https://lh3.googleusercontent.com/d/${file.id}=s1000?authuser=0`, 
      name: file.name
    }));
    
    console.log(`[SERVER] ✅ Loaded ${galleryImages.length} gallery photos.`);

    return { matchRows, overallRows, announcements, galleryImages };
  } catch (error) {
    console.error("[SERVER] ❌ CONNECTION FAILED:", error);
    return { matchRows: [], overallRows: [], announcements: [], galleryImages: [] };
  }
}