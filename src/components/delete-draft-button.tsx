"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteDraftApplication } from "@/app/(app)/apply/actions";

export function DeleteDraftButton({
  applicationId,
  label = "Delete draft",
  size = "sm",
  redirectTo,
}: {
  applicationId: string;
  label?: string;
  size?: "sm" | "md";
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (
      !window.confirm(
        "Delete this draft? It can't be recovered. (Already-submitted or paid applications can't be deleted from here.)",
      )
    ) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await deleteDraftApplication(applicationId);
      if (!result.ok) {
        setError(result.error);
      } else if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  const padding = size === "md" ? "px-3 py-2" : "px-2 py-1";

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className={`inline-flex items-center gap-1 rounded-md border border-zinc-300 ${padding} text-xs font-medium text-zinc-700 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-red-950/40 dark:hover:text-red-300`}
      >
        <Trash2 className="h-3.5 w-3.5" />
        {pending ? "Deleting…" : label}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
