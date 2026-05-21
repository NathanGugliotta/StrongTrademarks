import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { applications, attorneyReviews, messages } from "@/db/schema";
import { formatCents } from "@/lib/utils";
import { formatUsptoClass } from "@/lib/uspto-classes";
import { ReviewerPanel } from "./reviewer-panel";
import { WrapperFolderHint } from "./wrapper-folder-hint";
import { postAttorneyMessage } from "@/lib/messages";
import { markRead } from "@/lib/messages-read";
import { MessageThread } from "@/components/message-thread";
import { MessageComposer } from "@/components/message-composer";

export default async function AdminReviewPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;

  const app = await db.query.applications.findFirst({
    where: eq(applications.id, applicationId),
    with: {
      user: true,
      payments: true,
      files: true,
      reviews: {
        with: { attorney: true },
        orderBy: asc(attorneyReviews.createdAt),
      },
      messages: {
        with: { author: true },
        orderBy: asc(messages.createdAt),
      },
    },
  });
  if (!app) notFound();

  await markRead(applicationId, "attorney").catch((err) =>
    console.error("[messages-read] markRead failed:", err),
  );

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <Link href="/admin" className="text-sm text-zinc-500 hover:underline">
        ← Back to inbox
      </Link>
      <div className="mt-2 flex items-center justify-between">
        <div>
          <div className="font-mono text-sm text-zinc-500">
            {app.docketNumber ?? "Docket pending"}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {app.markText ?? "Untitled mark"}
          </h1>
        </div>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium capitalize dark:bg-zinc-800">
          {app.status.replace(/_/g, " ")}
        </span>
      </div>
      <p className="mt-2 text-sm text-zinc-500">
        Submitted by{" "}
        {app.user?.name ?? app.user?.email ?? app.contactName ?? app.contactEmail ?? "—"}
        {app.submittedAt && ` on ${app.submittedAt.toLocaleString()}`}
      </p>

      {app.docketNumber && (
        <WrapperFolderHint
          docket={app.docketNumber}
          contactName={app.contactName ?? ""}
          markText={app.markText ?? ""}
        />
      )}

      <div className="mt-10 grid gap-8 sm:grid-cols-2">
        <Section title="Mark">
          <Row label="Type" value={app.markType ?? "—"} />
          <Row label="Text" value={app.markText ?? "—"} />
          {app.markDescription && (
            <Row label="Description" value={app.markDescription} />
          )}
        </Section>

        <Section title="Owner">
          <Row label="Name" value={app.ownerName ?? "—"} />
          <Row label="Entity" value={app.ownerEntityType ?? "—"} />
          {app.ownerAddress && (
            <Row
              label="Address"
              value={`${app.ownerAddress.line1}${app.ownerAddress.line2 ? `, ${app.ownerAddress.line2}` : ""}, ${app.ownerAddress.city}, ${app.ownerAddress.state} ${app.ownerAddress.postalCode}, ${app.ownerAddress.country}`}
            />
          )}
        </Section>

        <Section title="Filing">
          <Row
            label="Basis"
            value={
              app.filingBasis === "use"
                ? "Use in commerce (1a)"
                : app.filingBasis === "intent_to_use"
                  ? "Intent to use (1b)"
                  : "—"
            }
          />
        </Section>

        <Section title="Payment">
          {app.payments.length === 0 ? (
            <p className="text-sm text-zinc-500">No payment recorded.</p>
          ) : (
            app.payments.map((p) => (
              <div key={p.id} className="text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Amount</span>
                  <span>{formatCents(p.amountCents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Status</span>
                  <span className="capitalize">{p.status}</span>
                </div>
              </div>
            ))
          )}
        </Section>
      </div>

      <Section title="Goods & services" className="mt-10">
        {app.goodsServices && app.goodsServices.length > 0 ? (
          <ul className="space-y-3 text-sm">
            {app.goodsServices.map((g, i) => (
              <li
                key={i}
                className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <div className="font-medium">{formatUsptoClass(g.class)}</div>
                <div className="mt-1 text-zinc-600 dark:text-zinc-400">
                  {g.description}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">No goods/services listed.</p>
        )}
      </Section>

      <Section title="Specimens & drawings" className="mt-10">
        {app.files.length === 0 ? (
          <p className="text-sm text-zinc-500">No files uploaded.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {app.files.map((f) => (
              <li
                key={f.id}
                className="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800"
              >
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  {f.mimeType.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={f.url}
                      alt={f.kind}
                      className="aspect-video w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-video items-center justify-center bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-900">
                      {f.mimeType}
                    </div>
                  )}
                  <div className="border-t border-zinc-200 p-2 text-xs dark:border-zinc-800">
                    <div className="font-medium capitalize">{f.kind}</div>
                    <div className="text-zinc-500">
                      {(f.sizeBytes / 1024).toFixed(0)} KB
                    </div>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {app.reviews.length > 0 && (
        <Section title="Review history" className="mt-10">
          <ul className="space-y-3 text-sm">
            {app.reviews.map((r) => (
              <li
                key={r.id}
                className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>
                    <span className="font-medium capitalize text-zinc-700 dark:text-zinc-300">
                      {r.status.replace(/_/g, " ")}
                    </span>
                    {" · "}
                    {r.attorney?.name ?? r.attorney?.email ?? "Attorney"}
                  </span>
                  <span>{r.createdAt.toLocaleString()}</span>
                </div>
                {r.usptoSerialNumber && (
                  <div className="mt-1 font-mono text-xs">
                    Serial: {r.usptoSerialNumber}
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
        </Section>
      )}

      <Section title="Messages" className="mt-10">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Conversation with the customer. The customer is emailed whenever
          you post here.
        </p>
        <div className="mt-4">
          <MessageThread messages={app.messages} currentRole="attorney" />
        </div>
        <div className="mt-6">
          <MessageComposer
            onSend={postAttorneyMessage.bind(null, applicationId)}
            placeholder="Reply to the customer…"
          />
        </div>
      </Section>

      <ReviewerPanel
        applicationId={app.id}
        applicationStatus={app.status}
      />
    </div>
  );
}

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </h2>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
