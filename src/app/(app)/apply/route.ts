import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { applications } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { DRAFT_COOKIE, getDraftCookie } from "@/lib/draft-cookie";

// /apply is a redirect endpoint, not a page.
//
// We can't use a server component here because creating a fresh draft for
// anonymous visitors requires writing the st_draft_id cookie, which Next.js
// only permits inside route handlers or form-action server actions. The
// previous page.tsx → server action approach threw a runtime error.
export async function GET(request: Request) {
  const [user, cookieId] = await Promise.all([
    getCurrentUser(),
    getDraftCookie(),
  ]);

  // Anonymous visitor with an existing draft cookie pointing at an editable
  // draft → reuse it. Stops new drafts piling up on every click of "Start
  // application".
  if (!user && cookieId) {
    const existing = await db.query.applications.findFirst({
      where: eq(applications.id, cookieId),
    });
    if (
      existing &&
      existing.userId === null &&
      existing.status === "draft"
    ) {
      return NextResponse.redirect(
        new URL(`/apply/${existing.id}`, request.url),
      );
    }
  }

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
