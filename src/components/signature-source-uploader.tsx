"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { FileText, Image as ImageIcon, Upload, X } from "lucide-react";

const MAX_BYTES = 25 * 1024 * 1024;

export type UploadedSource = {
  url: string;
  fileName: string;
  mimeType: string;
};

/**
 * Drag-and-drop / click uploader for a signature request's source file.
 *
 * Unlike the attorney document uploader, this doesn't insert a `files` row
 * — the source file is owned by the signature request itself. We just
 * surface the Blob URL + name + MIME type back to the composer.
 *
 * Accepts PDF / JPEG / PNG / WebP / Pages files. WebP and Pages are stored
 * but won't be embedded in the final signed PDF (see sign-pdf.ts).
 */
export function SignatureSourceUploader({
  applicationId,
  value,
  onChange,
  disabled,
}: {
  applicationId: string;
  value: UploadedSource | null;
  onChange: (next: UploadedSource | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError(
        `File is ${(file.size / 1024 / 1024).toFixed(1)}MB — max is 25MB.`,
      );
      return;
    }

    const lowerName = file.name.toLowerCase();
    const isPages = lowerName.endsWith(".pages");
    // The browser may report .pages as application/zip or
    // application/octet-stream. Browser-reported MIME wins as the
    // content-type for upload — the route accepts the broader set.
    const contentType = file.type || (isPages ? "application/zip" : "");
    if (!contentType) {
      setError("Couldn't detect file type. Try saving and re-uploading.");
      return;
    }

    setUploading(true);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/admin/upload",
        clientPayload: JSON.stringify({
          applicationId,
          kind: "signature_source",
        }),
        contentType,
      });
      // Record what we semantically know about the file. If it's clearly a
      // Pages file by extension, preserve that MIME for the renderer even
      // if the browser reported zip/octet-stream.
      const effectiveMime = isPages ? "application/vnd.apple.pages" : contentType;
      onChange({
        url: blob.url,
        fileName: file.name,
        mimeType: effectiveMime,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (disabled || uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    if (e.target) e.target.value = "";
  }

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
        <FileIcon mimeType={value.mimeType} />
        <div className="min-w-0 flex-1">
          <a
            href={value.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate font-medium hover:underline"
          >
            {value.fileName}
          </a>
          <div className="text-xs text-zinc-500">{value.mimeType}</div>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          disabled={disabled || uploading}
          aria-label="Remove file"
          className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !uploading) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed p-6 text-center text-sm transition ${
          dragging
            ? "border-zinc-500 bg-zinc-50 dark:border-zinc-400 dark:bg-zinc-900"
            : "border-zinc-300 dark:border-zinc-700"
        } ${disabled || uploading ? "pointer-events-none opacity-60" : ""}`}
      >
        <Upload className="mb-2 h-5 w-5 text-zinc-500" />
        <p className="font-medium">
          {uploading ? "Uploading…" : "Drop a file or click to browse"}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          PDF, JPG, PNG, WebP, or .pages (Apple Pages). Max 25MB.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          PDFs and JPEG/PNG embed inline in the signed PDF. WebP and .pages
          appear as a reference link.
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp,.pages,image/jpeg,image/png,image/webp,application/pdf,application/vnd.apple.pages,application/zip"
        onChange={onFileChange}
        className="hidden"
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) {
    return <ImageIcon className="h-5 w-5 flex-none text-zinc-500" />;
  }
  return <FileText className="h-5 w-5 flex-none text-zinc-500" />;
}
