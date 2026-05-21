import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { applications } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { DRAFT_COOKIE, getDraftCookie } from "@/lib/draft-cookie";

// /apply is a redirect endpoint, not a page.
//
// Logic:
//   1. If the request's draft cookie points at an editable draft this
//      session is authorized to use, reuse it. If the session is now
//      signed in but the cookie's draft is still anonymous, claim it
//      for the user (set userId).
//   2. If the user is signed in, reuse their most-recently-updated
//      draft. This prevents "I clicked Start application 7 times" from
//      creating 7 empty drafts.
//   3. Otherwise, create a fresh draft. For anonymous sessions we set
//      the st_draft_id cookie on the response so the same browser
//      keeps editing the same draft across reloads.
//
// To start a truly fresh application, the user must delete their
// existing draft first (the dashboard has per-row + bulk delete).
export async function GET(request: Request) {
  const [user, cookieId] = await Promise.all([
    getCurrentUser(),
    getDraftCookie(),
  ]);

  // 1. Cookie-tracked draft
  if (cookieId) {
    const cookieDraft = await db.query.applications.findFirst({
      where: eq(applications.id, cookieId),
    });
    if (cookieDraft && cookieDraft.status === "draft") {
      const isAnonOwned = cookieDraft.userId === null;
      const isUserOwned = user && cookieDraft.userId === user.id;
      if (isAnonOwned || isUserOwned) {
        // If the user signed up mid-flow, claim the anonymous draft for
        // them now so it stops being orphaned.
        if (isAnonOwned && user) {
          await db
            .update(applications)
            .set({ userId: user.id, updatedAt: new Date() })
            .where(eq(applications.id, cookieDraft.id));
        }
        return NextResponse.redirect(
          new URL(`/apply/${cookieDraft.id}`, request.url),
        );
      }
    }
  }

  // 2. Signed-in user with an existing draft
  if (user) {
    const userDraft = await db.query.applications.findFirst({
      where: and(
        eq(applications.userId, user.id),
        eq(applications.status, "draft"),
      ),
      orderBy: desc(applications.updatedAt),
    });
    if (userDraft) {
      return NextResponse.redirect(
        new URL(`/apply/${userDraft.id}`, request.url),
      );
    }
  }

  // 3. Create a fresh draft.
  const [row] = await db
    .insert(applications)
    .values({ userId: user?.id ?? null })
    .returning({ id: applications.id });

  const response = NextResponse.redirect(
    new URL(`/apply/${row.id}`, request.url),
  );
  if (!user) {
    response.cookies.set(DRAFT_COOKIE, row.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return response;
}
