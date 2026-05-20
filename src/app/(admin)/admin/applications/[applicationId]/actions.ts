"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { applications, attorneyReviews } from "@/db/schema";
import { requireAttorney } from "@/lib/auth";

const baseSchema = z.object({
  applicationId: z.string().uuid(),
  notes: z.string().max(5000).optional(),
});

const markFiledSchema = baseSchema.extend({
  usptoSerialNumber: z.string().min(1).max(50),
});

export async function reviewerDecision(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const attorney = await requireAttorney();
  const intent = formData.get("intent");

  switch (intent) {
    case "filed":
      return markFiled(attorney.id, {
        applicationId: String(formData.get("applicationId") ?? ""),
        notes: optionalString(formData.get("notes")),
        usptoSerialNumber: String(formData.get("usptoSerialNumber") ?? ""),
      });
    case "changes_requested":
      return requestChanges(attorney.id, {
        applicationId: String(formData.get("applicationId") ?? ""),
        notes: optionalString(formData.get("notes")),
      });
    case "rejected":
      return reject(attorney.id, {
        applicationId: String(formData.get("applicationId") ?? ""),
        notes: optionalString(formData.get("notes")),
      });
    default:
      return { ok: false, error: "Unknown action" };
  }
}

async function markFiled(
  attorneyId: string,
  raw: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = markFiledSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        "USPTO serial number is required when marking an application filed.",
    };
  }
  const { applicationId, notes, usptoSerialNumber } = parsed.data;
  const filedAt = new Date();

  await db.transaction(async (tx) => {
    await tx.insert(attorneyReviews).values({
      applicationId,
      attorneyId,
      status: "filed",
      notes,
      filedAt,
      usptoSerialNumber,
    });
    await tx
      .update(applications)
      .set({ status: "filed", updatedAt: filedAt })
      .where(eq(applications.id, applicationId));
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/applications/${applicationId}`);
  return { ok: true };
}

async function requestChanges(
  attorneyId: string,
  raw: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = baseSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  if (!parsed.data.notes) {
    return {
      ok: false,
      error: "Notes are required when requesting changes — tell the customer what to fix.",
    };
  }
  const { applicationId, notes } = parsed.data;

  await db.transaction(async (tx) => {
    await tx.insert(attorneyReviews).values({
      applicationId,
      attorneyId,
      status: "changes_requested",
      notes,
    });
    await tx
      .update(applications)
      .set({ status: "changes_requested", updatedAt: new Date() })
      .where(eq(applications.id, applicationId));
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/applications/${applicationId}`);
  return { ok: true };
}

async function reject(
  attorneyId: string,
  raw: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = baseSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  if (!parsed.data.notes) {
    return {
      ok: false,
      error: "Notes are required when rejecting an application.",
    };
  }
  const { applicationId, notes } = parsed.data;

  await db.transaction(async (tx) => {
    await tx.insert(attorneyReviews).values({
      applicationId,
      attorneyId,
      status: "rejected",
      notes,
    });
    await tx
      .update(applications)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(eq(applications.id, applicationId));
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/applications/${applicationId}`);
  return { ok: true };
}

function optionalString(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
