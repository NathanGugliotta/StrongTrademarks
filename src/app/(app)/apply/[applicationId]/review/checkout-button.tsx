"use client";

import { useState } from "react";

export function CheckoutButton({ applicationId }: { applicationId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId }),
      });
      if (!res.ok) {
        throw new Error(`Checkout failed (${res.status})`);
      }
      const data = (await res.json()) as { url: string };
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={onCheckout}
        disabled={loading}
        className="rounded-md bg-zinc-900 px-6 py-3 text-base font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {loading ? "Redirecting…" : "Pay & submit for review"}
      </button>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
