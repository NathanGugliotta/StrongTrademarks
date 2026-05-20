// Google Sheets sync for the firm's master docket spreadsheet.
//
// Tab "Patent Filings" columns (1-indexed, A through N):
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
// Row 1: column headers. Row 2: the partner's manual "next available" hint
// — its DOCKET cell holds the next sequence as a bare number (e.g. 7186).
// New rows are inserted at row 3 (under row 2) so the newest matter is
// always visible without scrolling. Row 2's DOCKET cell is rewritten with
// the new "next available" on every assignment.

import { google, type sheets_v4 } from "googleapis";
import { parseDocketSequence } from "./docket";

const TAB_NAME = "Patent Filings";
const COL_DOCKET = "D";
const ROW2_DOCKET_RANGE = `'${TAB_NAME}'!D2`;

// Any "XX-####" value with a numeric portion higher than this is treated as
// a data anomaly (USPTO-serial-shaped entries pasted into the docket column,
// stray test rows, etc.) and ignored when finding the firm-wide max. The
// firm is in the 7000s as of 2026; this gives an order-of-magnitude buffer
// without ever matching 8-digit USPTO serial numbers.
const MAX_REASONABLE_DOCKET_SEQUENCE = 100_000;

let _client: sheets_v4.Sheets | null = null;
let _sheetIdNumeric: number | null = null;

function getCredentials(): { client_email: string; private_key: string } | null {
  const raw =
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 ??
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;

  let json: { client_email?: string; private_key?: string };
  try {
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

/** The numeric sheet ID (gid) for the "Patent Filings" tab. Cached after
 * first lookup. Needed for batch row-insertion requests. */
async function getTabId(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
): Promise<number | null> {
  if (_sheetIdNumeric !== null) return _sheetIdNumeric;
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(title,sheetId)",
  });
  const match = (meta.data.sheets ?? []).find(
    (s) => s.properties?.title === TAB_NAME,
  );
  if (!match?.properties?.sheetId && match?.properties?.sheetId !== 0)
    return null;
  _sheetIdNumeric = match.properties.sheetId ?? null;
  return _sheetIdNumeric;
}

export function isSheetsConfigured(): boolean {
  return Boolean(getCredentials() && getSheetId());
}

/** Read column D in its entirety, including rows 1 and 2. */
async function readDocketColumn(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
): Promise<string[]> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${TAB_NAME}'!${COL_DOCKET}:${COL_DOCKET}`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  return (res.data.values ?? []).map((r) => String(r[0] ?? ""));
}

/**
 * Compute the next firm-wide docket sequence.
 *
 * Strategy:
 *   1. Read row 2 ("next available" hint maintained manually by the partner).
 *      In steady state this is the authoritative number.
 *   2. Scan column D for "XX-####" rows that are also < MAX_REASONABLE_DOCKET_SEQUENCE,
 *      to defend against pathological data (the sheet has at least one row
 *      with `CV-25113555` that's not a real docket).
 *   3. Return max(rowTwoHint, sanitizedColumnMax + 1) so we still advance
 *      correctly if dad added a row manually but forgot to update row 2.
 */
export async function computeNextDocketSequence(): Promise<number | null> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSheetId();
  if (!sheets || !spreadsheetId) return null;

  const column = await readDocketColumn(sheets, spreadsheetId);

  // Row 2 hint
  const rowTwoRaw = column[1] ?? ""; // 0-indexed: row 2
  const rowTwoHint = Number.parseInt(String(rowTwoRaw), 10);

  // Sanitized max of all "XX-####" entries past row 2 (skip header + hint row)
  let columnMax = 0;
  for (let i = 2; i < column.length; i++) {
    const seq = parseDocketSequence(column[i]);
    if (seq !== null && seq > columnMax && seq <= MAX_REASONABLE_DOCKET_SEQUENCE) {
      columnMax = seq;
    }
  }

  const fromHint = Number.isFinite(rowTwoHint) && rowTwoHint > 0 ? rowTwoHint : 0;
  const fromColumn = columnMax > 0 ? columnMax + 1 : 0;
  const next = Math.max(fromHint, fromColumn);
  if (next === 0) return 1; // empty sheet fallback
  return next;
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
 * Insert a new docket row at row 3 (immediately under the row-2 hint),
 * and update row 2's DOCKET cell with the next-available sequence so the
 * partner's manual reference stays current automatically.
 *
 * Uses spreadsheets.batchUpdate with insertDimension + paste-values rather
 * than `values.append` (which puts rows at the bottom of the table).
 */
export async function appendDocketRow(
  input: DocketRowInput,
  nextAvailableSequence: number,
): Promise<{ docket: string; rowIndex: number } | null> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSheetId();
  if (!sheets || !spreadsheetId) return null;

  const tabId = await getTabId(sheets, spreadsheetId);
  if (tabId === null) {
    console.error(`[sheets] Could not find tab "${TAB_NAME}" in spreadsheet`);
    return null;
  }

  const rowValues = [
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

  // Insert a blank row at index 2 (0-indexed) — i.e. row 3 (1-indexed),
  // shifting everything else down. Then write our values into that row.
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          insertDimension: {
            range: {
              sheetId: tabId,
              dimension: "ROWS",
              startIndex: 2,
              endIndex: 3,
            },
            inheritFromBefore: false,
          },
        },
      ],
    },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${TAB_NAME}'!A3:N3`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [rowValues] },
  });

  // Update row 2's "next available" pointer.
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: ROW2_DOCKET_RANGE,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[nextAvailableSequence]] },
  });

  return { docket: input.docket, rowIndex: 3 };
}

/** Find the row whose DOCKET cell matches the given docket string (1-indexed). */
async function findRowByDocket(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  docket: string,
): Promise<number | null> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${TAB_NAME}'!${COL_DOCKET}:${COL_DOCKET}`,
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
