// Mirror an uploaded Vercel Blob file into the matter's WRAPPER folder on
// Google Drive. Used after a file row is recorded in the DB so the file
// shows up where attorneys expect (e.g. specimens land in
// "01 Application/Specimens" for the matter's WRAPPER).
//
// Best-effort: Drive failures are logged but don't fail the upload —
// the file is already safely in Blob and recorded in our DB.

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { applications } from "@/db/schema";
import {
  copyBlobToDriveFolder,
  isDriveConfigured,
  subfolderPathFor,
} from "./drive";

export async function mirrorUploadToDrive(args: {
  applicationId: string;
  blobUrl: string;
  fileName: string;
  mimeType: string;
  kind: string;
  uploadedByRole: "customer" | "attorney" | "admin";
}): Promise<void> {
  if (!isDriveConfigured()) return;

  const app = await db.query.applications.findFirst({
    where: eq(applications.id, args.applicationId),
  });
  if (!app) {
    console.error(
      `[drive-mirror] Application ${args.applicationId} not found`,
    );
    return;
  }
  if (!app.driveSubfolderIds) {
    // The WRAPPER folder either wasn't created (Drive not configured at
    // the time) or pre-dates the subfolder-map feature. Nothing to do.
    console.log(
      `[drive-mirror] Application ${args.applicationId} has no driveSubfolderIds; skipping`,
    );
    return;
  }

  const path = subfolderPathFor(args.kind, args.uploadedByRole);
  const targetFolderId = app.driveSubfolderIds[path];
  if (!targetFolderId) {
    console.error(
      `[drive-mirror] No folder ID for path "${path}" on ${args.applicationId}`,
    );
    return;
  }

  const result = await copyBlobToDriveFolder({
    blobUrl: args.blobUrl,
    fileName: args.fileName,
    mimeType: args.mimeType,
    targetFolderId,
  });
  if (!result.ok) {
    console.error(
      `[drive-mirror] Copy failed for ${args.applicationId} ("${args.fileName}" → ${path}): ${result.reason}`,
    );
  } else {
    console.log(
      `[drive-mirror] Copied "${args.fileName}" → ${path} (driveId=${result.fileId}) for ${args.applicationId}`,
    );
  }
}
