// Display helpers for application deadlines. Stored as YYYY-MM-DD strings;
// we parse to dates in the local timezone for countdown computation.

export type DeadlineKind =
  | "office_action"
  | "statement_of_use"
  | "section_8"
  | "section_9"
  | "ttab"
  | "other";

export const DEADLINE_KIND_LABELS: Record<DeadlineKind, string> = {
  office_action: "Office action response",
  statement_of_use: "Statement of use",
  section_8: "Section 8 declaration of use",
  section_9: "Section 9 renewal",
  ttab: "TTAB filing",
  other: "Other",
};

export const DEADLINE_KIND_OPTIONS: Array<{
  value: DeadlineKind;
  label: string;
  defaultTitle: string;
}> = [
  {
    value: "office_action",
    label: DEADLINE_KIND_LABELS.office_action,
    defaultTitle: "Respond to USPTO office action",
  },
  {
    value: "statement_of_use",
    label: DEADLINE_KIND_LABELS.statement_of_use,
    defaultTitle: "File statement of use",
  },
  {
    value: "section_8",
    label: DEADLINE_KIND_LABELS.section_8,
    defaultTitle: "File Section 8 declaration of use",
  },
  {
    value: "section_9",
    label: DEADLINE_KIND_LABELS.section_9,
    defaultTitle: "File Section 9 renewal",
  },
  { value: "ttab", label: DEADLINE_KIND_LABELS.ttab, defaultTitle: "TTAB filing" },
  { value: "other", label: DEADLINE_KIND_LABELS.other, defaultTitle: "" },
];

/** Days from today until the deadline. Negative if past. */
export function daysUntil(dueDate: string): number {
  const today = startOfLocalDay(new Date());
  const due = parseDateOnly(dueDate);
  const diff = due.getTime() - today.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseDateOnly(s: string): Date {
  // Treat YYYY-MM-DD as a local date so day-counts match what the user sees
  // on a calendar, not UTC midnight.
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return new Date(s);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function formatRelative(dueDate: string): string {
  const days = daysUntil(dueDate);
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  if (days > 1 && days < 14) return `due in ${days} days`;
  if (days >= 14) return `due in ${days} days`;
  if (days === -1) return "1 day overdue";
  return `${-days} days overdue`;
}

export function urgencyClass(dueDate: string, completed: boolean): string {
  if (completed) return "text-zinc-500";
  const days = daysUntil(dueDate);
  if (days < 0) return "text-red-700 dark:text-red-300";
  if (days <= 7) return "text-amber-800 dark:text-amber-300";
  return "text-zinc-700 dark:text-zinc-300";
}
