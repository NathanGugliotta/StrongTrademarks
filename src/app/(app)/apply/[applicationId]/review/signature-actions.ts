"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import {
  applications,
  signatureRequestSigners,
  signatureRequests,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getDraftCookie } from "@/lib/draft-cookie";
import { maybeFinalize } from "@/lib/signature-requests";

const schema = z.object({
  signatureRequestId: z.string().uuid(),
  signerId: z.string().uuid(),
  signature: z.string().trim().min(1).max(200),
});

/**
 * In-app signing — for a customer whose session email matches one of the
 * signers on a signature request. No token needed. Verifies authorization
 * by matching the viewer's email to the signer row.
 */
export async function signWithInAppSession(
  input: z.input<typeof schema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const user = await getCurrentUser();
  if (!user?.email) {
    return { ok: false, error: "Sign in to sign documents in-app." };
  }

  const signer = await db.query.signatureRequestSigners.findFirst({
    where: and(
      eq(signatureRequestSigners.id, parsed.data.signerId),
      eq(signatureRequestSigners.signatureRequestId, parsed.data.signatureRequestId),
    ),
  });
  if (!signer) return { ok: false, error: "Signer not found" };
  if (signer.email.toLowerCase() !== user.email.toLowerCase()) {
    return { ok: false, error: "Your account email doesn't match this signer." };
  }
  if (signer.signedAt) {
    return { ok: false, error: "You've already signed this." };
  }

  const request = await db.query.signatureRequests.findFirst({
    where: eq(signatureRequests.id, parsed.data.signatureRequestId),
  });
  if (!request) return { ok: false, error: "Signature request not found" };
  if (request.status !== "pending") {
    return { ok: false, error: "This signature request is no longer open." };
  }

  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    hdrs.get("x-real-ip") ??
    null;

  await db
    .update(signatureRequestSigners)
    .set({
      signature: parsed.data.signature,
      signedAt: new Date(),
      signedIp: ip,
    })
    .where(eq(signatureRequestSigners.id, signer.id));

  // Fire-and-forget the finalize step; do it inline so the result is
  // visible on the next refresh.
  await maybeFinalize(parsed.data.signatureRequestId).catch((err) =>
    console.error("[signature] maybeFinalize failed:", err),
  );

  // Touch the application's draftCookie ownership cleanly — just for the
  // revalidate path computation.
  void applications;
  void getDraftCookie;

  revalidatePath(`/apply/${request.applicationId}/review`);
  revalidatePath(`/admin/applications/${request.applicationId}`);
  return { ok: true };
}
