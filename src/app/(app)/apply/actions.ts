"use server";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { applications, files, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getDraftCookie } from "@/lib/draft-cookie";
import {
  applicationDraftSchema,
  applicationSchema,
  type ApplicationDraftInput,
} from "./schema";

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
  input: ApplicationDraftInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const app = await authorizeForEdit(id);
  if (!app) return { ok: false, error: "Application not found" };

  const parsed = applicationDraftSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input" };
  }
  const data = parsed.data;

  // ownerAddress is only persisted when all required sub-fields are present.
  // Drizzle's column type doesn't permit a partial address; while the user
  // is still typing, we leave the existing value alone.
  const addr = data.ownerAddress;
  const ownerAddress =
    addr &&
    addr.line1 &&
    addr.city &&
    addr.state &&
    addr.postalCode &&
    addr.country
      ? {
          line1: addr.line1,
          line2: addr.line2,
          city: addr.city,
          state: addr.state,
          postalCode: addr.postalCode,
          country: addr.country,
        }
      : undefined;

  const { ownerAddress: _drop, ...rest } = data;
  void _drop;

  await db
    .update(applications)
    .set({
      ...rest,
      ...(ownerAddress !== undefined ? { ownerAddress } : {}),
      updatedAt: new Date(),
    })
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
    firstUseInCommerceDate: app.firstUseInCommerceDate ?? undefined,
    firstUseAnywhereDate: app.firstUseAnywhereDate ?? undefined,
    goodsServices: app.goodsServices,
  });
  if (!validation.success) {
    const issues = validation.error.issues
      .map((i) => `${i.path.join(".") || "form"}: ${i.message}`)
      .join("; ");
    return {
      ok: false,
      error: `Application is incomplete (${issues}).`,
    };
  }
  const data = validation.data;

  // File requirements:
  //   - design / combined marks need a drawing
  //   - use-in-commerce filings need a specimen
  const uploaded = await db.query.files.findMany({
    where: eq(files.applicationId, id),
  });
  const hasDrawing = uploaded.some((f) => f.kind === "drawing");
  const hasSpecimen = uploaded.some((f) => f.kind === "specimen");

  if (
    (data.markType === "design" || data.markType === "combined") &&
    !hasDrawing
  ) {
    return {
      ok: false,
      error:
        "Design and combined marks require a drawing. Upload the drawing of your mark below the form.",
    };
  }
  if (data.filingBasis === "use" && !hasSpecimen) {
    return {
      ok: false,
      error:
        "Use-in-commerce filings require a specimen showing the mark on your goods/services. Upload one below the form.",
    };
  }

  // If the app is still anonymous, look up or create the user from the
  // contact email, then attach. We don't require email verification here —
  // they can sign in later to verify and see their dashboard. The Stripe
  // checkout step will use the same email for the receipt.
  // Attach this draft to a user account, looking up by contact email.
  // If a user already exists with this email, reuse it; otherwise create one.
  // We don't require email verification here because (a) the attorney
  // reviews every filing before it goes to the USPTO so wrong-email
  // accidents get caught, and (b) the friction of an email round-trip
  // before payment kills conversion. The user can later sign in via magic
  // link to claim the account; until then, the cookie keeps them associated
  // with this application.
  let userId = app.userId;
  if (!userId) {
    const existing = await db.query.users.findFirst({
      where: eq(users.email, data.contactEmail.toLowerCase()),
    });
    if (existing) {
      userId = existing.id;
    } else {
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

/**
 * Hard-delete a draft application. Cascades to messages, files, deadlines,
 * etc. Only permitted while status='draft' (nothing committed downstream
 * yet — no Stripe charges, no attorney review, no docket sheet row).
 */
export async function deleteDraftApplication(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const app = await authorizeForEdit(id);
  if (!app) return { ok: false, error: "Application not found" };
  if (app.status !== "draft") {
    return {
      ok: false,
      error: `Application is in status '${app.status}' and can't be deleted from here.`,
    };
  }
  await db.delete(applications).where(eq(applications.id, id));
  return { ok: true };
}

/**
 * Delete every "empty" draft for the current user (or anonymous-cookie
 * session). Empty = no mark text, no owner name, no contact name, no
 * goods/services entries. Useful for cleaning up the residue of
 * accidentally-clicking-Start-application multiple times.
 *
 * Returns how many drafts were removed.
 */
export async function deleteEmptyDrafts(): Promise<{ deleted: number }> {
  const user = await getCurrentUser();
  if (!user) return { deleted: 0 };

  const candidates = await db.query.applications.findMany({
    where: and(
      eq(applications.userId, user.id),
      eq(applications.status, "draft"),
    ),
  });

  const emptyIds = candidates
    .filter(
      (a) =>
        !a.markText &&
        !a.ownerName &&
        !a.contactName &&
        (!a.goodsServices || a.goodsServices.length === 0),
    )
    .map((a) => a.id);

  if (emptyIds.length === 0) return { deleted: 0 };

  await db
    .delete(applications)
    .where(inArray(applications.id, emptyIds));

  return { deleted: emptyIds.length };
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
