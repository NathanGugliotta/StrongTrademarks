"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { del } from "@vercel/blob";
import { db } from "@/db";
import { applications, files } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getDraftCookie } from "@/lib/draft-cookie";

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

async function canEditApplication(applicationId: string): Promise<boolean> {
  const [user, cookieId] = await Promise.all([
    getCurrentUser(),
    getDraftCookie(),
  ]);
  const app = await db.query.applications.findFirst({
    where: eq(applications.id, applicationId),
  });
  if (!app) return false;
  if (app.status !== "draft" && app.status !== "changes_requested") return false;
  if (user && app.userId === user.id) return true;
  if (!app.userId && cookieId === app.id) return true;
  return false;
}

export async function recordSpecimen(
  input: z.input<typeof recordSchema>,
): Promise<
  { ok: true; fileId: string } | { ok: false; error: string }
> {
  const parsed = recordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const { applicationId, kind, url, mimeType, sizeBytes } = parsed.data;

  if (!(await canEditApplication(applicationId))) {
    return { ok: false, error: "Application not found or no longer editable" };
  }

  if (!/^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//.test(url)) {
    return { ok: false, error: "URL is not from our Blob store" };
  }

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
  const file = await db.query.files.findFirst({
    where: eq(files.id, fileId),
  });
  if (!file) return { ok: false, error: "File not found" };

  if (!(await canEditApplication(file.applicationId))) {
    return { ok: false, error: "Not authorized" };
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
