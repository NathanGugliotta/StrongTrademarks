"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import {
  signatureRequestSigners,
  signatureRequests,
} from "@/db/schema";
import { maybeFinalize } from "@/lib/signature-requests";

const schema = z.object({
  token: z.string().min(10).max(200),
  signature: z.string().trim().min(1).max(200),
});

export async function signWithToken(
  input: z.input<typeof schema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const signer = await db.query.signatureRequestSigners.findFirst({
    where: eq(signatureRequestSigners.token, parsed.data.token),
  });
  if (!signer) return { ok: false, error: "Invalid signing link" };
  if (signer.signedAt) {
    return { ok: false, error: "You've already signed this." };
  }

  const request = await db.query.signatureRequests.findFirst({
    where: eq(signatureRequests.id, signer.signatureRequestId),
  });
  if (!request) return { ok: false, error: "Signature request not found" };
  if (request.status !== "pending") {
    return {
      ok: false,
      error:
        request.status === "voided"
          ? "This request was voided."
          : "This request is no longer open.",
    };
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

  await maybeFinalize(signer.signatureRequestId).catch((err) =>
    console.error("[signature] maybeFinalize failed:", err),
  );

  revalidatePath(`/sign/${parsed.data.token}`);
  revalidatePath(`/admin/applications/${request.applicationId}`);
  revalidatePath(`/apply/${request.applicationId}/review`);
  return { ok: true };
}
