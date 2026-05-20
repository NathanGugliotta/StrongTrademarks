"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { applications } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { applicationSchema, type ApplicationInput } from "./schema";

export async function createDraftApplication(): Promise<{ id: string }> {
  const user = await requireUser();
  const [row] = await db
    .insert(applications)
    .values({ userId: user.id })
    .returning({ id: applications.id });
  return { id: row.id };
}

export async function saveApplication(
  id: string,
  input: ApplicationInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const parsed = applicationSchema.partial().safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input" };
  }
  const result = await db
    .update(applications)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(
      and(eq(applications.id, id), eq(applications.userId, user.id)),
    )
    .returning({ id: applications.id });
  if (result.length === 0) {
    return { ok: false, error: "Application not found" };
  }
  return { ok: true };
}

export async function submitApplicationForReview(
  id: string,
): Promise<
  | { ok: true; paymentRequired: boolean }
  | { ok: false; error: string }
> {
  const user = await requireUser();
  const app = await db.query.applications.findFirst({
    where: and(eq(applications.id, id), eq(applications.userId, user.id)),
  });
  if (!app) return { ok: false, error: "Application not found" };

  if (app.status !== "draft" && app.status !== "changes_requested") {
    return {
      ok: false,
      error: `Application is in status '${app.status}' and can't be resubmitted from here.`,
    };
  }

  const validation = applicationSchema.safeParse({
    markType: app.markType,
    markText: app.markText ?? undefined,
    markDescription: app.markDescription ?? undefined,
    ownerName: app.ownerName,
    ownerEntityType: app.ownerEntityType,
    ownerAddress: app.ownerAddress,
    filingBasis: app.filingBasis,
    goodsServices: app.goodsServices,
  });
  if (!validation.success) {
    return {
      ok: false,
      error: "Application is incomplete. Please fill out all required fields.",
    };
  }

  // First-time submission goes through checkout. Re-submission after a
  // changes_requested has already been paid for — go straight back into the
  // attorney's queue.
  const isFirstSubmission = app.status === "draft";
  const nextStatus = isFirstSubmission ? "submitted" : "in_review";

  await db
    .update(applications)
    .set({
      status: nextStatus,
      submittedAt: app.submittedAt ?? new Date(),
      updatedAt: new Date(),
    })
    .where(eq(applications.id, id));

  return { ok: true, paymentRequired: isFirstSubmission };
}
