import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq, asc, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  applications,
  attorneyReviews,
  files as filesTable,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ApplicationForm } from "./application-form";
import { SpecimenUploader } from "./specimen-uploader";
import type { ApplicationInput } from "../schema";

export default async function ApplicationPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  const user = await requireUser();

  const app = await db.query.applications.findFirst({
    where: and(
      eq(applications.id, applicationId),
      eq(applications.userId, user.id),
    ),
    with: {
      files: { orderBy: asc(filesTable.createdAt) },
      reviews: {
        orderBy: desc(attorneyReviews.createdAt),
        limit: 1,
      },
    },
  });
  if (!app) notFound();

  const isResubmission = app.status === "changes_requested";
  const latestReview = app.reviews[0];

  // Editable in draft and changes_requested. Otherwise redirect to the review
  // page (which shows status, attorney notes, payment state, etc.).
  if (app.status !== "draft" && app.status !== "changes_requested") {
    redirect(`/apply/${applicationId}/review`);
  }

  const defaults: Partial<ApplicationInput> = {
    markType: app.markType ?? undefined,
    markText: app.markText ?? undefined,
    markDescription: app.markDescription ?? undefined,
    ownerName: app.ownerName ?? undefined,
    ownerEntityType: app.ownerEntityType ?? undefined,
    ownerAddress: app.ownerAddress ?? undefined,
    filingBasis: app.filingBasis ?? undefined,
    goodsServices:
      app.goodsServices && app.goodsServices.length > 0
        ? app.goodsServices
        : undefined,
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="text-sm text-zinc-500 hover:underline"
        >
          ← Back to dashboard
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Trademark application
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {isResubmission ? "Application " : "Draft "}
          <span className="font-mono">{applicationId.slice(0, 8)}</span>. Your
          progress saves as you type.
        </p>
      </div>

      {isResubmission && latestReview?.notes && (
        <div className="mb-8 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Your attorney has requested changes
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-amber-900/90 dark:text-amber-100">
            {latestReview.notes}
          </p>
          <p className="mt-3 text-xs text-amber-800 dark:text-amber-300">
            Update the application below to address the feedback, then click
            &ldquo;Resubmit for review&rdquo;. You won&apos;t be charged again.
          </p>
        </div>
      )}

      <ApplicationForm
        applicationId={applicationId}
        defaultValues={defaults}
        isResubmission={isResubmission}
      />

      <section className="mt-12 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <h2 className="text-xl font-semibold">Specimens &amp; drawings</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          For a <span className="font-medium">use in commerce</span> filing,
          upload a specimen showing the mark used on your goods or services
          (product photo, packaging, screenshot of your site, etc.). For a
          design or combined mark, upload the drawing.
        </p>
        <div className="mt-6">
          <SpecimenUploader
            applicationId={applicationId}
            initialFiles={app.files}
          />
        </div>
      </section>
    </div>
  );
}
