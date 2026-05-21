// Server-side docket assignment: looks up the next firm sequence from the
// Google Sheet, formats a docket, persists it on the application row, and
// appends a sheet row that mirrors what a manual entry would look like.
//
// This is called from the Stripe webhook when checkout.session.completed
// flips the application to "paid". Safe to call more than once for the same
// application — if a docket is already set, it's a no-op.

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { applications } from "@/db/schema";
import {
  derivePrefix,
  formatDocket,
  formatSheetDate,
  splitName,
} from "./docket";
import {
  appendDocketRow,
  computeNextDocketSequence,
  isSheetsConfigured,
} from "./sheets";
import { createWrapperFolder, isDriveConfigured } from "./drive";

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

  const sequence = await computeNextDocketSequence();
  if (sequence === null) {
    return { ok: false, reason: "Failed to read the docket sheet." };
  }

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
    try {
      const drive = await createWrapperFolder(folderName);
      if (drive.ok) {
        await db
          .update(applications)
          .set({ driveFolderId: drive.folderId, updatedAt: new Date() })
          .where(eq(applications.id, applicationId));
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
  }

  return { ok: true, docket, alreadyAssigned: false };
}
