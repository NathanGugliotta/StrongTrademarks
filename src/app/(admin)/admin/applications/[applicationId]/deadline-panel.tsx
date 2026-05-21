"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Check, Trash2 } from "lucide-react";
import {
  DEADLINE_KIND_LABELS,
  DEADLINE_KIND_OPTIONS,
  formatRelative,
  urgencyClass,
  type DeadlineKind,
} from "@/lib/deadlines";
import {
  createDeadline,
  deleteDeadline,
  toggleDeadlineComplete,
} from "./deadline-actions";

type DeadlineRow = {
  id: string;
  kind: DeadlineKind;
  title: string;
  dueDate: string;
  completedAt: Date | null;
  notes: string | null;
};

export function DeadlinePanel({
  applicationId,
  deadlines: initialDeadlines,
}: {
  applicationId: string;
  deadlines: DeadlineRow[];
}) {
  const router = useRouter();
  const [kind, setKind] = useState<DeadlineKind>("office_action");
  const [title, setTitle] = useState(
    DEADLINE_KIND_OPTIONS[0].defaultTitle,
  );
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onKindChange(next: DeadlineKind) {
    setKind(next);
    const option = DEADLINE_KIND_OPTIONS.find((o) => o.value === next);
    if (option?.defaultTitle && (!title || isDefaultTitle(title))) {
      setTitle(option.defaultTitle);
    }
  }

  function isDefaultTitle(t: string): boolean {
    return DEADLINE_KIND_OPTIONS.some((o) => o.defaultTitle === t);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!dueDate) {
      setError("Pick a due date.");
      return;
    }
    setSending(true);
    try {
      const result = await createDeadline({
        applicationId,
        kind,
        title: title.trim(),
        dueDate,
        notes: notes.trim() || undefined,
      });
      if (!result.ok) {
        setError(result.error);
      } else {
        setDueDate("");
        setNotes("");
        router.refresh();
      }
    } finally {
      setSending(false);
    }
  }

  async function onToggle(id: string) {
    await toggleDeadlineComplete(id);
    router.refresh();
  }

  async function onDelete(id: string) {
    if (!window.confirm("Delete this deadline?")) return;
    await deleteDeadline(id);
    router.refresh();
  }

  const sorted = [...initialDeadlines].sort((a, b) => {
    // Open deadlines first (by ascending date), then completed at the bottom
    if (Boolean(a.completedAt) !== Boolean(b.completedAt)) {
      return a.completedAt ? 1 : -1;
    }
    return a.dueDate.localeCompare(b.dueDate);
  });

  return (
    <div className="space-y-4">
      {sorted.length > 0 ? (
        <ul className="space-y-2">
          {sorted.map((d) => (
            <li
              key={d.id}
              className="flex items-start gap-3 rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800"
            >
              <button
                type="button"
                onClick={() => onToggle(d.id)}
                aria-label={
                  d.completedAt ? "Mark as not done" : "Mark as done"
                }
                className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border ${
                  d.completedAt
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-zinc-300 dark:border-zinc-700"
                }`}
              >
                {d.completedAt && <Check className="h-3 w-3" />}
              </button>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={
                      d.completedAt
                        ? "text-zinc-500 line-through"
                        : "font-medium"
                    }
                  >
                    {d.title}
                  </span>
                  <span
                    className={`text-xs ${urgencyClass(d.dueDate, Boolean(d.completedAt))}`}
                  >
                    {d.completedAt
                      ? "completed"
                      : formatRelative(d.dueDate)}
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
              <button
                type="button"
                onClick={() => onDelete(d.id)}
                aria-label="Delete deadline"
                className="text-zinc-400 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">No deadlines yet.</p>
      )}

      <form onSubmit={onSubmit} className="space-y-3 rounded-md border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-zinc-500" />
          <p className="text-sm font-medium">Add a deadline</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium">Kind</span>
            <select
              value={kind}
              onChange={(e) => onKindChange(e.target.value as DeadlineKind)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {DEADLINE_KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium">Due date</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium">Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium">
            Notes (optional, shared with customer)
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <button
          type="submit"
          disabled={sending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {sending ? "Adding…" : "Add deadline"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </div>
  );
}
