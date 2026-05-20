"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { del } from "@vercel/blob";
import { db } from "@/db";
import { applications, files } from "@/db/schema";
import { requireUser } from "@/lib/auth";

const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];
const MAX_BYTES = 10 * 1024 * 1024;

const recordSchema = z.object({
  applicationId: z.string().uuid(),
  kind: z.enum(["specimen", "drawing", "other"]),
  url: z.string().url(),
  mimeType: z.string().refine((v) => ALLOWED_CONTENT_TYPES.includes(v), {
    message: "Unsupported file type",
  }),
  sizeBytes: z.number().int().positive().max(MAX_BYTES),
});

export async function recordSpecimen(
  input: z.input<typeof recordSchema>,
): Promise<
  { ok: true; fileId: string } | { ok: false; error: string }
> {
  const user = await requireUser();
  const parsed = recordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { applicationId, kind, url, mimeType, sizeBytes } = parsed.data;

  const app = await db.query.applications.findFirst({
    where: and(
      eq(applications.id, applicationId),
      eq(applications.userId, user.id),
    ),
  });
  if (!app) return { ok: false, error: "Application not found" };
  if (app.status !== "draft") {
    return { ok: false, error: "Application is no longer editable" };
  }

  // Verify the URL belongs to our Blob store. Blob URLs look like
  // https://<store-id>.public.blob.vercel-storage.com/<path>
  if (!/^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//.test(url)) {
    return { ok: false, error: "URL is not from our Blob store" };
  }

  // Idempotent: if a row already exists for this URL (race with onUploadCompleted)
  // return the existing id.
  const existing = await db.query.files.findFirst({
    where: eq(files.url, url),
  });
  if (existing) {
    revalidatePath(`/apply/${applicationId}`);
    return { ok: true, fileId: existing.id };
  }

  const [row] = await db
    .insert(files)
    .values({ applicationId, kind, url, mimeType, sizeBytes })
    .returning({ id: files.id });

  revalidatePath(`/apply/${applicationId}`);
  return { ok: true, fileId: row.id };
}

export async function removeSpecimen(
  fileId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();

  const file = await db.query.files.findFirst({
    where: eq(files.id, fileId),
    with: { application: true },
  });
  if (!file) return { ok: false, error: "File not found" };
  if (file.application.userId !== user.id) {
    return { ok: false, error: "Not your file" };
  }
  if (file.application.status !== "draft") {
    return { ok: false, error: "Application is no longer editable" };
  }

  try {
    await del(file.url);
  } catch {
    // If the blob is already gone, still remove the DB row.
  }
  await db.delete(files).where(eq(files.id, fileId));

  revalidatePath(`/apply/${file.applicationId}`);
  return { ok: true };
}
