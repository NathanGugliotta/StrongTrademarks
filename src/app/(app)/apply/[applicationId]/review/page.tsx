import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, asc } from "drizzle-orm";
import { CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";
import { db } from "@/db";
import { applications, attorneyReviews } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { formatCents } from "@/lib/utils";
import { CheckoutButton } from "./checkout-button";

const FEE_CENTS = Number(process.env.TRADEMARK_FEE_CENTS ?? 49900);

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  const user = await requireUser();

  const app = await db.query.applications.findFirst({
    where: and(
      eq(applications.id, applicationId),
      eq(applications.userId, user.id),
    ),
    with: {
      reviews: { orderBy: asc(attorneyReviews.createdAt) },
    },
  });
  if (!app) notFound();

  const needsPayment = app.status === "submitted";
  const isEditable = app.status === "changes_requested";
  const isFiled = app.status === "filed";
  const isRejected = app.status === "rejected";
  const latestFiled = [...app.reviews]
    .reverse()
    .find((r) => r.status === "filed");

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href="/dashboard"
        className="text-sm text-zinc-500 hover:underline"
      >
        ← Back to dashboard
      </Link>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        {app.markText ?? "Trademark application"}
      </h1>
      <p className="mt-2 flex items-center gap-2 text-sm">
        <StatusPill status={app.status} />
      </p>

      {isFiled && latestFiled?.usptoSerialNumber && (
        <div className="mt-6 rounded-lg border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
          <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
            Filed with the USPTO
          </p>
          <p className="mt-1 font-mono text-sm text-emerald-900 dark:text-emerald-100">
            Serial: {latestFiled.usptoSerialNumber}
          </p>
          <p className="mt-2 text-xs text-emerald-800 dark:text-emerald-300">
            We&apos;ll forward any USPTO correspondence to you.
          </p>
        </div>
      )}

      {isEditable && (
        <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Your attorney has requested changes
          </p>
          <p className="mt-2 text-sm text-amber-900/90 dark:text-amber-100">
            Open the application to address the feedback and resubmit. You
            won&apos;t be charged again.
          </p>
          <Link
            href={`/apply/${applicationId}`}
            className="mt-3 inline-block rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
          >
            Edit application
          </Link>
        </div>
      )}

      <dl className="mt-8 space-y-3 rounded-lg border border-zinc-200 p-6 text-sm dark:border-zinc-800">
        <SummaryRow label="Mark" value={app.markText ?? "—"} />
        <SummaryRow
          label="Type"
          value={app.markType?.replace(/_/g, " ") ?? "—"}
        />
        <SummaryRow label="Owner" value={app.ownerName ?? "—"} />
        <SummaryRow
          label="Filing basis"
          value={
            app.filingBasis === "use"
              ? "Use in commerce"
              : app.filingBasis === "intent_to_use"
                ? "Intent to use"
                : "—"
          }
        />
        <SummaryRow
          label="Classes"
          value={
            app.goodsServices && app.goodsServices.length > 0
              ? app.goodsServices.map((g) => g.class).join(", ")
              : "—"
          }
        />
      </dl>

      {needsPayment && (
        <>
          <div className="mt-8 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <span className="font-medium">
                Attorney review &amp; filing
              </span>
              <span className="font-mono">{formatCents(FEE_CENTS)}</span>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              USPTO government filing fee is billed separately and paid
              directly to the USPTO at filing time.
            </p>
          </div>
          <div className="mt-6">
            <CheckoutButton applicationId={applicationId} />
          </div>
        </>
      )}

      {app.reviews.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold">Attorney updates</h2>
          <ul className="mt-4 space-y-3">
            {app.reviews.map((r) => (
              <li
                key={r.id}
                className="rounded-md border border-zinc-200 p-4 text-sm dark:border-zinc-800"
              >
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <ReviewStatus status={r.status} />
                  <span>{r.createdAt.toLocaleString()}</span>
                </div>
                {r.usptoSerialNumber && (
                  <div className="mt-2 font-mono text-xs">
                    USPTO serial: {r.usptoSerialNumber}
                  </div>
                )}
                {r.notes && (
                  <p className="mt-2 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                    {r.notes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {isRejected && (
        <p className="mt-8 text-sm text-zinc-500">
          This application has been rejected. If you&apos;d like to start over
          with a revised application,{" "}
          <Link href="/apply" className="underline">
            start a new one
          </Link>
          .
        </p>
      )}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-right">{value}</dd>
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
    className:
      "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  },
  submitted: {
    label: "Awaiting payment",
    icon: <Clock className="h-3.5 w-3.5" />,
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  },
  paid: {
    label: "In attorney queue",
    icon: <Clock className="h-3.5 w-3.5" />,
    className:
      "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300",
  },
  in_review: {
    label: "Under attorney review",
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
    label: "Filed with USPTO",
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

function StatusPill({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${style.className}`}
    >
      {style.icon}
      {style.label}
    </span>
  );
}

function ReviewStatus({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "Note",
    approved: "Approved",
    changes_requested: "Changes requested",
    filed: "Filed with USPTO",
    rejected: "Rejected",
  };
  return (
    <span className="font-medium text-zinc-700 dark:text-zinc-300">
      {map[status] ?? status.replace(/_/g, " ")}
    </span>
  );
}
