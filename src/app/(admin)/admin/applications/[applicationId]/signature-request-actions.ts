"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  applications,
  signatureRequestSigners,
  signatureRequests,
} from "@/db/schema";
import { requireAttorney } from "@/lib/auth";
import { postSystemMessage } from "@/lib/messages";
import { notifySignerOfRequest } from "@/lib/notify";
import {
  generateSignerToken,
  regeneratePdf as regenerateRequestPdf,
} from "@/lib/signature-requests";
import {
  SIGNATURE_REQUEST_VERSION,
  getTemplate,
} from "@/lib/signature-templates";

const signerInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  role: z.string().trim().max(200).optional().nullable(),
});

const createSchema = z.object({
  applicationId: z.string().uuid(),
  templateKey: z.string().min(1).max(64),
  title: z.string().trim().min(1).max(200),
  bodyText: z.string().max(20_000).optional().nullable(),
  sourceFileUrl: z.string().url().optional().nullable(),
  sourceFileName: z.string().max(300).optional().nullable(),
  sourceFileMimeType: z.string().max(200).optional().nullable(),
  targetSubfolderPath: z.string().min(1).max(200),
  signers: z.array(signerInputSchema).min(1).max(20),
});

export async function createSignatureRequest(
  input: z.input<typeof createSchema>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const attorney = await requireAttorney();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  const body = data.bodyText?.trim() || null;
  const hasFile = Boolean(data.sourceFileUrl);
  if (!body && !hasFile) {
    return {
      ok: false,
      error: "Provide a body, a source file, or both.",
    };
  }
  if (
    data.sourceFileUrl &&
    !/^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//.test(
      data.sourceFileUrl,
    )
  ) {
    return { ok: false, error: "Source file URL is not from our Blob store" };
  }

  const app = await db.query.applications.findFirst({
    where: eq(applications.id, data.applicationId),
  });
  if (!app) return { ok: false, error: "Application not found" };

  const template = getTemplate(data.templateKey);

  const [request] = await db
    .insert(signatureRequests)
    .values({
      applicationId: data.applicationId,
      templateKey: template.key,
      title: data.title.trim(),
      bodyText: body,
      sourceFileUrl: data.sourceFileUrl || null,
      sourceFileName: data.sourceFileName?.trim() || null,
      sourceFileMimeType: data.sourceFileMimeType?.trim() || null,
      version: SIGNATURE_REQUEST_VERSION,
      targetSubfolderPath: data.targetSubfolderPath.trim(),
      status: "pending",
      requestedById: attorney.id,
    })
    .returning({ id: signatureRequests.id });

  const signerRows = await db
    .insert(signatureRequestSigners)
    .values(
      data.signers.map((s) => ({
        signatureRequestId: request.id,
        name: s.name.trim(),
        email: s.email.trim().toLowerCase(),
        role: s.role?.trim() || null,
        token: generateSignerToken(),
      })),
    )
    .returning({
      name: signatureRequestSigners.name,
      email: signatureRequestSigners.email,
      token: signatureRequestSigners.token,
    });

  // Thread message announcing the request — customer sees an inline sign
  // form if their email matches a signer, otherwise the email link.
  const messageBody = `**Signature requested: ${data.title.trim()}**\n\nWe sent each signer a unique link. You can also sign here in-app if your email matches.`;
  await postSystemMessage(data.applicationId, messageBody, attorney.id, {
    kind: "signature_request",
    signatureRequestId: request.id,
  });

  // Email each signer their unique link.
  await Promise.all(
    signerRows.map((s) =>
      notifySignerOfRequest({
        applicationId: data.applicationId,
        signerName: s.name,
        signerEmail: s.email,
        title: data.title.trim(),
        token: s.token,
      }).catch((err) =>
        console.error(
          `[signature] notifySignerOfRequest failed for ${s.email}:`,
          err,
        ),
      ),
    ),
  );

  revalidatePath(`/admin/applications/${data.applicationId}`);
  revalidatePath(`/apply/${data.applicationId}/review`);
  return { ok: true, id: request.id };
}

export async function voidSignatureRequest(
  signatureRequestId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const attorney = await requireAttorney();
  const request = await db.query.signatureRequests.findFirst({
    where: eq(signatureRequests.id, signatureRequestId),
  });
  if (!request) return { ok: false, error: "Signature request not found" };
  if (request.status !== "pending") {
    return { ok: false, error: "Only pending requests can be voided" };
  }
  await db
    .update(signatureRequests)
    .set({ status: "voided", updatedAt: new Date() })
    .where(eq(signatureRequests.id, signatureRequestId));

  await postSystemMessage(
    request.applicationId,
    `Signature request "${request.title}" was voided. Any outstanding signing links are no longer valid.`,
    attorney.id,
    { kind: "signature_request", signatureRequestId },
  );
  revalidatePath(`/admin/applications/${request.applicationId}`);
  revalidatePath(`/apply/${request.applicationId}/review`);
  return { ok: true };
}

export async function regeneratePdfForRequest(
  signatureRequestId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireAttorney();
  const result = await regenerateRequestPdf(signatureRequestId);
  if (!result.ok) return { ok: false, error: result.reason };
  const request = await db.query.signatureRequests.findFirst({
    where: eq(signatureRequests.id, signatureRequestId),
  });
  if (request) {
    revalidatePath(`/admin/applications/${request.applicationId}`);
  }
  return { ok: true, url: result.drivePdfUrl };
}
