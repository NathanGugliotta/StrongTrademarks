// Unread-count tracking for application message threads. Reuses the simple
// last-read-timestamp model on applications (customer_last_read_at /
// attorney_last_read_at). Counts every message authored by the other side
// (or system) that's newer than the viewer's last-read timestamp.

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { applications } from "@/db/schema";

export type Side = "customer" | "attorney";

type AppMessage = {
  authorRole: string;
  createdAt: Date;
};

type AppWithMessages = {
  id: string;
  customerLastReadAt: Date | null;
  attorneyLastReadAt: Date | null;
  messages: AppMessage[];
};

/**
 * Given an application row already loaded with its messages, return how
 * many are unread for the given side.
 */
export function countUnreadFor(side: Side, app: AppWithMessages): number {
  const lastRead =
    side === "customer" ? app.customerLastReadAt : app.attorneyLastReadAt;
  const lastReadMs = lastRead ? lastRead.getTime() : 0;
  return app.messages.filter((m) => {
    if (side === "customer") {
      if (m.authorRole === "customer") return false;
    } else {
      if (m.authorRole === "attorney" || m.authorRole === "admin") return false;
    }
    return m.createdAt.getTime() > lastReadMs;
  }).length;
}

/**
 * Mark the entire thread as read for the given side. Called from the page
 * that owns the thread (e.g. customer's /apply/[id]/review or admin's
 * /admin/applications/[id]) so visiting the page clears the unread badge.
 *
 * Idempotent — calling repeatedly just bumps the timestamp.
 */
export async function markRead(
  applicationId: string,
  side: Side,
): Promise<void> {
  const column =
    side === "customer" ? "customerLastReadAt" : "attorneyLastReadAt";
  await db
    .update(applications)
    .set({ [column]: new Date() })
    .where(eq(applications.id, applicationId));
}
