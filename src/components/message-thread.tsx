import { MessageCircle } from "lucide-react";

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
            <p className="mt-2 whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">
              {m.body}
            </p>
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
