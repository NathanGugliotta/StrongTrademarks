import { notFound } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { signatureRequestSigners } from "@/db/schema";
import { SignPageClient } from "./sign-page-client";

export const dynamic = "force-dynamic";

export default async function SignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const signer = await db.query.signatureRequestSigners.findFirst({
    where: eq(signatureRequestSigners.token, token),
    with: {
      request: {
        with: { signers: true },
      },
    },
  });

  if (!signer) notFound();
  const request = signer.request;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← Strong Trademarks
      </Link>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Signature requested
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        You&apos;re signing as{" "}
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          {signer.name} &lt;{signer.email}&gt;
        </span>
        .
      </p>

      {signer.signedAt ? (
        <div className="mt-8 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
          You signed this on {signer.signedAt.toLocaleString()}. Thanks — no
          further action needed.
        </div>
      ) : request.status === "voided" ? (
        <div className="mt-8 rounded-md border border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
          This signature request has been voided.
        </div>
      ) : request.status === "fully_signed" ? (
        <div className="mt-8 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
          All signers have completed this request.
        </div>
      ) : (
        <div className="mt-8">
          <SignPageClient
            token={token}
            signerEmail={signer.email}
            request={{
              id: request.id,
              title: request.title,
              status: request.status,
              bodyText: request.bodyText,
              sourceFileUrl: request.sourceFileUrl,
              sourceFileName: request.sourceFileName,
              sourceFileMimeType: request.sourceFileMimeType,
              drivePdfUrl: request.drivePdfUrl,
              signers: request.signers.map((s) => ({
                id: s.id,
                name: s.name,
                email: s.email,
                role: s.role,
                signedAt: s.signedAt,
              })),
            }}
          />
        </div>
      )}
    </div>
  );
}
