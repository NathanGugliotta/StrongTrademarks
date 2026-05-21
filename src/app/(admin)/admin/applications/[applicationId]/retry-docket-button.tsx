"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { retryDocketAssignment } from "./actions";

/**
 * Admin-only button that re-runs docket assignment for an application
 * whose webhook attempt failed mid-flow (sheet row inserted but DB / Drive
 * never got the docket).
 */
export function RetryDocketButton({
  applicationId,
}: {
  applicationId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onClick() {
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await retryDocketAssignment(applicationId);
      if (!result.ok) {
        setError(result.error);
      } else {
        setSuccess(`Assigned ${result.docket}`);
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
      >
        <RefreshCw className="h-4 w-4" />
        {pending ? "Assigning…" : "Assign docket now"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {success && (
        <p className="text-xs text-emerald-700 dark:text-emerald-400">
          {success}
        </p>
      )}
    </div>
  );
}
