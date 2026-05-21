// Core poll-one-application logic, shared between the daily cron and the
// admin "Refresh TSDR" button. Side effects:
//   - fetches TSDR snapshot for the application's USPTO serial
//   - inserts unseen events into uspto_status_events (idempotent on
//     unique key (applicationId, eventCode, eventDate))
//   - updates applications.tsdrCurrentStatus + lastTsdrPolledAt
//   - posts a thread message for each new milestone event
//   - auto-creates deadlines for events with an autoDeadline mapping
//
// Returns a small summary the caller can log/return.

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  applications,
  attorneyReviews,
  deadlines,
  usptoStatusEvents,
} from "@/db/schema";
import { fetchTsdrSnapshot, isTsdrConfigured } from "./tsdr";
import { addDays, lookupEvent } from "./uspto-lifecycle";
import { postSystemMessage } from "./messages";
import { notifyCustomerOfMessage } from "./notify";

export type PollResult = {
  serial: string;
  newEvents: number;
  newMilestones: number;
  newDeadlines: number;
  currentStatus: string | null;
  reason?: string;
};

export async function pollApplicationTsdr(
  applicationId: string,
): Promise<PollResult> {
  if (!isTsdrConfigured()) {
    return {
      serial: "",
      newEvents: 0,
      newMilestones: 0,
      newDeadlines: 0,
      currentStatus: null,
      reason: "USPTO_TSDR_API_KEY not set",
    };
  }

  const app = await db.query.applications.findFirst({
    where: eq(applications.id, applicationId),
    with: { reviews: true },
  });
  if (!app) {
    return {
      serial: "",
      newEvents: 0,
      newMilestones: 0,
      newDeadlines: 0,
      currentStatus: null,
      reason: "Application not found",
    };
  }
  // Serial comes from the most recent attorney 'filed' review.
  const filedReview = [...app.reviews]
    .reverse()
    .find((r) => r.status === "filed" && r.usptoSerialNumber);
  const serial = filedReview?.usptoSerialNumber?.trim();
  if (!serial) {
    return {
      serial: "",
      newEvents: 0,
      newMilestones: 0,
      newDeadlines: 0,
      currentStatus: null,
      reason: "No USPTO serial number on file",
    };
  }

  const snap = await fetchTsdrSnapshot(serial);
  if (!snap.ok) {
    return {
      serial,
      newEvents: 0,
      newMilestones: 0,
      newDeadlines: 0,
      currentStatus: null,
      reason: snap.reason,
    };
  }

  let newEvents = 0;
  let newMilestones = 0;
  let newDeadlines = 0;

  for (const event of snap.snapshot.events) {
    const mapping = lookupEvent(event.code);
    const milestoneKey = mapping?.milestoneKey ?? null;

    const inserted = await db
      .insert(usptoStatusEvents)
      .values({
        applicationId,
        eventCode: event.code,
        eventDescription: event.description,
        eventDate: event.date,
        milestoneKey,
        raw: event,
      })
      .onConflictDoNothing({
        target: [
          usptoStatusEvents.applicationId,
          usptoStatusEvents.eventCode,
          usptoStatusEvents.eventDate,
        ],
      })
      .returning({ id: usptoStatusEvents.id });

    if (inserted.length === 0) continue; // already seen
    newEvents++;

    if (!mapping) continue;
    if (mapping.notify) {
      newMilestones++;
      const body = `**${mapping.customerLabel}** (USPTO event, ${event.date})`;
      await postSystemMessage(applicationId, body, null, {
        kind: "uspto_milestone",
      });
      notifyCustomerOfMessage({
        applicationId,
        authorName: "Strong Trademarks",
        body,
      }).catch((err) =>
        console.error(
          `[tsdr] notifyCustomerOfMessage failed for ${applicationId}:`,
          err,
        ),
      );
    }

    if (mapping.autoDeadline) {
      const due = addDays(event.date, mapping.autoDeadline.offsetDays);
      // Idempotency: skip if a deadline of the same kind + due_date already
      // exists for this application (whether attorney-created or auto).
      const exists = await db.query.deadlines.findFirst({
        where: and(
          eq(deadlines.applicationId, applicationId),
          eq(deadlines.kind, mapping.autoDeadline.kind),
          eq(deadlines.dueDate, due),
        ),
      });
      if (!exists) {
        await db.insert(deadlines).values({
          applicationId,
          kind: mapping.autoDeadline.kind,
          title: mapping.autoDeadline.title,
          dueDate: due,
          notes: `Auto-created from USPTO ${event.code} on ${event.date}.`,
        });
        newDeadlines++;
      }
    }
  }

  await db
    .update(applications)
    .set({
      tsdrCurrentStatus: snap.snapshot.currentStatus,
      lastTsdrPolledAt: new Date(),
    })
    .where(eq(applications.id, applicationId));

  return {
    serial,
    newEvents,
    newMilestones,
    newDeadlines,
    currentStatus: snap.snapshot.currentStatus,
  };
}

// Avoid unused-import warnings in some downstream type analyses.
void attorneyReviews;
