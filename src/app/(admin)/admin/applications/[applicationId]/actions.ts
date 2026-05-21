"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { applications, attorneyReviews } from "@/db/schema";
import { requireAttorney } from "@/lib/auth";
import { formatSheetDate } from "@/lib/docket";
import { isSheetsConfigured, updateFiledStatus } from "@/lib/sheets";
import { postSystemMessage } from "@/lib/messages";
import { notifyCustomerOfMessage } from "@/lib/notify";
import { assignDocketIfNeeded } from "@/lib/docket-assign";

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

  // Post into the message thread so the customer sees the update in
  // context, then email them.
  const messageBody = [
    `Your application has been filed with the USPTO.`,
    `Serial number: ${usptoSerialNumber}.`,
    notes ? `\n${notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  await postSystemMessage(applicationId, messageBody, attorneyId);
  notifyCustomerOfMessage({
    applicationId,
    authorName: "Your attorney",
    body: messageBody,
  }).catch((err) =>
    console.error("[notify] notifyCustomerOfMessage (filed) failed:", err),
  );

  // Sync to the master docket sheet: fill SERIAL NO. and FILED columns.
  // Failures here are logged but don't fail the action — the DB is already
  // updated, the attorney sees their action took effect, and the sheet sync
  // can be retried later if needed.
  if (isSheetsConfigured()) {
    try {
      const app = await db.query.applications.findFirst({
        where: eq(applications.id, applicationId),
      });
      if (app?.docketNumber) {
        const synced = await updateFiledStatus(
          app.docketNumber,
          usptoSerialNumber,
          formatSheetDate(filedAt),
        );
        if (!synced) {
          console.warn(
            `[docket] Could not find docket ${app.docketNumber} in sheet — skipped SERIAL/FILED update`,
          );
        }
      }
    } catch (err) {
      console.error("[docket] Sheet sync on filed status failed:", err);
    }
  }

  revalidateForApplication(applicationId);
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

  const messageBody = `Your attorney has requested changes:\n\n${notes}`;
  await postSystemMessage(applicationId, messageBody, attorneyId);
  notifyCustomerOfMessage({
    applicationId,
    authorName: "Your attorney",
    body: messageBody,
  }).catch((err) =>
    console.error("[notify] notifyCustomerOfMessage (changes) failed:", err),
  );

  revalidateForApplication(applicationId);
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

  const messageBody = `This application has been rejected:\n\n${notes}\n\nIf you'd like a refund, or to put the fee toward a new application, see /refunds or reply here.`;
  await postSystemMessage(applicationId, messageBody, attorneyId);
  notifyCustomerOfMessage({
    applicationId,
    authorName: "Your attorney",
    body: messageBody,
  }).catch((err) =>
    console.error("[notify] notifyCustomerOfMessage (rejected) failed:", err),
  );

  revalidateForApplication(applicationId);
  return { ok: true };
}

/**
 * Re-run docket assignment for an application that's paid but missing
 * docket_number (typically because an earlier webhook attempt failed
 * mid-flow — bad row 2 hint, sheet/DB collision, etc.). Attorney-only.
 */
export async function retryDocketAssignment(
  applicationId: string,
): Promise<
  { ok: true; docket: string } | { ok: false; error: string }
> {
  await requireAttorney();
  const result = await assignDocketIfNeeded(applicationId);
  revalidateForApplication(applicationId);
  if (result.ok) {
    return { ok: true, docket: result.docket };
  }
  return { ok: false, error: result.reason };
}

function optionalString(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

// Reviewer decisions affect every surface this application appears on,
// not just the attorney inbox. Revalidate the customer's dashboard, the
// editable form, and the review page so they pick up status / notes /
// docket changes on their next navigation. (force-dynamic alone isn't
// enough when a tab is already open and uses cached route data.)
function revalidateForApplication(applicationId: string) {
  revalidatePath("/admin");
  revalidatePath(`/admin/applications/${applicationId}`);
  revalidatePath("/dashboard");
  revalidatePath(`/apply/${applicationId}`);
  revalidatePath(`/apply/${applicationId}/review`);
  revalidatePath(`/apply/${applicationId}/success`);
}
