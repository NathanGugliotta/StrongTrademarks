import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import {
  handleUpload,
  type HandleUploadBody,
} from "@vercel/blob/client";
import { requireAttorney } from "@/lib/auth";
import { db } from "@/db";
import { applications } from "@/db/schema";

const ATTORNEY_DOC_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

// Signature-source uploads accept everything the attorney doc upload does,
// plus Pages files (which browsers report variously as
// application/vnd.apple.pages, application/zip, or
// application/octet-stream — we accept all three and detect by filename).
const SIGNATURE_SOURCE_CONTENT_TYPES = [
  ...ATTORNEY_DOC_CONTENT_TYPES,
  "application/vnd.apple.pages",
  "application/zip",
  "application/octet-stream",
];

// Attorney uploads tend to be USPTO PDFs, which can run a bit larger than
// customer specimens. Cap at 25MB.
const MAX_BYTES = 25 * 1024 * 1024;

const clientPayloadSchema = z.object({
  applicationId: z.string().uuid(),
  kind: z.enum([
    "filing_receipt",
    "office_action",
    "office_action_response",
    "registration_certificate",
    "correspondence",
    "other",
    "signature_source",
  ]),
});

export async function POST(request: Request): Promise<NextResponse> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error:
          "File uploads aren't configured yet. The site owner needs to create a Vercel Blob store and add the BLOB_READ_WRITE_TOKEN env var.",
      },
      { status: 503 },
    );
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayloadRaw) => {
        const attorney = await requireAttorney();
        const parsed = clientPayloadSchema.safeParse(
          clientPayloadRaw ? JSON.parse(clientPayloadRaw) : null,
        );
        if (!parsed.success) {
          throw new Error("Invalid upload payload");
        }
        const { applicationId, kind } = parsed.data;

        const app = await db.query.applications.findFirst({
          where: eq(applications.id, applicationId),
        });
        if (!app) throw new Error("Application not found");

        const allowedContentTypes =
          kind === "signature_source"
            ? SIGNATURE_SOURCE_CONTENT_TYPES
            : ATTORNEY_DOC_CONTENT_TYPES;
        return {
          allowedContentTypes,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            applicationId,
            attorneyId: attorney.id,
            kind,
          }),
        };
      },
      onUploadCompleted: async () => {
        // Intentionally no-op. The blob row is recorded client-side via
        // recordAttorneyDocument so dev and prod paths match (Vercel Blob
        // webhooks don't reach localhost).
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 400 },
    );
  }
}
