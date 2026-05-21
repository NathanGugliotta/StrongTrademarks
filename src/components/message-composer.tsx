"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Client-side composer for a message thread. Calls the server action passed
 * in via `onSend` — the parent route owns the action so customer-side and
 * admin-side composers can each enforce their own auth model server-side.
 */
export function MessageComposer({
  onSend,
  placeholder = "Type your message…",
  buttonLabel = "Send message",
}: {
  onSend: (
    body: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  placeholder?: string;
  buttonLabel?: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (body.trim().length === 0 || pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await onSend(body);
      if (!result.ok) {
        setError(result.error);
      } else {
        setBody("");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        rows={4}
        disabled={pending}
        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          The other side gets an email notification.
        </p>
        <button
          type="submit"
          disabled={pending || body.trim().length === 0}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pending ? "Sending…" : buttonLabel}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
