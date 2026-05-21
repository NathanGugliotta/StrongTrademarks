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

import { Readable } from "node:stream";
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
  // Service accounts have zero Drive storage quota of their own — any
  // file they create in "My Drive" fails with a quota error. Two ways to
  // work around it:
  //   1. Put WRAPPER inside a Workspace Shared Drive (the drive owns
  //      files, no per-user quota).
  //   2. Domain-wide delegation: SA impersonates a real Workspace user
  //      via JWT `subject`, files are owned by that user.
  // GOOGLE_IMPERSONATE_EMAIL toggles option 2. Setup:
  //   - Admin console → Security → Access and data control → API controls
  //     → Domain-wide delegation → Add the SA's client ID with scope
  //     https://www.googleapis.com/auth/drive
  //   - Set GOOGLE_IMPERSONATE_EMAIL to the user whose quota should pay
  //     for the storage (typically the firm's primary Workspace user).
  const subject = process.env.GOOGLE_IMPERSONATE_EMAIL?.trim() || undefined;
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/drive"],
    subject,
  });
  _cachedClient = google.drive({ version: "v3", auth });
  return _cachedClient;
}

export function isDriveConfigured(): boolean {
  return Boolean(getCredentials() && process.env.WRAPPER_DRIVE_FOLDER_ID);
}

/**
 * Map a file kind (+ which side uploaded it) to the relative subfolder
 * path within the matter's WRAPPER folder. Keys match what createSubtree
 * produces, so callers can look up the folder ID directly from the map
 * stored on applications.drive_subfolder_ids.
 */
export function subfolderPathFor(
  kind: string,
  uploadedByRole: "customer" | "attorney" | "admin",
): string {
  if (uploadedByRole === "customer") {
    switch (kind) {
      case "specimen":
        return "01 Application/Specimens";
      case "drawing":
        return "01 Application/Drawings";
      default:
        return "01 Application";
    }
  }
  // Attorney / admin uploads
  switch (kind) {
    case "filing_receipt":
      return "02 Filing Documents";
    case "office_action":
    case "office_action_response":
      return "03 Office Actions";
    case "registration_certificate":
      return "01 Application/Registration Documents";
    case "correspondence":
      return "02 Filing Documents";
    default:
      return "02 Filing Documents";
  }
}

/**
 * Copy a file from a public Vercel Blob URL into a specific Drive folder.
 * Returns the new Drive file ID + a shareable URL.
 *
 * This downloads the blob into a buffer and re-uploads. For typical
 * trademark filings (specimens are images, USPTO PDFs <25MB) this is
 * fast — usually <2s end-to-end. Larger files would warrant a streaming
 * approach.
 */
export async function copyBlobToDriveFolder(args: {
  blobUrl: string;
  fileName: string;
  mimeType: string;
  targetFolderId: string;
}): Promise<
  | { ok: true; fileId: string; url: string }
  | { ok: false; reason: string }
> {
  const drive = getDriveClient();
  if (!drive) return { ok: false, reason: "Drive not configured" };

  try {
    const response = await fetch(args.blobUrl);
    if (!response.ok) {
      return {
        ok: false,
        reason: `Failed to fetch blob (HTTP ${response.status})`,
      };
    }
    const buffer = Buffer.from(await response.arrayBuffer());

    const res = await drive.files.create({
      requestBody: {
        name: args.fileName,
        parents: [args.targetFolderId],
        mimeType: args.mimeType,
      },
      media: {
        mimeType: args.mimeType,
        body: Readable.from(buffer),
      },
      fields: "id, webViewLink",
      supportsAllDrives: true,
    });

    const fileId = res.data.id;
    if (!fileId) {
      return { ok: false, reason: "Drive returned no file ID" };
    }
    return {
      ok: true,
      fileId,
      url:
        res.data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`,
    };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Drive copy failed",
    };
  }
}

/**
 * Upload an in-memory Buffer (e.g. a freshly-generated signed PDF) into a
 * specific Drive folder. Same contract as copyBlobToDriveFolder but skips
 * the fetch-from-Blob step.
 */
export async function uploadBufferToDriveFolder(args: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  targetFolderId: string;
}): Promise<
  | { ok: true; fileId: string; url: string }
  | { ok: false; reason: string }
> {
  const drive = getDriveClient();
  if (!drive) return { ok: false, reason: "Drive not configured" };
  try {
    const res = await drive.files.create({
      requestBody: {
        name: args.fileName,
        parents: [args.targetFolderId],
        mimeType: args.mimeType,
      },
      media: {
        mimeType: args.mimeType,
        body: Readable.from(args.buffer),
      },
      fields: "id, webViewLink",
      supportsAllDrives: true,
    });
    const fileId = res.data.id;
    if (!fileId) return { ok: false, reason: "Drive returned no file ID" };
    return {
      ok: true,
      fileId,
      url:
        res.data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`,
    };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Drive upload failed",
    };
  }
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
  pathPrefix = "",
): Promise<Record<string, string>> {
  // Siblings get created in parallel; nested children wait for their
  // immediate parent before recursing. Returns a map of full path
  // ("01 Application/Specimens") → folder ID so callers can store the
  // map and later look up which subfolder to drop a file into.
  const result: Record<string, string> = {};
  await Promise.all(
    Object.entries(tree).map(async ([name, children]) => {
      const folderId = await createFolderInParent(drive, parentId, name);
      const fullPath = pathPrefix ? `${pathPrefix}/${name}` : name;
      result[fullPath] = folderId;
      if (Object.keys(children).length > 0) {
        const sub = await createSubtree(
          drive,
          folderId,
          children,
          fullPath,
        );
        Object.assign(result, sub);
      }
    }),
  );
  return result;
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
  | {
      ok: true;
      folderId: string;
      url: string;
      subfolderIds: Record<string, string>;
    }
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
    let subfolderIds: Record<string, string> = {};
    try {
      subfolderIds = await createSubtree(drive, folderId, MATTER_SUBFOLDER_TREE);
      console.log(
        `[drive] Subfolder tree complete inside ${folderId} (${Object.keys(subfolderIds).length} folders)`,
      );
    } catch (err) {
      console.error(
        "[drive] Subfolder tree creation partially failed:",
        err,
      );
    }

    return { ok: true, folderId, url, subfolderIds };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Drive API error",
    };
  }
}
