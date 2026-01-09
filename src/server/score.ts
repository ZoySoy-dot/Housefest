import { google } from "googleapis";
import serviceAccount from "../../service-account.json"; 

const SPREADSHEET_ID = "1azrNGnHeHtJHMrA7_QfQ112STH_ogXcCQTeOzV9BRbw";
const RANGE = "Sheet1!A1:Z"; 

export async function getSheetData() {
  "use server";
  console.log("-----------------------------------------");
  console.log("[SERVER] 🚀 Attempting to connect to Google Sheets...");

  try {
    // FIX: Pass configuration as a single object
    const auth = new google.auth.JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE,
    });

    const rows = response.data.values;
    
    console.log(`[SERVER] ✅ SUCCESS! Connected.`);
    console.log(`[SERVER] Found ${rows ? rows.length : 0} rows of data.`);
    console.log("-----------------------------------------");

    return rows || [];
  } catch (error) {
    console.error("[SERVER] ❌ CONNECTION FAILED:", error);
    // Print the full error so we can see if it's a 403 or 404
    console.error(error); 
    return [];
  }
}
