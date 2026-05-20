"use client";

import { useState } from "react";
import { formatCents } from "@/lib/utils";

export function CheckoutForm({
  applicationId,
  classCount,
  totalCents,
}: {
  applicationId: string;
  classCount: number;
  totalCents: number;
}) {
  const [agreed, setAgreed] = useState(false);
  const [signature, setSignature] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = agreed && signature.trim().length > 1 && !loading;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          signature: signature.trim(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Checkout failed (${res.status})`);
      }
      const data = (await res.json()) as { url: string };
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          required
          className="mt-1"
        />
        <span>
          I have read the declaration above and I make these statements under
          penalty of perjury under 18 U.S.C. § 1001.
        </span>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">
          Type your full legal name to sign
        </span>
        <input
          type="text"
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          required
          placeholder="e.g. Jane Q. Applicant"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-md bg-zinc-900 px-6 py-3 text-base font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {loading
          ? "Redirecting…"
          : `Sign & pay ${formatCents(totalCents)} (${classCount} class${classCount === 1 ? "" : "es"})`}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
