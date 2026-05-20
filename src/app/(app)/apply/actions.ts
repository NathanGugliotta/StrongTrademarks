"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { applications, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getDraftCookie } from "@/lib/draft-cookie";
import { applicationSchema, type ApplicationInput } from "./schema";

/**
 * Resolve who's allowed to edit this application id.
 * Returns the application row if authorized, or null otherwise.
 *
 * Auth model:
 *  - Signed-in user owns the app  (application.userId === user.id)
 *  - OR the request's draft cookie matches the app id AND it's still anonymous
 *    (application.userId === null && cookie === application.id)
 */
async function authorizeForEdit(applicationId: string) {
  const [user, cookieId] = await Promise.all([
    getCurrentUser(),
    getDraftCookie(),
  ]);

  const app = await db.query.applications.findFirst({
    where: eq(applications.id, applicationId),
  });
  if (!app) return null;

  if (user && app.userId === user.id) return app;
  if (!app.userId && cookieId === app.id) return app;
  return null;
}

export async function saveApplication(
  id: string,
  input: Partial<ApplicationInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const app = await authorizeForEdit(id);
  if (!app) return { ok: false, error: "Application not found" };

  const parsed = applicationSchema.partial().safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input" };
  }

  await db
    .update(applications)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(applications.id, id));
  return { ok: true };
}

export async function submitApplicationForReview(
  id: string,
): Promise<
  | { ok: true; paymentRequired: boolean }
  | { ok: false; error: string }
> {
  const app = await authorizeForEdit(id);
  if (!app) return { ok: false, error: "Application not found" };

  if (app.status !== "draft" && app.status !== "changes_requested") {
    return {
      ok: false,
      error: `Application is in status '${app.status}' and can't be resubmitted from here.`,
    };
  }

  const validation = applicationSchema.safeParse({
    contactEmail: app.contactEmail,
    contactName: app.contactName,
    contactPhone: app.contactPhone ?? undefined,
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
      error:
        "Application is incomplete. Please fill out all required fields before submitting.",
    };
  }
  const data = validation.data;

  // If the app is still anonymous, look up or create the user from the
  // contact email, then attach. We don't require email verification here —
  // they can sign in later to verify and see their dashboard. The Stripe
  // checkout step will use the same email for the receipt.
  let userId = app.userId;
  if (!userId) {
    const existing = await db.query.users.findFirst({
      where: eq(users.email, data.contactEmail.toLowerCase()),
    });

    if (existing) {
      return {
        ok: false,
        error:
          "An account already exists for this email. Please sign in and we'll attach this application to your account.",
      };
    }

    const [created] = await db
      .insert(users)
      .values({
        email: data.contactEmail.toLowerCase(),
        name: data.contactName,
        role: "customer",
      })
      .returning({ id: users.id });
    userId = created.id;
  }

  const isFirstSubmission = app.status === "draft";
  const nextStatus = isFirstSubmission ? "submitted" : "in_review";

  await db
    .update(applications)
    .set({
      userId,
      status: nextStatus,
      submittedAt: app.submittedAt ?? new Date(),
      updatedAt: new Date(),
    })
    .where(eq(applications.id, id));

  // Cookie stays. It's the anonymous browser's read-only association with
  // the application — useful through checkout and the success page, before
  // the user has signed in for the first time. It becomes redundant once
  // they sign in; we don't bother clearing it.
  return { ok: true, paymentRequired: isFirstSubmission };
}

// Used by view-only surfaces (review page, success page, etc.) to check
// whether the current request is associated with this application.
// View access is broader than edit: the cookie continues to grant view
// access even after the application has been claimed by a user account.
export async function canViewApplication(id: string): Promise<boolean> {
  const [user, cookieId] = await Promise.all([
    getCurrentUser(),
    getDraftCookie(),
  ]);
  const app = await db.query.applications.findFirst({
    where: eq(applications.id, id),
  });
  if (!app) return false;
  if (user && app.userId === user.id) return true;
  if (cookieId === app.id) return true;
  return false;
}
