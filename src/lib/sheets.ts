// Google Sheets sync for the firm's master docket spreadsheet.
//
// Tab columns (1-indexed, A through N):
//   A  Type           — we write "TM"
//   B  STATUS         — hidden in the sheet; we skip it
//   C  DOCKET DATE    — M/D/YYYY at assignment time
//   D  DOCKET         — "XX-####", computed firm-wide
//   E  TITLE / MARK   — markText
//   F  COMPANY        — ownerName when ownerEntityType is an entity
//   G  LAST NAME      — parsed from contactName
//   H  FIRST NAME     — parsed from contactName
//   I  SERIAL NO.     — filled later when attorney marks filed
//   J  FILED          — M/D/YYYY when attorney marks filed
//   K  COUNTRY        — "US" (v1 scope)
//   L  USER           — "NJG" (Nathan)
//   M  Conf. No.      — left blank (firm-internal, not ours)
//   N  Invoice        — left blank (QuickBooks invoice, separate system)
//
// Row 1 is the header. Row 2 is a manual "next available docket" hint —
// we overwrite its DOCKET cell on every assignment so the partner's
// reference value stays current automatically. New rows are appended at
// the bottom.

import { google, type sheets_v4 } from "googleapis";
import { parseDocketSequence } from "./docket";

const DOCKET_HEADER_ROWS = 2;
const TAB_NAME = "Patent filings";
const COL_DOCKET = "D";
const ROW2_DOCKET_RANGE = `'${TAB_NAME}'!D2`;

let _client: sheets_v4.Sheets | null = null;

function getCredentials(): { client_email: string; private_key: string } | null {
  const raw =
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 ??
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;

  let json: { client_email?: string; private_key?: string };
  try {
    // Accept either raw JSON or base64-encoded JSON (the latter is friendlier
    // for Vercel's single-line env vars).
    const decoded = raw.trim().startsWith("{")
      ? raw
      : Buffer.from(raw, "base64").toString("utf-8");
    json = JSON.parse(decoded);
  } catch {
    return null;
  }
  if (!json.client_email || !json.private_key) return null;
  return {
    client_email: json.client_email,
    private_key: json.private_key.replace(/\\n/g, "\n"),
  };
}

async function getSheetsClient(): Promise<sheets_v4.Sheets | null> {
  if (_client) return _client;
  const creds = getCredentials();
  if (!creds) return null;
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  _client = google.sheets({ version: "v4", auth });
  return _client;
}

function getSheetId(): string | null {
  return process.env.DOCKET_SHEET_ID ?? null;
}

/** Returns true when both the credentials and the sheet ID are present. */
export function isSheetsConfigured(): boolean {
  return Boolean(getCredentials() && getSheetId());
}

/** Read every value in the DOCKET column (column D) past the two header rows. */
async function readDocketColumn(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
): Promise<string[]> {
  const range = `'${TAB_NAME}'!${COL_DOCKET}${DOCKET_HEADER_ROWS + 1}:${COL_DOCKET}`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const rows = res.data.values ?? [];
  return rows.map((r) => String(r[0] ?? "")).filter((s) => s.length > 0);
}

/**
 * Compute the next firm-wide docket sequence by scanning the DOCKET column.
 * Takes the max numeric portion of any well-formed "XX-####" docket and adds 1.
 * Falls back to 1 if the column is empty (e.g. on a fresh sheet).
 */
export async function computeNextDocketSequence(): Promise<number | null> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSheetId();
  if (!sheets || !spreadsheetId) return null;

  const values = await readDocketColumn(sheets, spreadsheetId);
  let max = 0;
  for (const v of values) {
    const seq = parseDocketSequence(v);
    if (seq !== null && seq > max) max = seq;
  }
  return max + 1;
}

export type DocketRowInput = {
  docket: string;
  docketDate: string;
  titleMark: string;
  company: string | null;
  lastName: string;
  firstName: string;
  country: string;
  user: string;
};

/**
 * Append a new row to the docket sheet and also overwrite row-2's DOCKET cell
 * with the next-available sequence so the partner's manual hint stays
 * current. Returns the docket and the row index where it was written.
 */
export async function appendDocketRow(
  input: DocketRowInput,
  nextAvailableSequence: number,
): Promise<{ docket: string; rowIndex: number } | null> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSheetId();
  if (!sheets || !spreadsheetId) return null;

  // Build the row in exact column order. Columns we don't fill (STATUS,
  // SERIAL NO., FILED, Conf. No., Invoice) are passed as empty strings so
  // the column alignment is preserved.
  const row = [
    "TM", // A: Type
    "", // B: STATUS (hidden)
    input.docketDate, // C: DOCKET DATE
    input.docket, // D: DOCKET
    input.titleMark, // E: TITLE / MARK
    input.company ?? "", // F: COMPANY
    input.lastName, // G: LAST NAME
    input.firstName, // H: FIRST NAME
    "", // I: SERIAL NO.
    "", // J: FILED
    input.country, // K: COUNTRY
    input.user, // L: USER
    "", // M: Conf. No.
    "", // N: Invoice
  ];

  const appendRes = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${TAB_NAME}'!A:N`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });

  // The API returns the range of the newly appended row. We don't strictly
  // need the row index for callers but parsing it lets future "update by
  // docket" calls skip a re-scan.
  const updatedRange = appendRes.data.updates?.updatedRange ?? "";
  const rowMatch = updatedRange.match(/!?[A-Z]+(\d+):/);
  const rowIndex = rowMatch ? Number.parseInt(rowMatch[1], 10) : -1;

  // Keep row 2's hint current for the partner.
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: ROW2_DOCKET_RANGE,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[nextAvailableSequence]] },
  });

  return { docket: input.docket, rowIndex };
}

/**
 * Find the row whose DOCKET cell matches the given docket string.
 * Returns the 1-indexed row, or null if not found.
 */
async function findRowByDocket(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  docket: string,
): Promise<number | null> {
  const range = `'${TAB_NAME}'!${COL_DOCKET}:${COL_DOCKET}`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const rows = res.data.values ?? [];
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0] ?? "").trim() === docket.trim()) {
      return i + 1;
    }
  }
  return null;
}

/**
 * Update SERIAL NO. (column I) and FILED (column J) for the row matching
 * the given docket, used when the attorney marks an application as filed.
 */
export async function updateFiledStatus(
  docket: string,
  serialNumber: string,
  filedDate: string,
): Promise<boolean> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSheetId();
  if (!sheets || !spreadsheetId) return false;

  const row = await findRowByDocket(sheets, spreadsheetId, docket);
  if (!row) return false;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${TAB_NAME}'!I${row}:J${row}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[serialNumber, filedDate]] },
  });
  return true;
}
