"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteEmptyDrafts } from "@/app/(app)/apply/actions";

export function DeleteEmptyDraftsButton({
  count,
}: {
  count: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    if (
      !window.confirm(
        `Delete ${count} empty draft${count === 1 ? "" : "s"}? These have nothing filled in and can't be recovered.`,
      )
    )
      return;
    setPending(true);
    try {
      await deleteEmptyDrafts();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (count === 0) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex items-center gap-1 rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-red-950/40 dark:hover:text-red-300"
    >
      <Trash2 className="h-3.5 w-3.5" />
      {pending
        ? "Cleaning…"
        : `Clean up ${count} empty draft${count === 1 ? "" : "s"}`}
    </button>
  );
}
