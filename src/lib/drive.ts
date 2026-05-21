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
 * Standard matter subfolder structure inside each client WRAPPER folder.
 * Numeric prefixes control sort order in Drive (alphabetical otherwise).
 * Mirrors the firm's manual convention.
 */
interface FolderTree {
  [name: string]: FolderTree;
}
const MATTER_SUBFOLDER_TREE: FolderTree = {
  "01 Application": {
    Drawings: {},
    Questionnaire: {},
    "Registration Documents": {},
    Search: {},
    Specimens: {},
  },
  "02 Filing Documents": {},
  "03 Office Actions": {},
  "04 Publication": {},
  "05 Use Filings": {},
  "06 Renewals": {
    "5–6 Year Renewal": {},
    "9–10 Year Renewals": {},
  },
  "07 Research": {},
  "08 Assignments": {
    "Executed Agreements": {},
    "Working Files": {},
  },
  "09 TTAB": {
    Appeals: {
      Brief: {},
    },
    Cancellations: {
      Answer: {},
      Discovery: {},
      "Petition for Cancellation": {},
      Pleadings: {},
      Settlement: {
        "Executed Agreements": {},
        "Working Files": {},
      },
      "Summary Judgment": {},
    },
    Oppositions: {
      Answer: {},
      Discovery: {},
      "Notice of Opposition": {},
      Pleadings: {},
      Settlement: {
        "Executed Agreements": {},
        "Working Files": {},
      },
      "Summary Judgment": {},
    },
  },
};

async function createFolderInParent(
  drive: drive_v3.Drive,
  parentId: string,
  name: string,
): Promise<string> {
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
    supportsAllDrives: true,
  });
  if (!res.data.id) throw new Error(`Drive returned no ID for "${name}"`);
  return res.data.id;
}

async function createSubtree(
  drive: drive_v3.Drive,
  parentId: string,
  tree: FolderTree,
): Promise<void> {
  // Siblings get created in parallel; nested children wait for their
  // immediate parent before recursing. With ~35 folders across 5 levels,
  // this completes in ~2s instead of ~5s sequential.
  await Promise.all(
    Object.entries(tree).map(async ([name, children]) => {
      const folderId = await createFolderInParent(drive, parentId, name);
      if (Object.keys(children).length > 0) {
        await createSubtree(drive, folderId, children);
      }
    }),
  );
}

/**
 * Create the client WRAPPER folder + the full firm matter subfolder
 * structure inside it. Returns the new top folder's ID + a shareable URL.
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
    const folderId = await createFolderInParent(drive, parentId, folderName);
    // Get the webViewLink for the top folder — separate request since the
    // create response doesn't include it when we only ask for id.
    let url = driveFolderUrl(folderId);
    try {
      const meta = await drive.files.get({
        fileId: folderId,
        fields: "webViewLink",
        supportsAllDrives: true,
      });
      url = meta.data.webViewLink ?? url;
    } catch {
      // Non-fatal; fall back to the constructed URL.
    }

    // Build the matter subfolder structure inside the new WRAPPER folder.
    // If any subfolder fails, the top WRAPPER is still usable — attorney
    // can recreate the missing pieces by hand or we can wire a "rebuild"
    // button later.
    console.log(`[drive] Building subfolder tree inside ${folderId}`);
    try {
      await createSubtree(drive, folderId, MATTER_SUBFOLDER_TREE);
      console.log(`[drive] Subfolder tree complete inside ${folderId}`);
    } catch (err) {
      console.error(
        "[drive] Subfolder tree creation partially failed:",
        err,
      );
    }

    return { ok: true, folderId, url };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Drive API error",
    };
  }
}
