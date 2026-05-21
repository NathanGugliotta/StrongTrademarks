// USPTO TSDR (Trademark Status & Document Retrieval) API client.
//
// Docs: https://tsdr.uspto.gov/documentation/api/
// Endpoint we use: GET https://tsdrapi.uspto.gov/ts/cd/casestatus/sn<serial>/info.json
// Auth: USPTO-API-KEY header (free key from developer.uspto.gov)
//
// The JSON payload is large; we only extract what we need: current case
// status text + the prosecution history (list of events with code,
// description, date). Schema is light-touch because USPTO occasionally
// adjusts field names — we read defensively.

type RawEvent = {
  code?: string;
  description?: string;
  date?: string;
  type?: string;
};

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

/**
 * Fetch the current TSDR snapshot for a given USPTO serial number.
 *
 * Returns:
 *   - { ok: true, snapshot } on success
 *   - { ok: false, reason } on transport / parsing failure
 *
 * Caller handles persistence + idempotency. The function itself is
 * stateless.
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
    response = await fetch(`${TSDR_BASE}/sn${cleaned}/info.json`, {
      headers: {
        "USPTO-API-KEY": key,
        Accept: "application/json",
      },
      // Short-ish timeout so a hung USPTO request doesn't burn the
      // serverless function's whole budget.
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

  let json: unknown;
  try {
    json = await response.json();
  } catch (err) {
    return {
      ok: false,
      reason:
        err instanceof Error
          ? `JSON parse failed: ${err.message}`
          : "JSON parse failed",
    };
  }

  return { ok: true, snapshot: parseSnapshot(json) };
}

/**
 * Walk the TSDR JSON payload and pull out current status + events.
 *
 * TSDR returns a deeply nested envelope. The fields we care about appear
 * under different paths depending on the API version; we try several.
 */
function parseSnapshot(json: unknown): TsdrSnapshot {
  const root = (json ?? {}) as Record<string, unknown>;

  // The envelope is typically:
  //   { trademarks: [ { status: {...}, prosecutionHistory: { ... } } ] }
  // or a flat case-file object. Try both.
  const tm =
    (Array.isArray(root.trademarks) && root.trademarks[0]) ||
    (Array.isArray(root.caseFile) && root.caseFile[0]) ||
    root;
  const node = (tm ?? {}) as Record<string, unknown>;

  const status =
    pickString(node, ["status", "caseStatus"], "status") ??
    pickString(node, ["status"], "statusDescription") ??
    pickString(node, ["statusInformation"], "statusDescriptionText") ??
    null;

  // Prosecution history paths we've seen:
  //   trademarks[].prosecutionHistory.events[]
  //   trademarks[].prosecutionHistoryBag.prosecutionHistory[]
  //   caseFile[].prosecutionHistoryEvents.event[]
  const history =
    pickArray(node, ["prosecutionHistory", "events"]) ??
    pickArray(node, ["prosecutionHistoryBag", "prosecutionHistory"]) ??
    pickArray(node, ["prosecutionHistoryEvents", "event"]) ??
    pickArray(node, ["events"]) ??
    [];

  const events: TsdrEvent[] = [];
  for (const raw of history) {
    const e = (raw ?? {}) as RawEvent;
    const code = String(e.code ?? e.type ?? "").trim();
    const description = String(e.description ?? "").trim();
    const date = normalizeDate(e.date);
    if (!code || !date) continue;
    events.push({ code, description: description || code, date });
  }

  // Sort oldest → newest for stable consumption downstream.
  events.sort((a, b) => a.date.localeCompare(b.date));

  return { currentStatus: status, events };
}

function pickString(
  node: Record<string, unknown>,
  path: string[],
  finalKey: string,
): string | null {
  let cur: unknown = node;
  for (const k of path) {
    if (!cur || typeof cur !== "object") return null;
    cur = (cur as Record<string, unknown>)[k];
  }
  if (!cur || typeof cur !== "object") return null;
  const v = (cur as Record<string, unknown>)[finalKey];
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  return null;
}

function pickArray(
  node: Record<string, unknown>,
  path: string[],
): unknown[] | null {
  let cur: unknown = node;
  for (const k of path) {
    if (!cur || typeof cur !== "object") return null;
    cur = (cur as Record<string, unknown>)[k];
  }
  return Array.isArray(cur) ? cur : null;
}

function normalizeDate(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Accept YYYY-MM-DD, YYYYMMDD, or YYYY-MM-DDTHH:MM:SSZ
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const compact = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  return null;
}
