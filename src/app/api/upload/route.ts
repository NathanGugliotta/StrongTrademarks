import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import {
  handleUpload,
  type HandleUploadBody,
} from "@vercel/blob/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { applications } from "@/db/schema";

const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

const clientPayloadSchema = z.object({
  applicationId: z.string().uuid(),
  kind: z.enum(["specimen", "drawing", "other"]),
});

// Issues short-lived Vercel Blob client tokens for direct browser uploads.
// The actual DB insert happens client-side after the upload via
// recordSpecimen() in upload-actions.ts — this lets local dev work without
// needing the onUploadCompleted webhook to be publicly reachable.
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayloadRaw) => {
        const user = await requireUser();
        const parsed = clientPayloadSchema.safeParse(
          clientPayloadRaw ? JSON.parse(clientPayloadRaw) : null,
        );
        if (!parsed.success) {
          throw new Error("Invalid upload payload");
        }
        const { applicationId, kind } = parsed.data;

        const app = await db.query.applications.findFirst({
          where: and(
            eq(applications.id, applicationId),
            eq(applications.userId, user.id),
          ),
        });
        if (!app) throw new Error("Application not found");
        if (app.status !== "draft") {
          throw new Error("Application is no longer editable");
        }

        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            applicationId,
            userId: user.id,
            kind,
          }),
        };
      },
      onUploadCompleted: async () => {
        // Intentionally no-op. See route comment.
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
