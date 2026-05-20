"use client";

import { useState } from "react";
import { HelpCircle, X } from "lucide-react";

/**
 * Small "?" button next to a field label that expands to a help panel.
 * Used to teach lay applicants the trademark terminology underlying the
 * plain-English question above, with an optional link to USPTO docs.
 */
export function HelpToggle({
  title,
  children,
  linkHref,
  linkLabel,
}: {
  title: string;
  children: React.ReactNode;
  linkHref?: string;
  linkLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className="inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Hide help" : "Show help"}
        aria-expanded={open}
        className="inline-flex items-center gap-1 align-middle text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        <HelpCircle className="h-3.5 w-3.5" />
        <span className="underline-offset-2 hover:underline">What&apos;s this?</span>
      </button>
      {open && (
        <div className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-300">
          <div className="flex items-start justify-between gap-3">
            <div className="font-semibold text-zinc-900 dark:text-zinc-100">
              {title}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close help"
              className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-2 space-y-2">{children}</div>
          {linkHref && (
            <a
              href={linkHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs font-medium underline"
            >
              {linkLabel ?? "Read more"} ↗
            </a>
          )}
        </div>
      )}
    </span>
  );
}
