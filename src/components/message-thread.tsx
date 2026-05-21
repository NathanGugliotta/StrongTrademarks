import { MessageCircle, ExternalLink } from "lucide-react";

export type ThreadMessage = {
  id: string;
  authorId: string | null;
  authorRole: string;
  body: string;
  createdAt: Date;
  author: { name: string | null; email: string } | null;
};

/**
 * Read-only renderer for an application's message thread. Used on both the
 * customer review page and the admin per-application page. Pair with
 * <MessageComposer> for actual posting.
 *
 * `currentRole` flags which side of the thread the viewer is on so the
 * "you" message gets a different visual treatment.
 */
export function MessageThread({
  messages,
  currentRole,
}: {
  messages: ThreadMessage[];
  currentRole: "customer" | "attorney";
}) {
  if (messages.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50">
        <MessageCircle className="mx-auto h-5 w-5" />
        <p className="mt-2">No messages yet.</p>
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {messages.map((m) => {
        const mine =
          (currentRole === "customer" && m.authorRole === "customer") ||
          (currentRole === "attorney" &&
            (m.authorRole === "attorney" || m.authorRole === "admin"));
        return (
          <li
            key={m.id}
            className={`rounded-md border p-3 text-sm ${
              mine
                ? "border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/70"
                : "border-blue-200 bg-blue-50 dark:border-blue-900/60 dark:bg-blue-950/30"
            }`}
          >
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {labelFor(m)}
              </span>
              <span>{m.createdAt.toLocaleString()}</span>
            </div>
            <div className="mt-2 whitespace-pre-wrap break-words text-zinc-800 dark:text-zinc-200">
              {renderBody(m.body)}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function labelFor(m: ThreadMessage): string {
  if (m.authorRole === "system") return "System";
  if (m.authorRole === "attorney" || m.authorRole === "admin") {
    return m.author?.name ?? m.author?.email ?? "Attorney";
  }
  return m.author?.name ?? m.author?.email ?? "Customer";
}

/**
 * Lightweight inline renderer for message bodies.
 *
 * Supports:
 *   - Markdown-style links:  [Pay here](https://...)   → styled button-link
 *   - Bare URLs:             https://...               → underlined inline link
 *
 * No other Markdown is parsed. The body is otherwise rendered as plain
 * text with whitespace preserved. Bare URLs are matched as a fallback so
 * older messages (or hand-typed links) still render clickable.
 */
function renderBody(body: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Match either [label](url) OR a bare http(s):// URL.
  const regex =
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)]+)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(body)) !== null) {
    if (match.index > lastIdx) {
      parts.push(body.substring(lastIdx, match.index));
    }
    if (match[1] && match[2]) {
      // [label](url) → styled button-link
      parts.push(
        <a
          key={`link-${key++}`}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-1.5 align-middle text-xs font-medium text-white no-underline hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {match[1]}
          <ExternalLink className="h-3 w-3" />
        </a>,
      );
    } else if (match[3]) {
      // Bare URL → underlined inline link
      parts.push(
        <a
          key={`bareurl-${key++}`}
          href={match[3]}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all underline"
        >
          {match[3]}
        </a>,
      );
    }
    lastIdx = regex.lastIndex;
  }
  if (lastIdx < body.length) {
    parts.push(body.substring(lastIdx));
  }
  return parts;
}
