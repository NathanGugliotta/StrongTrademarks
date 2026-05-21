"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, Plus, X } from "lucide-react";
import {
  SIGNATURE_TEMPLATES,
  type SignatureTemplate,
} from "@/lib/signature-templates";
import {
  SignatureSourceUploader,
  type UploadedSource,
} from "@/components/signature-source-uploader";
import {
  createSignatureRequest,
  regeneratePdfForRequest,
  voidSignatureRequest,
} from "./signature-request-actions";

type SignerView = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  signedAt: Date | null;
};

export type SignatureRequestView = {
  id: string;
  title: string;
  status: "pending" | "fully_signed" | "voided" | string;
  bodyText: string | null;
  sourceFileUrl: string | null;
  sourceFileName: string | null;
  sourceFileMimeType: string | null;
  targetSubfolderPath: string;
  drivePdfUrl: string | null;
  createdAt: Date;
  signers: SignerView[];
};

export function SignatureRequestPanel({
  applicationId,
  requests,
  subfolderPaths,
  templateVars,
}: {
  applicationId: string;
  requests: SignatureRequestView[];
  subfolderPaths: string[];
  templateVars: {
    applicantName: string;
    markText: string;
    goodsServicesSummary: string;
    attorneyName: string;
  };
}) {
  const [composing, setComposing] = useState(false);

  return (
    <div className="space-y-6">
      <ul className="space-y-3">
        {requests.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No signature requests yet.
          </p>
        ) : (
          requests.map((r) => (
            <RequestRow key={r.id} request={r} />
          ))
        )}
      </ul>

      {composing ? (
        <Composer
          applicationId={applicationId}
          subfolderPaths={subfolderPaths}
          templateVars={templateVars}
          onClose={() => setComposing(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setComposing(true)}
          className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
        >
          <Plus className="h-4 w-4" /> New signature request
        </button>
      )}
    </div>
  );
}

function RequestRow({ request }: { request: SignatureRequestView }) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signedCount = request.signers.filter((s) => s.signedAt).length;

  async function onVoid() {
    if (!window.confirm("Void this signature request? Signing links will stop working.")) return;
    setWorking(true);
    setError(null);
    const r = await voidSignatureRequest(request.id);
    setWorking(false);
    if (!r.ok) setError(r.error);
    else router.refresh();
  }

  async function onRegenerate() {
    setWorking(true);
    setError(null);
    const r = await regeneratePdfForRequest(request.id);
    setWorking(false);
    if (!r.ok) setError(r.error);
    else router.refresh();
  }

  return (
    <li className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{request.title}</span>
            <StatusPill status={request.status} signed={signedCount} total={request.signers.length} />
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            Created {request.createdAt.toLocaleString()} · Saves to{" "}
            <span className="font-mono">{request.targetSubfolderPath}</span>
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
        <div className="flex flex-none flex-col items-end gap-2 text-xs">
          {request.drivePdfUrl && (
            <a
              href={request.drivePdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-zinc-700 underline dark:text-zinc-300"
            >
              Open signed PDF <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {request.status === "pending" && (
            <button
              type="button"
              onClick={onVoid}
              disabled={working}
              className="text-red-600 hover:underline disabled:opacity-50"
            >
              Void
            </button>
          )}
          {request.status === "fully_signed" && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={working}
              className="rounded-md border border-zinc-300 px-2 py-1 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              {request.drivePdfUrl ? "Re-upload PDF" : "Generate PDF"}
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </li>
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

function Composer({
  applicationId,
  subfolderPaths,
  templateVars,
  onClose,
}: {
  applicationId: string;
  subfolderPaths: string[];
  templateVars: {
    applicantName: string;
    markText: string;
    goodsServicesSummary: string;
    attorneyName: string;
  };
  onClose: () => void;
}) {
  const router = useRouter();
  const [templateKey, setTemplateKey] = useState(SIGNATURE_TEMPLATES[0].key);
  const template: SignatureTemplate = useMemo(
    () =>
      SIGNATURE_TEMPLATES.find((t) => t.key === templateKey) ??
      SIGNATURE_TEMPLATES[0],
    [templateKey],
  );

  const [title, setTitle] = useState(template.defaultTitle);
  const [body, setBody] = useState(template.render(templateVars));
  const [subfolderPath, setSubfolderPath] = useState(
    template.defaultTargetSubfolder,
  );
  const [source, setSource] = useState<UploadedSource | null>(null);
  const [signers, setSigners] = useState<
    Array<{ name: string; email: string; role: string }>
  >(() =>
    template.defaultRoles.length > 0
      ? template.defaultRoles.map((role) => ({ name: "", email: "", role }))
      : [{ name: "", email: "", role: "" }],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyTemplate(key: string) {
    setTemplateKey(key);
    const next =
      SIGNATURE_TEMPLATES.find((t) => t.key === key) ?? SIGNATURE_TEMPLATES[0];
    setTitle(next.defaultTitle);
    setBody(next.render(templateVars));
    setSubfolderPath(next.defaultTargetSubfolder);
    if (next.defaultRoles.length > 0) {
      setSigners(
        next.defaultRoles.map((role) => ({ name: "", email: "", role })),
      );
    }
  }

  function updateSigner(idx: number, patch: Partial<(typeof signers)[number]>) {
    setSigners((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    );
  }
  function addSigner() {
    setSigners((prev) => [...prev, { name: "", email: "", role: "" }]);
  }
  function removeSigner(idx: number) {
    setSigners((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanSigners = signers
      .map((s) => ({
        name: s.name.trim(),
        email: s.email.trim(),
        role: s.role.trim() || null,
      }))
      .filter((s) => s.name && s.email);
    if (cleanSigners.length === 0) {
      setError("Add at least one signer with a name and email.");
      return;
    }
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle) {
      setError("Title is required.");
      return;
    }
    if (!trimmedBody && !source) {
      setError("Provide a body, a source file, or both.");
      return;
    }

    setSubmitting(true);
    const result = await createSignatureRequest({
      applicationId,
      templateKey,
      title: trimmedTitle,
      bodyText: trimmedBody || null,
      sourceFileUrl: source?.url ?? null,
      sourceFileName: source?.fileName ?? null,
      sourceFileMimeType: source?.mimeType ?? null,
      targetSubfolderPath: subfolderPath,
      signers: cleanSigners,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-md border border-zinc-300 p-4 dark:border-zinc-700"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">New signature request</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cancel"
          className="rounded p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium">Template</span>
          <select
            value={templateKey}
            onChange={(e) => applyTemplate(e.target.value)}
            disabled={submitting}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {SIGNATURE_TEMPLATES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium">Save signed PDF to</span>
          <select
            value={subfolderPath}
            onChange={(e) => setSubfolderPath(e.target.value)}
            disabled={submitting}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {subfolderPaths.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
            {!subfolderPaths.includes(subfolderPath) && (
              <option value={subfolderPath}>{subfolderPath}</option>
            )}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium">Title</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={submitting}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          required
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium">
          Body text (snapshot — signed exactly as shown)
        </span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={submitting}
          rows={10}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
          placeholder="Leave empty if you're only uploading a file."
        />
      </label>

      <div>
        <span className="mb-1 block text-xs font-medium">
          Source file (optional)
        </span>
        <SignatureSourceUploader
          applicationId={applicationId}
          value={source}
          onChange={setSource}
          disabled={submitting}
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium">Signers</span>
          <button
            type="button"
            onClick={addSigner}
            disabled={submitting}
            className="text-xs text-zinc-600 hover:underline dark:text-zinc-300"
          >
            + Add signer
          </button>
        </div>
        <ul className="space-y-2">
          {signers.map((s, i) => (
            <li
              key={i}
              className="grid gap-2 rounded-md border border-zinc-200 p-2 sm:grid-cols-[1fr_1fr_1fr_auto] dark:border-zinc-800"
            >
              <input
                type="text"
                placeholder="Name"
                value={s.name}
                onChange={(e) => updateSigner(i, { name: e.target.value })}
                disabled={submitting}
                className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
              <input
                type="email"
                placeholder="Email"
                value={s.email}
                onChange={(e) => updateSigner(i, { email: e.target.value })}
                disabled={submitting}
                className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
              <input
                type="text"
                placeholder="Role (optional)"
                value={s.role}
                onChange={(e) => updateSigner(i, { role: e.target.value })}
                disabled={submitting}
                className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
              <button
                type="button"
                onClick={() => removeSigner(i)}
                disabled={submitting || signers.length === 1}
                aria-label="Remove signer"
                className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-red-600 disabled:opacity-30 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {submitting ? "Sending…" : "Send signature request"}
        </button>
      </div>
    </form>
  );
}
