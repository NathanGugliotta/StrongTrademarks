"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { Upload, X, FileText, Image as ImageIcon } from "lucide-react";
import {
  recordAttorneyDocument,
  removeAttorneyDocument,
} from "./document-actions";

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const MAX_BYTES = 25 * 1024 * 1024;

type AttorneyKind =
  | "filing_receipt"
  | "office_action"
  | "office_action_response"
  | "registration_certificate"
  | "correspondence"
  | "other";

const KIND_OPTIONS: Array<{ value: AttorneyKind; label: string }> = [
  { value: "filing_receipt", label: "Filing receipt" },
  { value: "office_action", label: "Office action" },
  { value: "office_action_response", label: "Office action response" },
  { value: "registration_certificate", label: "Registration certificate" },
  { value: "correspondence", label: "USPTO correspondence" },
  { value: "other", label: "Other document" },
];

const KIND_LABELS: Record<AttorneyKind, string> = Object.fromEntries(
  KIND_OPTIONS.map((o) => [o.value, o.label]),
) as Record<AttorneyKind, string>;

type AttorneyDocument = {
  id: string;
  kind: AttorneyKind;
  title: string | null;
  url: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
};

export function AttorneyDocumentUploader({
  applicationId,
  initialDocuments,
}: {
  applicationId: string;
  initialDocuments: AttorneyDocument[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<AttorneyDocument[]>(initialDocuments);
  const [kind, setKind] = useState<AttorneyKind>("filing_receipt");
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (file.size > MAX_BYTES) {
      setError(
        `File is ${(file.size / 1024 / 1024).toFixed(1)}MB — max is 25MB.`,
      );
      e.target.value = "";
      return;
    }

    setUploading(true);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/admin/upload",
        clientPayload: JSON.stringify({ applicationId, kind }),
        contentType: file.type,
      });
      const result = await recordAttorneyDocument({
        applicationId,
        kind,
        title: title.trim() || undefined,
        url: blob.url,
        mimeType: file.type,
        sizeBytes: file.size,
      });
      if (!result.ok) {
        setError(result.error);
      } else {
        setDocs((prev) => [
          ...prev,
          {
            id: result.fileId,
            kind,
            title: title.trim() || null,
            url: blob.url,
            mimeType: file.type,
            sizeBytes: file.size,
            createdAt: new Date(),
          },
        ]);
        setTitle("");
        router.refresh();
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Upload failed";
      if (/client token/i.test(raw)) {
        try {
          const probe = await fetch("/api/admin/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
          const data = await probe.json().catch(() => null);
          if (probe.status === 503 && data?.error) {
            setError(data.error);
          } else {
            setError(raw);
          }
        } catch {
          setError(raw);
        }
      } else {
        setError(raw);
      }
    } finally {
      setUploading(false);
      if (e.target) e.target.value = "";
    }
  }

  async function onRemove(fileId: string) {
    if (!window.confirm("Remove this document? The customer won't see it anymore.")) return;
    setError(null);
    const result = await removeAttorneyDocument(fileId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDocs((prev) => prev.filter((d) => d.id !== fileId));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {docs.length > 0 && (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-3 rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800"
            >
              <FileIcon mimeType={d.mimeType} />
              <div className="min-w-0 flex-1">
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate font-medium hover:underline"
                >
                  {d.title ?? fileNameFromUrl(d.url)}
                </a>
                <div className="text-xs text-zinc-500">
                  {KIND_LABELS[d.kind]} · {(d.sizeBytes / 1024).toFixed(0)} KB
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemove(d.id)}
                disabled={uploading}
                aria-label="Remove document"
                className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-md border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium">Document type</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as AttorneyKind)}
              disabled={uploading}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block flex-1 min-w-[12rem]">
            <span className="mb-1 block text-xs font-medium">
              Display title (optional)
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Filing receipt 98765432"
              disabled={uploading}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          JPG, PNG, WebP, or PDF. Max 25MB. Customer is notified by email
          and a thread message when you upload.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={onFileChange}
          className="hidden"
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) {
    return <ImageIcon className="h-5 w-5 flex-none text-zinc-500" />;
  }
  return <FileText className="h-5 w-5 flex-none text-zinc-500" />;
}

function fileNameFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const last = parsed.pathname.split("/").pop() ?? url;
    return decodeURIComponent(last);
  } catch {
    return url;
  }
}
