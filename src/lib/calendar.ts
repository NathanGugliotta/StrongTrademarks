// Google Calendar integration — adds an event to the firm's intake
// calendar whenever a new application transitions to "paid" (i.e. lands
// in the attorney review queue). Reuses the same service account that
// powers the docket sheet sync.
//
// Setup:
//   1. Create a dedicated calendar in Google Calendar (e.g. "Strong
//      Trademarks Intake"). Subscribe to it from any attorney calendar
//      that should see new matters.
//   2. In Calendar settings → Share with specific people, add the
//      service account email (same one used for the docket sheet) with
//      "Make changes to events" permission.
//   3. Grab the Calendar ID (Settings → Integrate calendar → Calendar ID)
//      — looks like "abc123@group.calendar.google.com".
//   4. Set INTAKE_CALENDAR_ID in Vercel env vars.

import { google } from "googleapis";

let _cachedClient: ReturnType<typeof google.calendar> | null = null;

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

function getCalendarClient() {
  if (_cachedClient) return _cachedClient;
  const creds = getCredentials();
  if (!creds) return null;
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  _cachedClient = google.calendar({ version: "v3", auth });
  return _cachedClient;
}

export function isCalendarConfigured(): boolean {
  return Boolean(getCredentials() && process.env.INTAKE_CALENDAR_ID);
}

export type IntakeEventInput = {
  docket: string;
  markText: string;
  customerName: string;
  customerEmail: string;
  applicationUrl: string;
};

/**
 * Add an event to the intake calendar for a new paid application.
 * The event is dated today with a short window — its purpose is to show
 * up in the attorneys' calendar feeds, not to block time.
 */
export async function addIntakeEvent(
  input: IntakeEventInput,
): Promise<{ ok: true; eventId: string } | { ok: false; reason: string }> {
  const cal = getCalendarClient();
  const calendarId = process.env.INTAKE_CALENDAR_ID;
  if (!cal || !calendarId) {
    return { ok: false, reason: "Calendar not configured" };
  }

  const now = new Date();
  const end = new Date(now.getTime() + 30 * 60 * 1000); // 30-minute event

  try {
    const res = await cal.events.insert({
      calendarId,
      requestBody: {
        summary: `Review: ${input.docket} — ${input.markText}`,
        description: [
          `New trademark application landed in the review queue.`,
          ``,
          `Docket: ${input.docket}`,
          `Mark: ${input.markText}`,
          `Customer: ${input.customerName} <${input.customerEmail}>`,
          ``,
          `Open: ${input.applicationUrl}`,
        ].join("\n"),
        start: { dateTime: now.toISOString() },
        end: { dateTime: end.toISOString() },
        reminders: {
          useDefault: false,
          overrides: [{ method: "popup", minutes: 0 }],
        },
      },
    });
    const eventId = res.data.id ?? "";
    return { ok: true, eventId };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Calendar API error",
    };
  }
}
