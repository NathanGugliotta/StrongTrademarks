"use server";

import { revalidatePath } from "next/cache";
import { requireAttorney } from "@/lib/auth";
import { pollApplicationTsdr } from "@/lib/tsdr-poll";

/**
 * Admin manual "Refresh TSDR" — runs the same poll the daily cron does for
 * a single matter. Used for testing or when an attorney wants the latest
 * USPTO status now rather than waiting for tomorrow's cron.
 */
export async function refreshTsdrForApplication(
  applicationId: string,
): Promise<
  | { ok: true; summary: Awaited<ReturnType<typeof pollApplicationTsdr>> }
  | { ok: false; error: string }
> {
  await requireAttorney();
  try {
    const summary = await pollApplicationTsdr(applicationId);
    revalidatePath(`/admin/applications/${applicationId}`);
    revalidatePath(`/apply/${applicationId}/review`);
    if (summary.reason) {
      return { ok: false, error: summary.reason };
    }
    return { ok: true, summary };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Refresh failed",
    };
  }
}
