// USPTO TSDR (Trademark Status & Document Retrieval) API client.
//
// Spec:    https://data.uspto.gov/swagger/index.html?urls.primaryName=TSDR%20API
// Server:  https://tsdrapi.uspto.gov/
// Endpoint we use: GET /ts/cd/casestatus/sn<serial>/info  →  ST96-compliant XML
// Auth:    USPTO-API-KEY request header. Key is requested manually from
//          teas@uspto.gov — there's no self-serve portal as of 2026-05.
//
// Note: USPTO does NOT expose a JSON variant of the case-status endpoint.
// Everything comes back as ST96 XML. We parse it with fast-xml-parser and
// walk the tree defensively, since USPTO's element naming has shifted
// between versions.

import { XMLParser } from "fast-xml-parser";

export type TsdrEvent = {
  /** USPTO event code, e.g. "MPUB" for publication. */
  code: string;
  /** Human-readable description from TSDR. */
  description: string;
  /** ISO date string (YYYY-MM-DD). */
  date: string;
};

export type TsdrSnapshot = {
  /** Current case status text from TSDR, e.g. "Published for Opposition". */
  currentStatus: string | null;
  /** Full prosecution history, oldest → newest. */
  events: TsdrEvent[];
};

const TSDR_BASE = "https://tsdrapi.uspto.gov/ts/cd/casestatus";

export function isTsdrConfigured(): boolean {
  return Boolean(process.env.USPTO_TSDR_API_KEY?.trim());
}

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true, // collapses tm:MarkEvent / ns:MarkEvent to MarkEvent
  parseTagValue: true,
  trimValues: true,
});

/**
 * Fetch the current TSDR snapshot for a given USPTO serial number.
 */
export async function fetchTsdrSnapshot(
  serialNumber: string,
): Promise<
  | { ok: true; snapshot: TsdrSnapshot }
  | { ok: false; reason: string }
> {
  const key = process.env.USPTO_TSDR_API_KEY?.trim();
  if (!key) return { ok: false, reason: "USPTO_TSDR_API_KEY not set" };
  const cleaned = serialNumber.replace(/\D/g, "");
  if (cleaned.length < 7 || cleaned.length > 9) {
    return { ok: false, reason: `Invalid serial number: ${serialNumber}` };
  }

  let response: Response;
  try {
    response = await fetch(`${TSDR_BASE}/sn${cleaned}/info`, {
      headers: {
        "USPTO-API-KEY": key,
        Accept: "application/xml",
      },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    return {
      ok: false,
      reason:
        err instanceof Error ? `Fetch failed: ${err.message}` : "Fetch failed",
    };
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return {
      ok: false,
      reason: `TSDR returned HTTP ${response.status}: ${text.slice(0, 200)}`,
    };
  }

  let xml: string;
  try {
    xml = await response.text();
  } catch (err) {
    return {
      ok: false,
      reason:
        err instanceof Error
          ? `Read body failed: ${err.message}`
          : "Read body failed",
    };
  }

  try {
    const parsed = parser.parse(xml) as unknown;
    return { ok: true, snapshot: parseSnapshot(parsed) };
  } catch (err) {
    return {
      ok: false,
      reason:
        err instanceof Error ? `XML parse failed: ${err.message}` : "XML parse failed",
    };
  }
}

/**
 * Walk the parsed XML tree and pull out (a) the current status text and
 * (b) the full prosecution-history event list. ST96 nests everything deep
 * — we do a recursive search for known leaf names instead of hardcoding
 * the path, so the parser keeps working if USPTO bumps the schema.
 */
function parseSnapshot(parsed: unknown): TsdrSnapshot {
  const events: TsdrEvent[] = [];
  let currentStatus: string | null = null;

  walk(parsed, (node) => {
    if (!isObject(node)) return;

    // Current status: try several known leaf names.
    const status =
      pickString(node, "NationalStatusDescriptionText") ??
      pickString(node, "MarkCurrentStatusExternalDescriptionText") ??
      pickString(node, "StatusDescriptionText");
    if (status && !currentStatus) currentStatus = status;

    // Event nodes — typically named MarkEvent or NationalMarkEvent. Each
    // has Code, DescriptionText, Date children (with various suffixes).
    if ("MarkEventCode" in node || "NationalMarkEventCode" in node) {
      const e = extractEvent(node);
      if (e) events.push(e);
    }
  });

  // De-dupe + sort oldest → newest.
  const seen = new Set<string>();
  const deduped: TsdrEvent[] = [];
  for (const e of events) {
    const key = `${e.code}|${e.date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(e);
  }
  deduped.sort((a, b) => a.date.localeCompare(b.date));

  return { currentStatus, events: deduped };
}

function extractEvent(node: Record<string, unknown>): TsdrEvent | null {
  const code =
    pickString(node, "MarkEventCode") ??
    pickString(node, "NationalMarkEventCode") ??
    pickString(node, "EventCode");
  const description =
    pickString(node, "MarkEventDescriptionText") ??
    pickString(node, "NationalMarkEventDescriptionText") ??
    pickString(node, "EventDescriptionText") ??
    "";
  const rawDate =
    pickString(node, "MarkEventDate") ??
    pickString(node, "NationalMarkEventDate") ??
    pickString(node, "EventDate");
  const date = rawDate ? normalizeDate(rawDate) : null;
  if (!code || !date) return null;
  return { code, description: description || code, date };
}

function walk(node: unknown, visit: (n: unknown) => void): void {
  visit(node);
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
  } else if (isObject(node)) {
    for (const value of Object.values(node)) walk(value, visit);
  }
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function pickString(
  node: Record<string, unknown>,
  key: string,
): string | null {
  const v = node[key];
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  if (typeof v === "number") return String(v);
  return null;
}

function normalizeDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Accept YYYY-MM-DD, YYYYMMDD, or YYYY-MM-DDTHH:MM:SSZ
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const compact = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  return null;
}
