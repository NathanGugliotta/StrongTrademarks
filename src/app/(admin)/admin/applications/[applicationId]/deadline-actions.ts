"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { deadlines } from "@/db/schema";
import { requireAttorney } from "@/lib/auth";

const kindEnum = z.enum([
  "office_action",
  "statement_of_use",
  "section_8",
  "section_9",
  "ttab",
  "other",
]);

const createSchema = z.object({
  applicationId: z.string().uuid(),
  kind: kindEnum,
  title: z.string().min(1).max(200),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  notes: z.string().max(2000).optional(),
});

export type CreateDeadlineInput = z.input<typeof createSchema>;

function revalidate(applicationId: string) {
  revalidatePath(`/admin/applications/${applicationId}`);
  revalidatePath(`/apply/${applicationId}/review`);
  revalidatePath("/dashboard");
  revalidatePath("/admin");
}

export async function createDeadline(
  input: CreateDeadlineInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const attorney = await requireAttorney();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const { applicationId, kind, title, dueDate, notes } = parsed.data;
  await db.insert(deadlines).values({
    applicationId,
    kind,
    title,
    dueDate,
    notes,
    createdById: attorney.id,
  });
  revalidate(applicationId);
  return { ok: true };
}

export async function toggleDeadlineComplete(
  deadlineId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAttorney();
  const row = await db.query.deadlines.findFirst({
    where: eq(deadlines.id, deadlineId),
  });
  if (!row) return { ok: false, error: "Deadline not found" };

  await db
    .update(deadlines)
    .set({ completedAt: row.completedAt ? null : new Date() })
    .where(eq(deadlines.id, deadlineId));

  revalidate(row.applicationId);
  return { ok: true };
}

export async function deleteDeadline(
  deadlineId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAttorney();
  const row = await db.query.deadlines.findFirst({
    where: eq(deadlines.id, deadlineId),
  });
  if (!row) return { ok: false, error: "Deadline not found" };
  await db.delete(deadlines).where(eq(deadlines.id, deadlineId));
  revalidate(row.applicationId);
  return { ok: true };
}
