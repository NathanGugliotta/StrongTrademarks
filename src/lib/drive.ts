// Google Drive integration — creates the firm's "WRAPPER" folder for a
// new matter when a docket is assigned, using the same service account
// that powers the docket sheet and intake calendar.
//
// Setup:
//   1. Enable the Google Drive API in your Cloud Console project (same
//      project as the Sheets / Calendar APIs).
//   2. In Google Drive, locate (or create) the parent folder where all
//      client WRAPPERs live — e.g. "WRAPPER" at the top of the firm's
//      shared drive.
//   3. Share that parent folder with the service account email
//      (strong-trademarks-sheets@strong-trademarks.iam.gserviceaccount.com)
//      with "Editor" permission.
//   4. Grab the parent folder's ID from its URL — looks like
//      https://drive.google.com/drive/folders/<THIS_PART>
//   5. Set WRAPPER_DRIVE_FOLDER_ID in Vercel env vars.

import { google, type drive_v3 } from "googleapis";

let _cachedClient: drive_v3.Drive | null = null;

function getCredentials(): { client_email: string; private_key: string } | null {
  const raw =
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 ??
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  let json: { client_email?: string; private_key?: string };
  try {
    const decoded = raw.trim().startsWith("{")
      ? raw
      : Buffer.from(raw, "base64").toString("utf-8");
    json = JSON.parse(decoded);
  } catch {
    return null;
  }
  if (!json.client_email || !json.private_key) return null;
  return {
    client_email: json.client_email,
    private_key: json.private_key.replace(/\\n/g, "\n"),
  };
}

function getDriveClient(): drive_v3.Drive | null {
  if (_cachedClient) return _cachedClient;
  const creds = getCredentials();
  if (!creds) return null;
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  _cachedClient = google.drive({ version: "v3", auth });
  return _cachedClient;
}

export function isDriveConfigured(): boolean {
  return Boolean(getCredentials() && process.env.WRAPPER_DRIVE_FOLDER_ID);
}

export function driveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

/**
 * Create a new folder inside the firm's WRAPPER root, named exactly as the
 * firm's manual convention dictates ("Last, First DOCKET (Mark)"). Returns
 * the new folder's ID + a shareable URL.
 *
 * Drive permits duplicate folder names in the same parent (it differentiates
 * by ID), so a re-run won't error out — but we don't expect re-runs because
 * docket assignment is idempotent on the application row.
 */
export async function createWrapperFolder(
  folderName: string,
): Promise<
  | { ok: true; folderId: string; url: string }
  | { ok: false; reason: string }
> {
  const drive = getDriveClient();
  if (!drive) return { ok: false, reason: "Drive not configured" };
  const parentId = process.env.WRAPPER_DRIVE_FOLDER_ID;
  if (!parentId) {
    return { ok: false, reason: "WRAPPER_DRIVE_FOLDER_ID not set" };
  }
  try {
    const res = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
      },
      fields: "id, webViewLink",
      // Use supportsAllDrives so this works in shared drives, not just
      // "My Drive". Most law firms run on a shared drive.
      supportsAllDrives: true,
    });
    const folderId = res.data.id;
    if (!folderId) return { ok: false, reason: "Drive returned no folder ID" };
    return {
      ok: true,
      folderId,
      url: res.data.webViewLink ?? driveFolderUrl(folderId),
    };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Drive API error",
    };
  }
}
