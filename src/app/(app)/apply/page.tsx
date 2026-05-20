import { redirect } from "next/navigation";
import { db } from "@/db";
import { applications } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDraftCookie } from "@/lib/draft-cookie";
import { createDraftApplication } from "./actions";

// Entry point for starting a new application.
//
// Anonymous users: if they already have a draft cookie pointing at an
// editable draft, reuse it. Otherwise create a fresh draft, set the cookie,
// and redirect to the form.
//
// Signed-in users: always create a new draft (multi-application support).
export default async function NewApplicationPage() {
  const [user, cookieId] = await Promise.all([
    getCurrentUser(),
    getDraftCookie(),
  ]);

  if (!user && cookieId) {
    const existing = await db.query.applications.findFirst({
      where: eq(applications.id, cookieId),
    });
    if (
      existing &&
      existing.userId === null &&
      existing.status === "draft"
    ) {
      redirect(`/apply/${existing.id}`);
    }
  }

  const { id } = await createDraftApplication();
  redirect(`/apply/${id}`);
}
