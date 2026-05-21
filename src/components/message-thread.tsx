import { MessageCircle, ExternalLink, CheckCircle2 } from "lucide-react";
import { formatCents } from "@/lib/utils";
import { EmbeddedCheckoutPanel } from "./embedded-checkout";
import {
  SignatureRequestBlock,
  type SignatureRequestForBlock,
} from "./signature-request-block";

export type ThreadMessage = {
  id: string;
  authorId: string | null;
  authorRole: string;
  kind: string;
  body: string;
  paymentId: string | null;
  createdAt: Date;
  author: { name: string | null; email: string } | null;
  payment: {
    id: string;
    amountCents: number;
    status: string;
    stripeClientSecret: string | null;
  } | null;
  signatureRequest?: SignatureRequestForBlock | null;
};

/**
 * Read-only renderer for an application's message thread. Used on both the
 * customer review page and the admin per-application page. Pair with
 * <MessageComposer> for actual posting.
 *
 * `currentRole` flags which side of the thread the viewer is on so the
 * "you" message gets a different visual treatment.
 *
 * Message rendering switches on `kind`:
 *   - "filing_fee_invoice": custom render with embedded Stripe Checkout
 *     for the linked payment (or a "Paid" indicator if already succeeded)
 *   - any other kind ("text", "system", etc.): plain body with markdown
 *     link parsing
 */
export function MessageThread({
  messages,
  currentRole,
  viewerEmail,
}: {
  messages: ThreadMessage[];
  currentRole: "customer" | "attorney";
  viewerEmail?: string | null;
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

            {m.kind === "filing_fee_invoice" && m.payment && (
              <InvoiceBlock
                payment={m.payment}
                currentRole={currentRole}
              />
            )}

            {m.kind === "signature_request" && m.signatureRequest && (
              <div className="mt-3">
                <SignatureRequestBlock
                  request={m.signatureRequest}
                  viewerEmail={viewerEmail ?? null}
                  compact
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function InvoiceBlock({
  payment,
  currentRole,
}: {
  payment: NonNullable<ThreadMessage["payment"]>;
  currentRole: "customer" | "attorney";
}) {
  if (payment.status === "succeeded") {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
        <CheckCircle2 className="h-4 w-4" />
        Filing fee paid ({formatCents(payment.amountCents)})
      </div>
    );
  }
  if (payment.status === "failed") {
    return (
      <div className="mt-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
        This payment failed. Your attorney can re-issue the invoice if
        needed.
      </div>
    );
  }
  if (currentRole === "attorney") {
    return (
      <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
        Awaiting customer payment ({formatCents(payment.amountCents)}). The
        customer sees an embedded Stripe checkout here.
      </div>
    );
  }
  if (!payment.stripeClientSecret) {
    return (
      <div className="mt-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
        This invoice expired. Ask your attorney to re-issue it.
      </div>
    );
  }
  return (
    <div className="mt-3">
      <EmbeddedCheckoutPanel clientSecret={payment.stripeClientSecret} />
    </div>
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
 * text with whitespace preserved.
 */
function renderBody(body: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
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
