import Link from "next/link";
import { asc, inArray } from "drizzle-orm";
import { MessageCircle } from "lucide-react";
import { db } from "@/db";
import { applications, messages } from "@/db/schema";
import { countUnreadFor } from "@/lib/messages-read";

export default async function AdminInboxPage() {
  const queue = await db.query.applications.findMany({
    where: inArray(applications.status, ["paid", "in_review"]),
    with: {
      user: true,
      messages: {
        columns: { id: true, authorRole: true, createdAt: true },
        orderBy: asc(messages.createdAt),
      },
    },
    orderBy: asc(applications.submittedAt),
  });

  const totalUnread = queue.reduce(
    (sum, a) => sum + countUnreadFor("attorney", a),
    0,
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Review queue</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Paid applications awaiting attorney review, oldest first.
      </p>

      {totalUnread > 0 && (
        <div className="mt-6 flex items-center gap-2 rounded-md border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
          <MessageCircle className="h-4 w-4" />
          {totalUnread === 1
            ? "1 unread customer message in the queue."
            : `${totalUnread} unread customer messages in the queue.`}
        </div>
      )}

      {queue.length === 0 ? (
        <p className="mt-12 text-zinc-500">No applications in the queue.</p>
      ) : (
        <table className="mt-8 w-full text-sm">
          <thead className="border-b border-zinc-200 text-left dark:border-zinc-800">
            <tr>
              <th className="py-2 font-medium">Docket</th>
              <th className="py-2 font-medium">Mark</th>
              <th className="py-2 font-medium">Customer</th>
              <th className="py-2 font-medium">Email</th>
              <th className="py-2 font-medium">Status</th>
              <th className="py-2 font-medium">Submitted</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {queue.map((row) => {
              const name = row.contactName ?? row.user?.name ?? "—";
              const email = row.contactEmail ?? row.user?.email ?? "—";
              const unread = countUnreadFor("attorney", row);
              return (
                <tr
                  key={row.id}
                  className="border-b border-zinc-100 dark:border-zinc-900"
                >
                  <td className="py-3 font-mono text-xs">
                    {row.docketNumber ?? "—"}
                  </td>
                  <td className="py-3">
                    <span className="inline-flex items-center gap-2">
                      {row.markText ?? "Untitled"}
                      {unread > 0 && (
                        <span
                          title={
                            unread === 1
                              ? "1 unread customer message"
                              : `${unread} unread customer messages`
                          }
                          className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white"
                        >
                          <MessageCircle className="h-3 w-3" />
                          {unread}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="py-3">{name}</td>
                  <td className="py-3 text-zinc-600 dark:text-zinc-400">
                    {email}
                  </td>
                  <td className="py-3 capitalize">
                    {row.status.replace(/_/g, " ")}
                  </td>
                  <td className="py-3 text-zinc-500">
                    {row.submittedAt?.toLocaleString() ?? "—"}
                  </td>
                  <td className="py-3 text-right">
                    <Link
                      href={`/admin/applications/${row.id}`}
                      className="text-sm font-medium underline"
                    >
                      Review
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
