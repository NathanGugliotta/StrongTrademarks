// Daily USPTO TSDR poll. For each application with status='filed' (or
// later — once filed, we keep polling forever, since post-registration
// events still come through TSDR), fetch the snapshot, persist new
// events, post milestone messages, and auto-create deadlines.
//
// Sequential, not parallel — USPTO rate-limits TSDR and the firm's matter
// volume is small enough that serial is faster than tuning concurrency.

import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { applications } from "@/db/schema";
import { pollApplicationTsdr } from "@/lib/tsdr-poll";
import { isTsdrConfigured } from "@/lib/tsdr";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes — defensive ceiling for big runs

export async function GET(request: Request): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isTsdrConfigured()) {
    console.warn("[cron/tsdr-poll] USPTO_TSDR_API_KEY not set — skipping");
    return NextResponse.json({ ok: true, skipped: true });
  }

  // Keep polling once filed — even after registration, USPTO surfaces
  // post-registration events (Section 8/9 acceptances) we eventually
  // want to track. Cheap to keep checking; ~1 request/matter/day.
  const targets = await db.query.applications.findMany({
    where: inArray(applications.status, ["filed"]),
    columns: { id: true },
  });

  const summary: Array<{ applicationId: string } & Record<string, unknown>> =
    [];
  for (const app of targets) {
    try {
      const result = await pollApplicationTsdr(app.id);
      summary.push({ applicationId: app.id, ...result });
    } catch (err) {
      console.error(`[cron/tsdr-poll] failed for ${app.id}:`, err);
      summary.push({
        applicationId: app.id,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  console.log(
    `[cron/tsdr-poll] polled ${targets.length} application(s):`,
    JSON.stringify(summary),
  );
  return NextResponse.json({ ok: true, polled: targets.length, summary });
}
