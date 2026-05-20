import Link from "next/link";
import { eq } from "drizzle-orm";
import { CheckCircle2 } from "lucide-react";
import { db } from "@/db";
import { applications } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export default async function SuccessPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  const user = await getCurrentUser();
  const app = await db.query.applications.findFirst({
    where: eq(applications.id, applicationId),
  });

  const reference =
    app?.docketNumber ??
    `pending docket assignment (${applicationId.slice(0, 8)}…)`;

  return (
    <div className="mx-auto max-w-xl px-6 py-20 text-center">
      <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        Payment received
      </h1>
      <p className="mt-3 text-zinc-600 dark:text-zinc-400">
        Your application has been queued for attorney review. We&apos;ll email
        you when the attorney has reviewed and either filed or requested
        changes.
      </p>
      <p className="mt-3 text-sm text-zinc-500">
        Reference:{" "}
        <span className="font-mono font-medium text-zinc-700 dark:text-zinc-300">
          {reference}
        </span>
      </p>

      {user ? (
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Back to dashboard
          </Link>
          <Link
            href={`/apply/${applicationId}/review`}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            View application
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            To check on this application&apos;s status later, sign in with the
            same email you used here.
          </p>
          <Link
            href="/sign-in"
            className="inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Sign in to track your application
          </Link>
        </div>
      )}
    </div>
  );
}
