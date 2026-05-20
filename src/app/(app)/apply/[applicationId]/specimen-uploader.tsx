"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { Upload, X, FileText, Image as ImageIcon } from "lucide-react";
import { recordSpecimen, removeSpecimen } from "../upload-actions";

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const MAX_BYTES = 10 * 1024 * 1024;

type ExistingFile = {
  id: string;
  kind: "specimen" | "drawing" | "other";
  url: string;
  mimeType: string;
  sizeBytes: number;
};

export function SpecimenUploader({
  applicationId,
  initialFiles,
}: {
  applicationId: string;
  initialFiles: ExistingFile[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<ExistingFile[]>(initialFiles);
  const [kind, setKind] = useState<ExistingFile["kind"]>("specimen");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (file.size > MAX_BYTES) {
      setError(
        `File is ${(file.size / 1024 / 1024).toFixed(1)}MB — max is 10MB.`,
      );
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

      const result = await recordSpecimen({
        applicationId,
        kind,
        url: blob.url,
        mimeType: file.type,
        sizeBytes: file.size,
      });

      if (!result.ok) {
        setError(result.error);
      } else {
        setFiles((prev) => [
          ...prev,
          {
            id: result.fileId,
            kind,
            url: blob.url,
            mimeType: file.type,
            sizeBytes: file.size,
          },
        ]);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (e.target) e.target.value = "";
    }
  }

  async function onRemove(fileId: string) {
    setError(null);
    const result = await removeSpecimen(fileId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">File type</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as ExistingFile["kind"])}
            disabled={uploading}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="specimen">
              Specimen (proof of use in commerce)
            </option>
            <option value="drawing">
              Drawing (logo or design for the mark)
            </option>
            <option value="other">Other</option>
          </select>
        </label>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          <Upload className="h-4 w-4" />
          {uploading ? "Uploading…" : "Upload file"}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={onFileChange}
          className="hidden"
        />
      </div>

      <p className="text-xs text-zinc-500">
        JPG, PNG, WebP, or PDF. Max 10MB.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-3 rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800"
            >
              <FileIcon mimeType={f.mimeType} />
              <div className="flex-1 min-w-0">
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate font-medium hover:underline"
                >
                  {fileNameFromUrl(f.url)}
                </a>
                <div className="text-xs text-zinc-500">
                  {f.kind} · {(f.sizeBytes / 1024).toFixed(0)} KB
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemove(f.id)}
                disabled={uploading}
                aria-label="Remove file"
                className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
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
