"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { splitName } from "@/lib/docket";

export function WrapperFolderHint({
  docket,
  contactName,
  markText,
}: {
  docket: string;
  contactName: string;
  markText: string;
}) {
  const { firstName, lastName } = splitName(contactName);
  const folderName = `${lastName}, ${firstName} ${docket} (${markText})`;
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(folderName);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can fail in some browsers/contexts — fail silently.
    }
  }

  return (
    <div className="mt-4 flex items-center gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          WRAPPER folder name
        </div>
        <div className="mt-1 truncate font-mono text-xs">{folderName}</div>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy folder name"
        className="flex items-center gap-1 rounded border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-white dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5" /> Copied
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" /> Copy
          </>
        )}
      </button>
    </div>
  );
}
