import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import {
  handleUpload,
  type HandleUploadBody,
} from "@vercel/blob/client";
import { getCurrentUser } from "@/lib/auth";
import { getDraftCookie } from "@/lib/draft-cookie";
import { db } from "@/db";
import { applications } from "@/db/schema";

const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];
const MAX_BYTES = 10 * 1024 * 1024;

const clientPayloadSchema = z.object({
  applicationId: z.string().uuid(),
  kind: z.enum(["specimen", "drawing", "other"]),
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

        const [user, cookieId] = await Promise.all([
          getCurrentUser(),
          getDraftCookie(),
        ]);
        const isOwner = user && app.userId === user.id;
        const isAnonOwner = !app.userId && cookieId === app.id;
        if (!isOwner && !isAnonOwner) {
          throw new Error("Not authorized");
        }
        // Status check is the responsibility of the calling UI — the apply
        // form only renders during draft/changes_requested, and the review
        // page also accepts uploads (substitute specimens etc) at any
        // status. So we don't enforce status here at the token level.

        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            applicationId,
            userId: user?.id ?? null,
            kind,
          }),
        };
      },
      onUploadCompleted: async () => {
        // Intentionally no-op. See route comment in actions.ts.
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
