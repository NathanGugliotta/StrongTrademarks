import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  MessageCircle,
  Calendar,
} from "lucide-react";
import { db } from "@/db";
import {
  applications,
  attorneyReviews,
  deadlines as deadlinesTable,
  messages,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { countUnreadFor } from "@/lib/messages-read";
import { daysUntil } from "@/lib/deadlines";

export default async function DashboardPage() {
  const user = await requireUser();
  const apps = await db.query.applications.findMany({
    where: eq(applications.userId, user.id),
    orderBy: desc(applications.updatedAt),
    with: {
      reviews: { orderBy: asc(attorneyReviews.createdAt) },
      messages: {
        columns: { id: true, authorRole: true, createdAt: true },
        orderBy: asc(messages.createdAt),
      },
      deadlines: { orderBy: asc(deadlinesTable.dueDate) },
    },
  });

  const needsAttention = apps.filter(
    (a) => a.status === "changes_requested",
  ).length;
  const totalUnread = apps.reduce(
    (sum, a) => sum + countUnreadFor("customer", a),
    0,
  );
  const upcomingDeadlines = apps
    .flatMap((a) =>
      a.deadlines
        .filter((d) => !d.completedAt)
        .map((d) => ({ ...d, app: a })),
    )
    .filter((d) => daysUntil(d.dueDate) <= 30)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">
          Your applications
        </h1>
        <Link
          href="/apply"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
        >
          New application
        </Link>
      </div>

      {needsAttention > 0 && (
        <div className="mt-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          {needsAttention === 1
            ? "1 application needs your attention — your attorney has requested changes."
            : `${needsAttention} applications need your attention — your attorney has requested changes.`}
        </div>
      )}

      {totalUnread > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
          <MessageCircle className="h-4 w-4" />
          {totalUnread === 1
            ? "1 unread message from your attorney."
            : `${totalUnread} unread messages from your attorney.`}
        </div>
      )}

      {upcomingDeadlines.length > 0 && (
        <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="flex items-center gap-2 font-semibold">
            <Calendar className="h-4 w-4" />
            Upcoming deadlines (next 30 days)
          </div>
          <ul className="mt-2 space-y-1">
            {upcomingDeadlines.map((d) => (
              <li key={d.id} className="flex justify-between gap-3">
                <Link
                  href={`/apply/${d.app.id}/review`}
                  className="hover:underline"
                >
                  {d.title}{" "}
                  <span className="text-amber-700 dark:text-amber-300">
                    ({d.app.markText ?? "Untitled"})
                  </span>
                </Link>
                <span className="font-mono text-xs">
                  {d.dueDate} · {daysUntil(d.dueDate)}d
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {apps.length === 0 ? (
        <div className="mt-12 rounded-lg border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
          <p className="text-zinc-600 dark:text-zinc-400">
            You haven&apos;t started any applications yet.
          </p>
          <Link
            href="/apply"
            className="mt-4 inline-block text-sm font-medium underline"
          >
            Start your first application →
          </Link>
        </div>
      ) : (
        <table className="mt-8 w-full text-sm">
          <thead className="border-b border-zinc-200 text-left dark:border-zinc-800">
            <tr>
              <th className="py-2 font-medium">Docket</th>
              <th className="py-2 font-medium">Mark</th>
              <th className="py-2 font-medium">Status</th>
              <th className="py-2 font-medium">USPTO serial</th>
              <th className="py-2 font-medium">Updated</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {apps.map((app) => {
              const filedReview = app.reviews.find((r) => r.status === "filed");
              const isEditable =
                app.status === "draft" || app.status === "changes_requested";
              const unread = countUnreadFor("customer", app);
              return (
                <tr
                  key={app.id}
                  className="border-b border-zinc-100 dark:border-zinc-900"
                >
                  <td className="py-3 font-mono text-xs">
                    {app.docketNumber ?? "—"}
                  </td>
                  <td className="py-3">
                    <span className="inline-flex items-center gap-2">
                      {app.markText ?? "Untitled"}
                      {unread > 0 && <UnreadBadge count={unread} />}
                    </span>
                  </td>
                  <td className="py-3">
                    <StatusPill status={app.status} />
                  </td>
                  <td className="py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {filedReview?.usptoSerialNumber ?? "—"}
                  </td>
                  <td className="py-3 text-zinc-500">
                    {app.updatedAt.toLocaleDateString()}
                  </td>
                  <td className="py-3 text-right">
                    <Link
                      href={
                        isEditable
                          ? `/apply/${app.id}`
                          : `/apply/${app.id}/review`
                      }
                      className="text-sm font-medium underline"
                    >
                      {isEditable ? "Edit" : "Open"}
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

const STATUS_STYLES: Record<
  string,
  { label: string; icon: React.ReactNode; className: string }
> = {
  draft: {
    label: "Draft",
    icon: <Clock className="h-3.5 w-3.5" />,
    className: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  },
  submitted: {
    label: "Awaiting payment",
    icon: <Clock className="h-3.5 w-3.5" />,
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  },
  paid: {
    label: "In queue",
    icon: <Clock className="h-3.5 w-3.5" />,
    className:
      "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300",
  },
  in_review: {
    label: "Under review",
    icon: <Clock className="h-3.5 w-3.5" />,
    className:
      "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300",
  },
  changes_requested: {
    label: "Changes requested",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    className:
      "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  },
  filed: {
    label: "Filed",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    className:
      "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  rejected: {
    label: "Rejected",
    icon: <XCircle className="h-3.5 w-3.5" />,
    className: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
  },
};

function UnreadBadge({ count }: { count: number }) {
  return (
    <span
      title={count === 1 ? "1 unread message" : `${count} unread messages`}
      className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white"
    >
      <MessageCircle className="h-3 w-3" />
      {count}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${style.className}`}
    >
      {style.icon}
      {style.label}
    </span>
  );
}
