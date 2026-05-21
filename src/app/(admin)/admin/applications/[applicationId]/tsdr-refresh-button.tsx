"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { refreshTsdrForApplication } from "./tsdr-actions";

export function TsdrRefreshButton({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const r = await refreshTsdrForApplication(applicationId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      const s = r.summary;
      setMessage(
        s.newEvents === 0
          ? `No new events. Current status: ${s.currentStatus ?? "—"}.`
          : `Found ${s.newEvents} new event(s), ${s.newMilestones} milestone(s), ${s.newDeadlines} new deadline(s).`,
      );
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
        {pending ? "Refreshing…" : "Refresh from USPTO"}
      </button>
      {message && <span className="text-xs text-zinc-600 dark:text-zinc-400">{message}</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
