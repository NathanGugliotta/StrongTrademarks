"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { del } from "@vercel/blob";
import { db } from "@/db";
import { files } from "@/db/schema";
import { requireAttorney } from "@/lib/auth";
import { postSystemMessage } from "@/lib/messages";
import { notifyCustomerOfMessage } from "@/lib/notify";

const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];
const MAX_BYTES = 25 * 1024 * 1024;

const ATTORNEY_KINDS = [
  "filing_receipt",
  "office_action",
  "office_action_response",
  "registration_certificate",
  "correspondence",
  "other",
] as const;

const recordSchema = z.object({
  applicationId: z.string().uuid(),
  kind: z.enum(ATTORNEY_KINDS),
  title: z.string().max(200).optional(),
  url: z.string().url(),
  mimeType: z.string().refine((v) => ALLOWED_CONTENT_TYPES.includes(v), {
    message: "Unsupported file type",
  }),
  sizeBytes: z.number().int().positive().max(MAX_BYTES),
});

const KIND_LABELS: Record<(typeof ATTORNEY_KINDS)[number], string> = {
  filing_receipt: "Filing receipt",
  office_action: "Office action",
  office_action_response: "Office action response",
  registration_certificate: "Registration certificate",
  correspondence: "Correspondence",
  other: "Document",
};

/**
 * Record an attorney-uploaded document after the file has already landed
 * in Vercel Blob (via /api/admin/upload). Also posts a thread message and
 * emails the customer so they know the document is available.
 */
export async function recordAttorneyDocument(
  input: z.input<typeof recordSchema>,
): Promise<
  { ok: true; fileId: string } | { ok: false; error: string }
> {
  const attorney = await requireAttorney();
  const parsed = recordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const { applicationId, kind, title, url, mimeType, sizeBytes } = parsed.data;

  if (!/^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//.test(url)) {
    return { ok: false, error: "URL is not from our Blob store" };
  }

  // Idempotent on the URL — uploading the same blob twice is rare but
  // shouldn't double-record.
  const existing = await db.query.files.findFirst({
    where: eq(files.url, url),
  });
  if (existing) {
    return { ok: true, fileId: existing.id };
  }

  const [row] = await db
    .insert(files)
    .values({
      applicationId,
      kind,
      title: title?.trim() || null,
      url,
      mimeType,
      sizeBytes,
      uploadedById: attorney.id,
      uploadedByRole: "attorney",
    })
    .returning({ id: files.id });

  // Drop a thread message so the customer sees the upload in context, and
  // email them so they know to come look.
  const label = KIND_LABELS[kind];
  const displayTitle = title?.trim() ? title.trim() : label;
  const messageBody = `Your attorney uploaded a document: **${displayTitle}** (${label}). It's available on this application page below the messages.`;
  await postSystemMessage(applicationId, messageBody, attorney.id);
  notifyCustomerOfMessage({
    applicationId,
    authorName: "Your attorney",
    body: messageBody,
  }).catch((err) =>
    console.error(
      "[notify] notifyCustomerOfMessage (doc upload) failed:",
      err,
    ),
  );

  revalidatePath(`/admin/applications/${applicationId}`);
  revalidatePath(`/apply/${applicationId}/review`);
  return { ok: true, fileId: row.id };
}

export async function removeAttorneyDocument(
  fileId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAttorney();
  const file = await db.query.files.findFirst({
    where: eq(files.id, fileId),
  });
  if (!file) return { ok: false, error: "File not found" };
  if (file.uploadedByRole !== "attorney") {
    return { ok: false, error: "Not an attorney-uploaded document" };
  }
  try {
    await del(file.url);
  } catch {
    // If the blob is already gone, still delete the row.
  }
  await db.delete(files).where(eq(files.id, fileId));
  revalidatePath(`/admin/applications/${file.applicationId}`);
  revalidatePath(`/apply/${file.applicationId}/review`);
  return { ok: true };
}
