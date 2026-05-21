import { FileText, Image as ImageIcon } from "lucide-react";

type AttorneyKind =
  | "filing_receipt"
  | "office_action"
  | "office_action_response"
  | "registration_certificate"
  | "correspondence"
  | "other";

const KIND_LABELS: Record<AttorneyKind, string> = {
  filing_receipt: "Filing receipt",
  office_action: "Office action",
  office_action_response: "Office action response",
  registration_certificate: "Registration certificate",
  correspondence: "USPTO correspondence",
  other: "Document",
};

export type AttorneyDocumentListItem = {
  id: string;
  kind: AttorneyKind;
  title: string | null;
  url: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
};

/** Read-only display of attorney-uploaded documents on the customer's view. */
export function AttorneyDocumentList({
  documents,
}: {
  documents: AttorneyDocumentListItem[];
}) {
  if (documents.length === 0) {
    return null;
  }
  return (
    <ul className="space-y-2">
      {documents.map((d) => (
        <li
          key={d.id}
          className="flex items-center gap-3 rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800"
        >
          {d.mimeType.startsWith("image/") ? (
            <ImageIcon className="h-5 w-5 flex-none text-zinc-500" />
          ) : (
            <FileText className="h-5 w-5 flex-none text-zinc-500" />
          )}
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
              {KIND_LABELS[d.kind]} ·{" "}
              {(d.sizeBytes / 1024).toFixed(0)} KB · {d.createdAt.toLocaleString()}
            </div>
          </div>
        </li>
      ))}
    </ul>
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
