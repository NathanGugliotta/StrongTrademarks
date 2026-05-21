// Server-side docket assignment: looks up the next firm sequence from the
// Google Sheet, formats a docket, persists it on the application row, and
// appends a sheet row that mirrors what a manual entry would look like.
//
// This is called from the Stripe webhook when checkout.session.completed
// flips the application to "paid". Safe to call more than once for the same
// application — if a docket is already set, it's a no-op.

import { eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { applications } from "@/db/schema";
import {
  derivePrefix,
  formatDocket,
  formatSheetDate,
  parseDocketSequence,
  splitName,
} from "./docket";
import {
  appendDocketRow,
  computeNextDocketSequence,
  isSheetsConfigured,
} from "./sheets";
import { createWrapperFolder, isDriveConfigured } from "./drive";

const MAX_REASONABLE_DOCKET_SEQUENCE = 100_000;

/**
 * Highest sequence number among dockets we've already saved in the DB.
 * Used as a floor so we never reassign a number our DB has already
 * claimed (the applications.docket_number unique constraint would
 * otherwise blow up mid-write).
 */
async function getMaxDbDocketSequence(): Promise<number> {
  const rows = await db.query.applications.findMany({
    where: isNotNull(applications.docketNumber),
    columns: { docketNumber: true },
  });
  let max = 0;
  for (const r of rows) {
    const seq = parseDocketSequence(r.docketNumber);
    if (
      seq !== null &&
      seq > max &&
      seq <= MAX_REASONABLE_DOCKET_SEQUENCE
    ) {
      max = seq;
    }
  }
  return max;
}

export async function assignDocketIfNeeded(applicationId: string): Promise<
  | { ok: true; docket: string; alreadyAssigned: boolean }
  | { ok: false; reason: string }
> {
  const app = await db.query.applications.findFirst({
    where: eq(applications.id, applicationId),
  });
  if (!app) return { ok: false, reason: "Application not found" };
  if (app.docketNumber) {
    return { ok: true, docket: app.docketNumber, alreadyAssigned: true };
  }
  if (!isSheetsConfigured()) {
    return {
      ok: false,
      reason:
        "Google Sheets is not configured (GOOGLE_SERVICE_ACCOUNT_KEY / DOCKET_SHEET_ID missing).",
    };
  }

  const sequenceFromSheet = await computeNextDocketSequence();
  if (sequenceFromSheet === null) {
    return { ok: false, reason: "Failed to read the docket sheet." };
  }
  // Floor the sheet's "next" with whatever's in our DB so we never pick a
  // number that already exists in applications.docket_number (the unique
  // constraint there would otherwise throw mid-write after the sheet row
  // is already inserted).
  const dbMax = await getMaxDbDocketSequence();
  const sequence = Math.max(sequenceFromSheet, dbMax + 1);

  const prefix = derivePrefix(app.contactName);
  const docket = formatDocket(prefix, sequence);
  const { firstName, lastName } = splitName(app.contactName);

  // Company column gets ownerName only when the owner is an entity, not the
  // individual contact (avoids duplicating LAST/FIRST NAME).
  const company =
    app.ownerEntityType && app.ownerEntityType !== "individual"
      ? app.ownerName
      : null;

  const appendResult = await appendDocketRow(
    {
      docket,
      docketDate: formatSheetDate(),
      titleMark: app.markText ?? "",
      company,
      lastName,
      firstName,
      country: "US",
      user: "NJG",
    },
    sequence + 1, // row-2 "next available" pointer becomes seq + 1
  );

  if (!appendResult) {
    return { ok: false, reason: "Failed to append docket row to the sheet." };
  }

  await db
    .update(applications)
    .set({ docketNumber: docket, updatedAt: new Date() })
    .where(eq(applications.id, applicationId));

  // Best-effort: create the firm's WRAPPER folder in Google Drive matching
  // the manual naming convention. Failure isn't fatal — the docket is
  // already assigned and visible everywhere else, and the attorney can
  // create the folder by hand if Drive is unreachable.
  if (isDriveConfigured()) {
    const folderName = `${lastName}, ${firstName} ${docket} (${app.markText ?? ""})`.replace(
      / +\(\)$/,
      "",
    );
    console.log(
      `[drive] Creating WRAPPER folder for ${docket}: "${folderName}"`,
    );
    try {
      const drive = await createWrapperFolder(folderName);
      if (drive.ok) {
        await db
          .update(applications)
          .set({
            driveFolderId: drive.folderId,
            driveSubfolderIds: drive.subfolderIds,
            updatedAt: new Date(),
          })
          .where(eq(applications.id, applicationId));
        console.log(
          `[drive] WRAPPER folder created for ${docket}: id=${drive.folderId} url=${drive.url} subfolders=${Object.keys(drive.subfolderIds).length}`,
        );
      } else {
        console.error(
          `[drive] Folder creation skipped for ${docket}: ${drive.reason}`,
        );
      }
    } catch (err) {
      console.error(
        `[drive] Unexpected error creating folder for ${docket}:`,
        err,
      );
    }
  } else {
    console.log(
      `[drive] Not configured (missing WRAPPER_DRIVE_FOLDER_ID or service account JSON), skipping for ${docket}`,
    );
  }

  return { ok: true, docket, alreadyAssigned: false };
}
