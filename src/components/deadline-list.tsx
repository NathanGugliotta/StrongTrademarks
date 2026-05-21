import { Calendar, Check } from "lucide-react";
import {
  DEADLINE_KIND_LABELS,
  formatRelative,
  urgencyClass,
  type DeadlineKind,
} from "@/lib/deadlines";

export type DeadlineListItem = {
  id: string;
  kind: DeadlineKind;
  title: string;
  dueDate: string;
  completedAt: Date | null;
  notes: string | null;
};

/**
 * Read-only deadline display used on the customer-facing review page. The
 * attorney's admin panel uses its own DeadlinePanel which adds CRUD.
 */
export function DeadlineList({
  deadlines,
}: {
  deadlines: DeadlineListItem[];
}) {
  if (deadlines.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50">
        <Calendar className="mx-auto h-5 w-5" />
        <p className="mt-2">No deadlines tracked yet.</p>
      </div>
    );
  }

  const sorted = [...deadlines].sort((a, b) => {
    if (Boolean(a.completedAt) !== Boolean(b.completedAt)) {
      return a.completedAt ? 1 : -1;
    }
    return a.dueDate.localeCompare(b.dueDate);
  });

  return (
    <ul className="space-y-2">
      {sorted.map((d) => (
        <li
          key={d.id}
          className="flex items-start gap-3 rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800"
        >
          <div
            className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border ${
              d.completedAt
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
            aria-label={d.completedAt ? "Completed" : "Open"}
          >
            {d.completedAt && <Check className="h-3 w-3" />}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between gap-3">
              <span
                className={
                  d.completedAt ? "text-zinc-500 line-through" : "font-medium"
                }
              >
                {d.title}
              </span>
              <span
                className={`text-xs ${urgencyClass(d.dueDate, Boolean(d.completedAt))}`}
              >
                {d.completedAt ? "completed" : formatRelative(d.dueDate)}
              </span>
            </div>
            <div className="mt-0.5 text-xs text-zinc-500">
              {DEADLINE_KIND_LABELS[d.kind]} · {d.dueDate}
            </div>
            {d.notes && (
              <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-400">
                {d.notes}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
