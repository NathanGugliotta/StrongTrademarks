"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, FileText } from "lucide-react";
import { signWithInAppSession } from "@/app/(app)/apply/[applicationId]/review/signature-actions";

export type SignerForBlock = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  signedAt: Date | null;
};

export type SignatureRequestForBlock = {
  id: string;
  title: string;
  status: "pending" | "fully_signed" | "voided" | string;
  bodyText: string | null;
  sourceFileUrl: string | null;
  sourceFileName: string | null;
  sourceFileMimeType: string | null;
  drivePdfUrl: string | null;
  signers: SignerForBlock[];
};

type Props = {
  request: SignatureRequestForBlock;
  /** Email of the currently signed-in user, if any. Enables in-app signing without a token. */
  viewerEmail: string | null;
  /** If true, the source preview is collapsed by default (thread context). */
  compact?: boolean;
  /**
   * When provided, this block is rendered inside the public /sign/[token]
   * page and should call this server action instead of the in-app one.
   */
  tokenSign?: {
    token: string;
    /** Email of the signer the token resolves to (for the in-form heading). */
    signerEmail: string;
    /** Server action that records the signature for this token. */
    onSign: (signature: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  };
};

export function SignatureRequestBlock({
  request,
  viewerEmail,
  compact,
  tokenSign,
}: Props) {
  const [expanded, setExpanded] = useState(!compact);
  const matchedSigner = viewerEmail
    ? request.signers.find(
        (s) => s.email.toLowerCase() === viewerEmail.toLowerCase(),
      ) ?? null
    : null;

  const canSignInApp =
    request.status === "pending" && matchedSigner && !matchedSigner.signedAt && !tokenSign;
  const canSignWithToken =
    request.status === "pending" && Boolean(tokenSign);

  const signedCount = request.signers.filter((s) => s.signedAt).length;

  return (
    <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <FileText className="h-4 w-4 text-zinc-500" />
            <span className="font-medium">{request.title}</span>
            <StatusPill
              status={request.status}
              signed={signedCount}
              total={request.signers.length}
            />
          </div>
          <ul className="mt-2 flex flex-wrap gap-2 text-xs">
            {request.signers.map((s) => (
              <li
                key={s.id}
                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 ${
                  s.signedAt
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
                    : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
                }`}
              >
                {s.signedAt && <CheckCircle2 className="h-3 w-3" />}
                {s.name}
                {s.role ? ` (${s.role})` : ""}
              </li>
            ))}
          </ul>
        </div>
        {request.drivePdfUrl && (
          <a
            href={request.drivePdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-none items-center gap-1 text-xs text-zinc-700 underline dark:text-zinc-300"
          >
            Signed PDF <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {(request.bodyText || request.sourceFileUrl) && (
        <div className="mt-3">
          {!expanded ? (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="text-xs text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
            >
              Show document
            </button>
          ) : (
            <DocumentPreview request={request} />
          )}
        </div>
      )}

      {canSignInApp && matchedSigner && (
        <InAppSignForm
          requestId={request.id}
          signerId={matchedSigner.id}
          signerName={matchedSigner.name}
        />
      )}

      {canSignWithToken && tokenSign && (
        <TokenSignForm
          signerEmail={tokenSign.signerEmail}
          onSign={tokenSign.onSign}
        />
      )}

      {!tokenSign && !canSignInApp && request.status === "pending" && (
        <p className="mt-3 text-xs text-zinc-500">
          Each signer received a unique email link.
        </p>
      )}
    </div>
  );
}

function StatusPill({
  status,
  signed,
  total,
}: {
  status: string;
  signed: number;
  total: number;
}) {
  if (status === "fully_signed") {
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
        Fully signed
      </span>
    );
  }
  if (status === "voided") {
    return (
      <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
        Voided
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-300">
      Pending — {signed} of {total} signed
    </span>
  );
}

function DocumentPreview({ request }: { request: SignatureRequestForBlock }) {
  const mime = request.sourceFileMimeType?.toLowerCase() ?? "";
  const fileName = request.sourceFileName ?? "";
  const isPages =
    fileName.toLowerCase().endsWith(".pages") ||
    mime === "application/vnd.apple.pages";
  const isPdf = mime === "application/pdf";
  const isImage = mime.startsWith("image/");
  const isWebP = mime === "image/webp";

  return (
    <div className="space-y-3">
      {request.bodyText && (
        <pre className="max-h-[24rem] overflow-auto whitespace-pre-wrap rounded-md border border-zinc-200 bg-zinc-50 p-3 font-sans text-sm dark:border-zinc-800 dark:bg-zinc-900">
          {request.bodyText}
        </pre>
      )}
      {request.sourceFileUrl && (
        <div>
          {isPdf ? (
            <iframe
              src={request.sourceFileUrl}
              className="h-[40rem] w-full rounded-md border border-zinc-200 dark:border-zinc-800"
              title={request.sourceFileName ?? "PDF"}
            />
          ) : isImage && !isWebP ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={request.sourceFileUrl}
              alt={request.sourceFileName ?? "image"}
              className="max-h-[40rem] w-auto rounded-md border border-zinc-200 dark:border-zinc-800"
            />
          ) : (
            <a
              href={request.sourceFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              <FileText className="h-4 w-4" />
              Download {request.sourceFileName ?? "document"}
              {isPages && (
                <span className="text-xs text-zinc-500">
                  (.pages — requires Pages or Word to open)
                </span>
              )}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function InAppSignForm({
  requestId,
  signerId,
  signerName,
}: {
  requestId: string;
  signerId: string;
  signerName: string;
}) {
  const router = useRouter();
  const [signature, setSignature] = useState(signerName);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!signature.trim()) {
      setError("Type your name to sign.");
      return;
    }
    if (!agreed) {
      setError("Confirm you've reviewed and agree to sign.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await signWithInAppSession({
        signatureRequestId: requestId,
        signerId,
        signature: signature.trim(),
      });
      if (!r.ok) {
        setError(r.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <SignFormShell
      heading="Sign in-app"
      signature={signature}
      setSignature={setSignature}
      agreed={agreed}
      setAgreed={setAgreed}
      onSubmit={onSubmit}
      error={error}
      pending={pending}
    />
  );
}

function TokenSignForm({
  signerEmail,
  onSign,
}: {
  signerEmail: string;
  onSign: (signature: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const router = useRouter();
  const [signature, setSignature] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!signature.trim()) {
      setError("Type your name to sign.");
      return;
    }
    if (!agreed) {
      setError("Confirm you've reviewed and agree to sign.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await onSign(signature.trim());
      if (!r.ok) {
        setError(r.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <SignFormShell
      heading={`Sign as ${signerEmail}`}
      signature={signature}
      setSignature={setSignature}
      agreed={agreed}
      setAgreed={setAgreed}
      onSubmit={onSubmit}
      error={error}
      pending={pending}
    />
  );
}

function SignFormShell({
  heading,
  signature,
  setSignature,
  agreed,
  setAgreed,
  onSubmit,
  error,
  pending,
}: {
  heading: string;
  signature: string;
  setSignature: (s: string) => void;
  agreed: boolean;
  setAgreed: (b: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
  error: string | null;
  pending: boolean;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="mt-4 space-y-3 rounded-md border border-zinc-300 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900/60"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {heading}
      </p>
      <label className="block">
        <span className="mb-1 block text-xs">Type your full legal name</span>
        <input
          type="text"
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          disabled={pending}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-serif text-2xl italic dark:border-zinc-700 dark:bg-zinc-950"
          autoComplete="name"
          required
        />
      </label>
      <label className="flex items-start gap-2 text-xs">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          disabled={pending}
          className="mt-0.5"
        />
        <span>
          I have reviewed the document above and intend my typed name to be
          my legally binding electronic signature.
        </span>
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "Signing…" : "Sign"}
      </button>
    </form>
  );
}
