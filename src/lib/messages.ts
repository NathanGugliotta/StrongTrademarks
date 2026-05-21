// Server-action helpers for posting messages into an application's thread.
// Used by both the customer's /apply/[id]/review page and the attorney's
// /admin/applications/[id] page. Authorization differs per caller:
//   - Customer: must own the application (session OR draft cookie).
//   - Attorney: must have role attorney or admin.

"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { applications, messages } from "@/db/schema";
import { getCurrentUser, requireAttorney } from "@/lib/auth";
import { getDraftCookie } from "@/lib/draft-cookie";
import {
  notifyAttorneyOfMessage,
  notifyCustomerOfMessage,
} from "@/lib/notify";

const MAX_BODY_LENGTH = 4000;

function normalizeBody(body: string): string | null {
  const trimmed = body.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > MAX_BODY_LENGTH) {
    return trimmed.slice(0, MAX_BODY_LENGTH);
  }
  return trimmed;
}

function revalidate(applicationId: string) {
  revalidatePath(`/apply/${applicationId}/review`);
  revalidatePath(`/apply/${applicationId}`);
  revalidatePath(`/admin/applications/${applicationId}`);
}

export async function postCustomerMessage(
  applicationId: string,
  rawBody: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const body = normalizeBody(rawBody);
  if (!body) return { ok: false, error: "Message can't be empty." };

  const [user, cookieId] = await Promise.all([
    getCurrentUser(),
    getDraftCookie(),
  ]);

  const app = await db.query.applications.findFirst({
    where: eq(applications.id, applicationId),
  });
  if (!app) return { ok: false, error: "Application not found" };

  const isOwner = user && app.userId === user.id;
  const isAnonOwner = cookieId === app.id;
  if (!isOwner && !isAnonOwner) {
    return { ok: false, error: "Not authorized" };
  }

  await db.insert(messages).values({
    applicationId,
    authorId: user?.id ?? null,
    authorRole: "customer",
    body,
  });

  revalidate(applicationId);

  // Don't await — let the notification happen in the background so the user
  // gets immediate feedback. (Note: in serverless, this still completes
  // before the function exits, but the UI doesn't wait on the email.)
  notifyAttorneyOfMessage({
    applicationId,
    authorName: user?.name ?? app.contactName ?? user?.email ?? "Customer",
    body,
  }).catch((err) =>
    console.error("[notify] notifyAttorneyOfMessage failed:", err),
  );

  return { ok: true };
}

export async function postAttorneyMessage(
  applicationId: string,
  rawBody: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const body = normalizeBody(rawBody);
  if (!body) return { ok: false, error: "Message can't be empty." };

  const attorney = await requireAttorney();

  await db.insert(messages).values({
    applicationId,
    authorId: attorney.id,
    authorRole: "attorney",
    body,
  });

  revalidate(applicationId);

  notifyCustomerOfMessage({
    applicationId,
    authorName: attorney.name ?? "Your attorney",
    body,
  }).catch((err) =>
    console.error("[notify] notifyCustomerOfMessage failed:", err),
  );

  return { ok: true };
}

/**
 * Insert a system message (no notifications, no auth check). Called from
 * other server actions when a status change happens — e.g. "Changes
 * requested: please clarify the goods description" gets posted into the
 * thread so the customer sees it in context.
 */
export async function postSystemMessage(
  applicationId: string,
  body: string,
  attorneyId: string | null,
): Promise<void> {
  const normalized = normalizeBody(body);
  if (!normalized) return;
  await db.insert(messages).values({
    applicationId,
    authorId: attorneyId,
    authorRole: attorneyId ? "attorney" : "system",
    body: normalized,
  });
  revalidate(applicationId);
}
