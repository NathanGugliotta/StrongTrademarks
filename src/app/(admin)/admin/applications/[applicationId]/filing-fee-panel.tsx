"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Receipt } from "lucide-react";
import { formatCents } from "@/lib/utils";
import { issueFilingFeeInvoice } from "./filing-fee-actions";

type FilingFeePayment = {
  id: string;
  amountCents: number;
  status: string;
  createdAt: Date;
};

const DEFAULT_PER_CLASS_CENTS = 35000;

export function FilingFeePanel({
  applicationId,
  classCount,
  payments,
}: {
  applicationId: string;
  classCount: number;
  payments: FilingFeePayment[];
}) {
  const router = useRouter();
  const succeeded = payments.find((p) => p.status === "succeeded");
  const pending = payments.find((p) => p.status === "pending");

  const suggested = Math.max(1, classCount) * DEFAULT_PER_CLASS_CENTS;
  const [amountDollars, setAmountDollars] = useState(
    (suggested / 100).toFixed(2),
  );
  const [memo, setMemo] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const dollars = Number.parseFloat(amountDollars);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setError("Enter a valid dollar amount.");
      return;
    }
    const amountCents = Math.round(dollars * 100);

    setSending(true);
    try {
      const result = await issueFilingFeeInvoice({
        applicationId,
        amountCents,
        memo: memo.trim() || undefined,
      });
      if (!result.ok) {
        setError(result.error);
      } else {
        setSent(true);
        setMemo("");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      {succeeded && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm dark:border-emerald-900/60 dark:bg-emerald-950/30">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-emerald-900 dark:text-emerald-200">
              USPTO filing fee paid
            </span>
            <span className="font-mono text-emerald-900 dark:text-emerald-200">
              {formatCents(succeeded.amountCents)}
            </span>
          </div>
          <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-300">
            Paid on {succeeded.createdAt.toLocaleString()}.
          </p>
        </div>
      )}

      {pending && !succeeded && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900/60 dark:bg-amber-950/30">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-amber-900 dark:text-amber-200">
              Invoice sent — awaiting customer payment
            </span>
            <span className="font-mono text-amber-900 dark:text-amber-200">
              {formatCents(pending.amountCents)}
            </span>
          </div>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
            Invoice sent on {pending.createdAt.toLocaleString()}. The customer
            can pay via the link in the message thread.
          </p>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-3">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-zinc-500" />
          <p className="text-sm font-medium">Issue a new filing-fee invoice</p>
        </div>
        <p className="text-xs text-zinc-500">
          Default is $350 × {classCount || 1} class
          {classCount === 1 ? "" : "es"} = {formatCents(suggested)}. Adjust
          if the USPTO scope changed during review.
        </p>
        <label className="block">
          <span className="mb-1 block text-xs font-medium">Amount (USD)</span>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={amountDollars}
            onChange={(e) => setAmountDollars(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium">
            Note for the customer (optional)
          </span>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={3}
            placeholder="e.g. We're filing in classes 25 and 35, so the USPTO fee is $700."
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <button
          type="submit"
          disabled={sending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {sending ? "Sending invoice…" : "Send invoice"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {sent && (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            Invoice sent. The customer was emailed and the link is in the
            message thread.
          </p>
        )}
      </form>
    </div>
  );
}
