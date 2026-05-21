"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { Upload, FileText, Image as ImageIcon } from "lucide-react";
import { recordCustomerSupplementaryDocument } from "@/app/(app)/apply/upload-actions";

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const MAX_BYTES = 10 * 1024 * 1024;

type CustomerKind = "specimen" | "drawing" | "other";

const KIND_OPTIONS: Array<{ value: CustomerKind; label: string }> = [
  { value: "specimen", label: "Specimen of use" },
  { value: "drawing", label: "Drawing of the mark" },
  { value: "other", label: "Other document" },
];

type ExistingDocument = {
  id: string;
  url: string;
  mimeType: string;
};

/**
 * Customer-facing document uploader for the review page (post-intake).
 * Lets the customer respond to an attorney request for a substitute
 * specimen, additional documentation, etc. Auto-notifies the attorney
 * via the message thread.
 */
export function CustomerDocumentUploader({
  applicationId,
  existingFiles,
}: {
  applicationId: string;
  existingFiles?: ExistingDocument[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<CustomerKind>("specimen");
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentlyUploaded, setRecentlyUploaded] = useState<string | null>(null);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setRecentlyUploaded(null);

    if (file.size > MAX_BYTES) {
      setError(`File is ${(file.size / 1024 / 1024).toFixed(1)}MB — max is 10MB.`);
      e.target.value = "";
      return;
    }

    setUploading(true);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
        clientPayload: JSON.stringify({ applicationId, kind }),
        contentType: file.type,
      });
      const result = await recordCustomerSupplementaryDocument({
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
        setRecentlyUploaded(title.trim() || file.name);
        setTitle("");
        router.refresh();
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Upload failed";
      if (/client token/i.test(raw)) {
        try {
          const probe = await fetch("/api/upload", {
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

  return (
    <div className="space-y-3 rounded-md border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
      <p className="text-sm font-medium">Upload a document for your attorney</p>
      <p className="text-xs text-zinc-500">
        Use this to send a substitute specimen, an updated drawing, or
        anything else your attorney has asked for.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium">Type</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as CustomerKind)}
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
            Description (optional)
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Updated specimen showing the mark on packaging"
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
      <p className="text-xs text-zinc-500">
        JPG, PNG, WebP, or PDF. Max 10MB. Your attorney is notified by
        email and a thread message when you upload.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={onFileChange}
        className="hidden"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {recentlyUploaded && (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          Uploaded &quot;{recentlyUploaded}&quot;. Your attorney has been
          notified.
        </p>
      )}

      {existingFiles && existingFiles.length > 0 && (
        <ul className="space-y-1 border-t border-zinc-200 pt-3 text-xs dark:border-zinc-800">
          <li className="font-medium text-zinc-500">Your previous uploads:</li>
          {existingFiles.map((f) => (
            <li key={f.id} className="flex items-center gap-2">
              {f.mimeType.startsWith("image/") ? (
                <ImageIcon className="h-3.5 w-3.5 text-zinc-400" />
              ) : (
                <FileText className="h-3.5 w-3.5 text-zinc-400" />
              )}
              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate hover:underline"
              >
                {fileNameFromUrl(f.url)}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
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
