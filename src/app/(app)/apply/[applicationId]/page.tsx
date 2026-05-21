import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq, asc, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  applications,
  attorneyReviews,
  files as filesTable,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getDraftCookie } from "@/lib/draft-cookie";
import { ApplicationForm } from "./application-form";
import { DeleteDraftButton } from "@/components/delete-draft-button";
import type { ApplicationInput } from "../schema";

export default async function ApplicationPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;

  const [user, cookieId] = await Promise.all([
    getCurrentUser(),
    getDraftCookie(),
  ]);

  const app = await db.query.applications.findFirst({
    where: eq(applications.id, applicationId),
    with: {
      files: { orderBy: asc(filesTable.createdAt) },
      reviews: {
        orderBy: desc(attorneyReviews.createdAt),
        limit: 1,
      },
    },
  });
  if (!app) notFound();

  // Authorization: signed-in owner OR anonymous-with-matching-cookie.
  const isOwner = user && app.userId === user.id;
  const isAnonOwner = !app.userId && cookieId === app.id;
  if (!isOwner && !isAnonOwner) notFound();

  if (app.status !== "draft" && app.status !== "changes_requested") {
    redirect(`/apply/${applicationId}/review`);
  }

  const isResubmission = app.status === "changes_requested";
  const latestReview = app.reviews[0];

  const defaults: Partial<ApplicationInput> = {
    contactEmail: app.contactEmail ?? user?.email ?? undefined,
    contactName: app.contactName ?? user?.name ?? undefined,
    contactPhone: app.contactPhone ?? undefined,
    markType: app.markType ?? undefined,
    markText: app.markText ?? undefined,
    markDescription: app.markDescription ?? undefined,
    ownerName: app.ownerName ?? undefined,
    ownerEntityType: app.ownerEntityType ?? undefined,
    ownerAddress: app.ownerAddress ?? undefined,
    filingBasis: app.filingBasis ?? undefined,
    firstUseInCommerceDate: app.firstUseInCommerceDate ?? undefined,
    firstUseAnywhereDate: app.firstUseAnywhereDate ?? undefined,
    goodsServices:
      app.goodsServices && app.goodsServices.length > 0
        ? app.goodsServices
        : undefined,
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8">
        <Link
          href={user ? "/dashboard" : "/"}
          className="text-sm text-zinc-500 hover:underline"
        >
          ← {user ? "Back to dashboard" : "Back to home"}
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight">
            Trademark application
          </h1>
          {app.status === "draft" && (
            <DeleteDraftButton
              applicationId={applicationId}
              size="md"
              redirectTo={user ? "/dashboard" : "/"}
            />
          )}
        </div>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {isResubmission ? "Application " : "Draft "}
          <span className="font-mono">{applicationId.slice(0, 8)}</span>. Your
          progress saves as you type.
        </p>
      </div>

      {!isResubmission && (
        <div className="mb-8 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900/50">
          <p className="font-medium">
            Heads up — trademark filings are more complicated than they look.
          </p>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            The form below is designed to handle the common case (a U.S.
            individual or business filing one mark for goods or services
            they sell). If your situation is unusual — cease-and-desist
            already received, prior similar marks you&apos;re aware of, a
            descriptive or geographic mark, multi-country plans, or anything
            that feels &ldquo;not standard&rdquo; — you&apos;ll get a much
            better outcome with a full attorney consultation than with our
            flat-fee filing service.
          </p>
          <Link
            href="/consult"
            className="mt-3 inline-block text-sm font-medium underline"
          >
            Talk to an attorney instead →
          </Link>
        </div>
      )}

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
        initialFiles={app.files}
        isResubmission={isResubmission}
      />
    </div>
  );
}
