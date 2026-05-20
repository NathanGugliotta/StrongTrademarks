import Link from "next/link";
import { asc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { applications } from "@/db/schema";

export default async function AdminInboxPage() {
  const queue = await db.query.applications.findMany({
    where: inArray(applications.status, ["paid", "in_review"]),
    with: { user: true },
    orderBy: asc(applications.submittedAt),
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Review queue</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Paid applications awaiting attorney review, oldest first.
      </p>

      {queue.length === 0 ? (
        <p className="mt-12 text-zinc-500">No applications in the queue.</p>
      ) : (
        <table className="mt-8 w-full text-sm">
          <thead className="border-b border-zinc-200 text-left dark:border-zinc-800">
            <tr>
              <th className="py-2 font-medium">Mark</th>
              <th className="py-2 font-medium">Customer</th>
              <th className="py-2 font-medium">Status</th>
              <th className="py-2 font-medium">Submitted</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {queue.map((row) => (
              <tr
                key={row.id}
                className="border-b border-zinc-100 dark:border-zinc-900"
              >
                <td className="py-3">{row.markText ?? "Untitled"}</td>
                <td className="py-3">{row.user.name ?? row.user.email}</td>
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
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
