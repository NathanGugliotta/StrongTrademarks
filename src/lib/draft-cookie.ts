import { cookies } from "next/headers";

export const DRAFT_COOKIE = "st_draft_id";

/**
 * Read the current anonymous draft id from cookies, if any.
 * The cookie itself is the proof of ownership for anonymous drafts: knowing
 * the (unguessable) UUID is treated as authorization to edit it, but only
 * while application.userId is still null. Once an account is attached, the
 * cookie is cleared and ownership flips to session-based.
 */
export async function getDraftCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(DRAFT_COOKIE)?.value ?? null;
}

export async function setDraftCookie(applicationId: string): Promise<void> {
  const jar = await cookies();
  jar.set(DRAFT_COOKIE, applicationId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function clearDraftCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(DRAFT_COOKIE);
}
