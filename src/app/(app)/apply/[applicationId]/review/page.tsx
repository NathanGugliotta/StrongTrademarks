import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, asc } from "drizzle-orm";
import { CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";
import { db } from "@/db";
import {
  applications,
  attorneyReviews,
  deadlines as deadlinesTable,
  messages,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { formatCents } from "@/lib/utils";
import { CheckoutForm } from "./checkout-form";
import { canViewApplication } from "../../actions";
import { formatUsptoClass } from "@/lib/uspto-classes";
import {
  renderEngagementLetter,
  type EngagementLetterData,
} from "@/lib/engagement-letter";
import { formatSheetDate } from "@/lib/docket";
import { postCustomerMessage } from "@/lib/messages";
import { markRead } from "@/lib/messages-read";
import { MessageThread } from "@/components/message-thread";
import { MessageComposer } from "@/components/message-composer";
import { DeadlineList } from "@/components/deadline-list";
import { AttorneyDocumentList } from "@/components/attorney-document-list";
import { CustomerDocumentUploader } from "@/components/customer-document-uploader";

const FEE_CENTS = Number(process.env.TRADEMARK_FEE_CENTS ?? 49900);
const USPTO_FEE_CENTS_PER_CLASS = 35000; // TEAS Base, per class

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;

  if (!(await canViewApplication(applicationId))) {
    notFound();
  }
  const user = await getCurrentUser();

  const app = await db.query.applications.findFirst({
    where: eq(applications.id, applicationId),
    with: {
      reviews: { orderBy: asc(attorneyReviews.createdAt) },
      messages: {
        orderBy: asc(messages.createdAt),
        with: { author: true, payment: true },
      },
      deadlines: { orderBy: asc(deadlinesTable.dueDate) },
      files: true,
    },
  });
  if (!app) notFound();

  // Viewing the review page = viewing the message thread on it, so the
  // customer's unread badge for this application clears next time the
  // dashboard is loaded. Failures are non-fatal — at worst the badge
  // stays slightly stale.
  await markRead(applicationId, "customer").catch((err) =>
    console.error("[messages-read] markRead failed:", err),
  );

  const classCount = app.goodsServices?.length ?? 0;
  const ourFeeTotal = FEE_CENTS * classCount;
  const usptoFeeTotal = USPTO_FEE_CENTS_PER_CLASS * classCount;

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
        href={user ? "/dashboard" : "/"}
        className="text-sm text-zinc-500 hover:underline"
      >
        ← {user ? "Back to dashboard" : "Back to home"}
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
              ? "Use in commerce (1(a))"
              : app.filingBasis === "intent_to_use"
                ? "Intent to use (1(b))"
                : "—"
          }
        />
        <SummaryRow
          label="Classes"
          value={
            app.goodsServices && app.goodsServices.length > 0
              ? app.goodsServices
                  .map((g) => formatUsptoClass(g.class))
                  .join(", ")
              : "—"
          }
        />
      </dl>

      {needsPayment && (
        <>
          <section className="mt-8 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
            <h2 className="text-lg font-semibold">Fees</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <FeeRow
                label={`Attorney review & filing (${formatCents(FEE_CENTS)} × ${classCount})`}
                value={formatCents(ourFeeTotal)}
              />
              <FeeRow
                label={`USPTO filing fee (${formatCents(USPTO_FEE_CENTS_PER_CLASS)} × ${classCount})`}
                value={formatCents(usptoFeeTotal)}
                muted
                note="Paid directly to the USPTO at filing"
              />
            </dl>
            <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-4 text-sm font-semibold dark:border-zinc-800">
              <span>Today&apos;s total</span>
              <span className="font-mono">{formatCents(ourFeeTotal)}</span>
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              Additional USPTO fees may apply if your goods/services
              descriptions require custom (free-form) language ($200/class) or
              exceed 1,000 characters per class ($200 per additional 1,000
              characters), or if the application is incomplete in places that
              trigger the $100/class insufficient-information fee. Your
              attorney will flag any of these during review.
            </p>
          </section>

          <section className="mt-8 rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-sm dark:border-zinc-800 dark:bg-zinc-900/50">
            <p className="font-medium">
              One last check before you pay
            </p>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              You&apos;re about to retain Gugliotta &amp; Gugliotta, LPA
              under our flat-fee, limited-scope service. We prepare and
              file your application, but we don&apos;t handle office action
              responses or full litigation under this fee. If you&apos;d
              prefer a full attorney consultation instead (even now!) you
              can stop here and{" "}
              <Link href="/consult" className="underline">
                talk to an attorney
              </Link>{" "}
              about your matter at the firm&apos;s standard rates. By
              continuing, you&apos;re acknowledging this is the service you
              want.
            </p>
          </section>

          <EngagementLetterBlock applicationId={applicationId} app={app} />

          <DeclarationBlock
            applicationId={applicationId}
            basis={app.filingBasis}
            classCount={classCount}
            ourFeeTotal={ourFeeTotal}
          />
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

      {app.files.some((f) => f.uploadedByRole === "attorney") && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold">Documents from your attorney</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Filing receipts, office actions, registration certificates, and
            other USPTO correspondence your attorney has shared.
          </p>
          <div className="mt-4">
            <AttorneyDocumentList
              documents={app.files
                .filter((f) => f.uploadedByRole === "attorney")
                .map((f) => ({
                  id: f.id,
                  kind: f.kind as
                    | "filing_receipt"
                    | "office_action"
                    | "office_action_response"
                    | "registration_certificate"
                    | "correspondence"
                    | "other",
                  title: f.title,
                  url: f.url,
                  mimeType: f.mimeType,
                  sizeBytes: f.sizeBytes,
                  createdAt: f.createdAt,
                }))}
            />
          </div>
        </section>
      )}

      {app.deadlines.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold">Deadlines</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Key dates your attorney is tracking on this application.
          </p>
          <div className="mt-4">
            <DeadlineList deadlines={app.deadlines} />
          </div>
        </section>
      )}

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Send a document</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          If your attorney asks for a substitute specimen or other
          supporting document, upload it here.
        </p>
        <div className="mt-4">
          <CustomerDocumentUploader
            applicationId={applicationId}
            existingFiles={app.files
              .filter((f) => f.uploadedByRole === "customer")
              .map((f) => ({
                id: f.id,
                url: f.url,
                mimeType: f.mimeType,
              }))}
          />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Messages</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Ask your attorney a question, share more context about your mark,
          or follow up after a status change. You&apos;ll get an email when
          they respond.
        </p>
        <div className="mt-4">
          <MessageThread
            messages={app.messages}
            currentRole="customer"
          />
        </div>
        <div className="mt-6">
          <MessageComposer
            onSend={postCustomerMessage.bind(null, applicationId)}
            placeholder="Write a message to your attorney…"
          />
        </div>
      </section>

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

function EngagementLetterBlock({
  applicationId,
  app,
}: {
  applicationId: string;
  app: {
    contactName: string | null;
    ownerAddress: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    } | null;
    markText: string | null;
    goodsServices: Array<{ class: string; description: string }> | null;
  };
}) {
  const data: EngagementLetterData = {
    agreementNumber: applicationId.slice(0, 8).toUpperCase(),
    agreementDate: formatSheetDate(),
    clientName: app.contactName ?? "[client name]",
    clientAddress: app.ownerAddress
      ? [
          app.ownerAddress.line1,
          app.ownerAddress.line2,
          `${app.ownerAddress.city}, ${app.ownerAddress.state} ${app.ownerAddress.postalCode}`,
          app.ownerAddress.country,
        ]
          .filter(Boolean)
          .join(", ")
      : "[client address]",
    markText: app.markText ?? "[mark]",
    goodsServicesSummary:
      app.goodsServices && app.goodsServices.length > 0
        ? app.goodsServices
            .map((g) => `Class ${g.class} (${g.description})`)
            .join("; ")
        : "[goods/services]",
    feeCents: FEE_CENTS,
  };
  const letterText = renderEngagementLetter(data);
  return (
    <section className="mt-8 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
      <h2 className="text-lg font-semibold">Engagement letter</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        This is the agreement between you and Gugliotta &amp; Gugliotta, LPA.
        Signing it (along with the USPTO declaration below) creates the
        attorney-client relationship and authorizes the firm to file your
        application.
      </p>
      <pre className="mt-4 max-h-96 overflow-y-auto whitespace-pre-wrap rounded-md border border-zinc-200 bg-zinc-50 p-4 text-xs leading-relaxed dark:border-zinc-800 dark:bg-zinc-900/50">
        {letterText}
      </pre>
    </section>
  );
}

function DeclarationBlock({
  applicationId,
  basis,
  classCount,
  ourFeeTotal,
}: {
  applicationId: string;
  basis: "use" | "intent_to_use" | null;
  classCount: number;
  ourFeeTotal: number;
}) {
  return (
    <section className="mt-8 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
      <h2 className="text-lg font-semibold">Declaration &amp; signature</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        By signing below, you&apos;re making the same declaration the USPTO
        requires for trademark applications, under penalty of perjury.
      </p>

      <div className="mt-4 space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900/50">
        {basis === "use" && (
          <>
            <p className="font-medium">
              Based on use in commerce (15 U.S.C. § 1051(a)):
            </p>
            <ul className="list-disc space-y-1 pl-5 text-zinc-700 dark:text-zinc-300">
              <li>
                You, the signatory, believe that the applicant is the owner of
                the trademark/service mark sought to be registered.
              </li>
              <li>
                The mark is in use in commerce and was in use in commerce as
                of the filing date of the application on or in connection
                with the goods/services in the application.
              </li>
              <li>
                The specimen(s) shows the mark as used on or in connection
                with the goods/services in the application.
              </li>
              <li>
                To the best of your knowledge and belief, the facts recited
                in the application are accurate.
              </li>
            </ul>
          </>
        )}
        {basis === "intent_to_use" && (
          <>
            <p className="font-medium">
              Based on intent to use (15 U.S.C. § 1051(b)):
            </p>
            <ul className="list-disc space-y-1 pl-5 text-zinc-700 dark:text-zinc-300">
              <li>
                You, the signatory, believe that the applicant is entitled to
                use the mark in commerce.
              </li>
              <li>
                The applicant has a bona fide intention to use the mark in
                commerce and had a bona fide intention to use the mark in
                commerce as of the application filing date on or in
                connection with the goods/services in the application.
              </li>
              <li>
                To the best of your knowledge and belief, the facts recited
                in the application are accurate.
              </li>
            </ul>
          </>
        )}

        <p className="pt-2">
          To the best of your knowledge and belief, no other persons,
          except, if applicable, concurrent users, have the right to use the
          mark in commerce, either in the identical form or in such near
          resemblance as to be likely, when used on or in connection with the
          goods/services of such other persons, to cause confusion or
          mistake, or to deceive.
        </p>

        <p>
          To the best of your knowledge, information, and belief, formed
          after a reasonable inquiry, the allegations and other factual
          contentions made above have evidentiary support.
        </p>

        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          You are warned that <strong>willful false statements and the like
          are punishable by fine or imprisonment, or both, under 18 U.S.C.
          § 1001</strong>, and that such willful false statements and the like
          may jeopardize the validity of the application or submission or any
          registration resulting therefrom. By signing, you declare that all
          statements made of your own knowledge are true, and all statements
          made on information and belief are believed to be true.
        </p>
      </div>

      <CheckoutForm
        applicationId={applicationId}
        classCount={classCount}
        totalCents={ourFeeTotal}
      />
    </section>
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

function FeeRow({
  label,
  value,
  muted,
  note,
}: {
  label: string;
  value: string;
  muted?: boolean;
  note?: string;
}) {
  return (
    <div>
      <div
        className={`flex justify-between ${muted ? "text-zinc-500" : ""}`}
      >
        <span>{label}</span>
        <span className="font-mono">{value}</span>
      </div>
      {note && <p className="ml-0 mt-0.5 text-xs text-zinc-500">{note}</p>}
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
