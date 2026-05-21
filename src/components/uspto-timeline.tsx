import { CheckCircle2, Clock, FileText } from "lucide-react";

export type TimelineEvent = {
  id: string;
  eventCode: string;
  eventDescription: string;
  eventDate: string;
  milestoneKey: string | null;
  polledAt: Date;
};

/**
 * Shared USPTO event timeline. `view="customer"` filters down to events
 * with a milestoneKey (the curated list the customer cares about);
 * `view="attorney"` shows the full prosecution history.
 */
export function UsptoTimeline({
  events,
  currentStatus,
  lastPolledAt,
  view,
}: {
  events: TimelineEvent[];
  currentStatus: string | null;
  lastPolledAt: Date | null;
  view: "customer" | "attorney";
}) {
  const filtered =
    view === "customer"
      ? events.filter((e) => e.milestoneKey !== null)
      : events;

  // Newest first for display.
  const sorted = [...filtered].sort(
    (a, b) => b.eventDate.localeCompare(a.eventDate),
  );

  if (sorted.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50">
        <Clock className="mx-auto h-5 w-5" />
        <p className="mt-2">
          {view === "customer"
            ? "No USPTO milestones yet. We'll update this page as the USPTO posts status changes."
            : "No USPTO events have been polled yet."}
        </p>
        {lastPolledAt && (
          <p className="mt-1 text-xs text-zinc-400">
            Last checked {lastPolledAt.toLocaleString()}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      {currentStatus && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/50">
          <FileText className="h-4 w-4 text-zinc-500" />
          <span className="font-medium">Current USPTO status:</span>
          <span>{currentStatus}</span>
        </div>
      )}
      <ol className="relative space-y-3 border-l border-zinc-200 pl-6 dark:border-zinc-800">
        {sorted.map((e) => (
          <li key={e.id} className="relative">
            <span className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950">
              {e.milestoneKey ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              ) : (
                <Clock className="h-3 w-3 text-zinc-400" />
              )}
            </span>
            <div className="text-sm">
              <div className="font-medium">
                {e.milestoneKey ? friendlyMilestoneLabel(e) : e.eventDescription}
              </div>
              <div className="text-xs text-zinc-500">
                {formatDateForDisplay(e.eventDate)}
                {view === "attorney" && (
                  <>
                    {" · "}
                    <span className="font-mono">{e.eventCode}</span>
                  </>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
      {lastPolledAt && (
        <p className="mt-4 text-xs text-zinc-500">
          Last checked {lastPolledAt.toLocaleString()} — we re-check daily.
        </p>
      )}
    </div>
  );
}

function friendlyMilestoneLabel(e: TimelineEvent): string {
  // Customer-facing label is whatever the cron stored as the event
  // description, but for known milestone keys we want a consistent string.
  switch (e.milestoneKey) {
    case "filed":
      return "Application received by USPTO";
    case "approved_for_pub":
      return "Approved for publication by USPTO examiner";
    case "published":
      return "Published for opposition";
    case "notice_of_allowance":
      return "Notice of Allowance issued";
    case "office_action":
      return e.eventDescription || "Office action issued by USPTO examiner";
    case "registered":
      return "Trademark registered";
    case "abandoned":
      return "Application abandoned";
    case "sou_filed":
      return "Statement of Use filed";
    default:
      return e.eventDescription;
  }
}

function formatDateForDisplay(iso: string): string {
  // Display as a calendar date in the user's locale, avoiding timezone
  // wobble that comes from `new Date("YYYY-MM-DD")` (UTC midnight).
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export const TIMELINE_NOTE_FOR_CUSTOMERS =
  "We poll the USPTO daily for status updates. Major milestones show up here within 24 hours.";
