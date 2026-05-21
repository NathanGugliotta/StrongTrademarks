// Domain helpers for ad-hoc signature requests. Token generation, status
// derivation, and the post-sign hook that triggers PDF assembly + Drive
// upload.

import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  applications,
  signatureRequestSigners,
  signatureRequests,
} from "@/db/schema";
import { generateSignedPdf } from "./sign-pdf";
import {
  copyBlobToDriveFolder,
  isDriveConfigured,
  uploadBufferToDriveFolder,
} from "./drive";
import { postSystemMessage } from "./messages";
import { notifyAttorneyOfMessage, notifyCustomerOfMessage } from "./notify";

/** Crypto-random URL-safe token used in /sign/[token] links. */
export function generateSignerToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * If all signers have signed, kick off PDF assembly + Drive upload and
 * flip the request to fully_signed. Otherwise return without doing
 * anything. Idempotent.
 */
export async function maybeFinalize(
  signatureRequestId: string,
): Promise<void> {
  const request = await db.query.signatureRequests.findFirst({
    where: eq(signatureRequests.id, signatureRequestId),
    with: { signers: true, application: true },
  });
  if (!request) return;
  if (request.status !== "pending") return;

  const allSigned = request.signers.every((s) => s.signedAt !== null);
  if (!allSigned) return;

  let drivePdfFileId: string | null = null;
  let drivePdfUrl: string | null = null;

  if (isDriveConfigured() && request.application.driveSubfolderIds) {
    try {
      const pdfBytes = await generateSignedPdf({
        title: request.title,
        bodyText: request.bodyText,
        sourceFileUrl: request.sourceFileUrl,
        sourceFileName: request.sourceFileName,
        sourceFileMimeType: request.sourceFileMimeType,
        version: request.version,
        signers: request.signers.map((s) => ({
          name: s.name,
          email: s.email,
          role: s.role,
          signature: s.signature ?? "",
          signedAt: s.signedAt ?? new Date(),
          signedIp: s.signedIp,
        })),
      });

      const subfolderIds = request.application.driveSubfolderIds;
      const targetFolderId = subfolderIds[request.targetSubfolderPath];
      if (targetFolderId) {
        const fileName = `${request.title}.pdf`.replace(/[\\/:*?"<>|]/g, "_");
        const uploaded = await uploadBufferToDriveFolder({
          buffer: pdfBytes,
          fileName,
          mimeType: "application/pdf",
          targetFolderId,
        });
        if (uploaded.ok) {
          drivePdfFileId = uploaded.fileId;
          drivePdfUrl = uploaded.url;
        } else {
          console.error(
            `[signature] Drive upload failed for request ${request.id}: ${uploaded.reason}`,
          );
        }
      } else {
        console.error(
          `[signature] No subfolder ID for "${request.targetSubfolderPath}" on application ${request.application.id}`,
        );
      }
    } catch (err) {
      console.error(
        `[signature] PDF generation failed for request ${request.id}:`,
        err,
      );
    }
  }

  await db
    .update(signatureRequests)
    .set({
      status: "fully_signed",
      drivePdfFileId,
      drivePdfUrl,
      updatedAt: new Date(),
    })
    .where(eq(signatureRequests.id, request.id));

  const messageBody = drivePdfUrl
    ? `All signatures collected on "${request.title}". The signed PDF is in the WRAPPER folder.`
    : `All signatures collected on "${request.title}".`;
  await postSystemMessage(request.applicationId, messageBody, null);
  notifyAttorneyOfMessage({
    applicationId: request.applicationId,
    authorName: "System",
    body: messageBody,
  }).catch((err) =>
    console.error("[signature] notifyAttorneyOfMessage failed:", err),
  );
  notifyCustomerOfMessage({
    applicationId: request.applicationId,
    authorName: "Strong Trademarks",
    body: messageBody,
  }).catch((err) =>
    console.error("[signature] notifyCustomerOfMessage failed:", err),
  );
}

/**
 * For admin "Re-generate PDF" — recompute the signed PDF for an already-
 * fully-signed request. Useful if the original upload failed.
 */
export async function regeneratePdf(
  signatureRequestId: string,
): Promise<
  | { ok: true; drivePdfFileId: string; drivePdfUrl: string }
  | { ok: false; reason: string }
> {
  const request = await db.query.signatureRequests.findFirst({
    where: eq(signatureRequests.id, signatureRequestId),
    with: { signers: true, application: true },
  });
  if (!request) return { ok: false, reason: "Signature request not found" };
  if (request.status !== "fully_signed") {
    return { ok: false, reason: "Request is not fully signed yet" };
  }
  if (!isDriveConfigured()) {
    return { ok: false, reason: "Drive is not configured" };
  }
  const subfolderIds = request.application.driveSubfolderIds;
  if (!subfolderIds) {
    return {
      ok: false,
      reason: "Application has no Drive WRAPPER folder yet",
    };
  }
  const targetFolderId = subfolderIds[request.targetSubfolderPath];
  if (!targetFolderId) {
    return {
      ok: false,
      reason: `No Drive subfolder for "${request.targetSubfolderPath}"`,
    };
  }

  const pdfBytes = await generateSignedPdf({
    title: request.title,
    bodyText: request.bodyText,
    sourceFileUrl: request.sourceFileUrl,
    sourceFileName: request.sourceFileName,
    sourceFileMimeType: request.sourceFileMimeType,
    version: request.version,
    signers: request.signers.map((s) => ({
      name: s.name,
      email: s.email,
      role: s.role,
      signature: s.signature ?? "",
      signedAt: s.signedAt ?? new Date(),
      signedIp: s.signedIp,
    })),
  });
  const fileName = `${request.title}.pdf`.replace(/[\\/:*?"<>|]/g, "_");
  const uploaded = await uploadBufferToDriveFolder({
    buffer: pdfBytes,
    fileName,
    mimeType: "application/pdf",
    targetFolderId,
  });
  if (!uploaded.ok) {
    return { ok: false, reason: uploaded.reason };
  }
  await db
    .update(signatureRequests)
    .set({
      drivePdfFileId: uploaded.fileId,
      drivePdfUrl: uploaded.url,
      updatedAt: new Date(),
    })
    .where(eq(signatureRequests.id, request.id));
  return {
    ok: true,
    drivePdfFileId: uploaded.fileId,
    drivePdfUrl: uploaded.url,
  };
}

// Avoid unused-import warning for copyBlobToDriveFolder if/when refactored.
void copyBlobToDriveFolder;
void applications;
void and;
void signatureRequestSigners;
