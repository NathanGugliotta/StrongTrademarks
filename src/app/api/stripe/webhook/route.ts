import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe";
import { db } from "@/db";
import { applications, payments } from "@/db/schema";
import { assignDocketIfNeeded } from "@/lib/docket-assign";
import { addIntakeEvent, isCalendarConfigured } from "@/lib/calendar";
import { postSystemMessage } from "@/lib/messages";
import { notifyAttorneyOfMessage } from "@/lib/notify";
import { formatCents } from "@/lib/utils";
import type Stripe from "stripe";

// Stripe needs the raw body to verify the signature, so we read it as text.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET not configured" },
      { status: 500 },
    );
  }

  const sig = (await headers()).get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${err}` },
      { status: 400 },
    );
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const applicationId = session.metadata?.applicationId;
      if (!applicationId) break;

      const feeType = session.metadata?.fee_type ?? "service";

      await db
        .update(payments)
        .set({
          status: "succeeded",
          stripePaymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id ?? null,
        })
        .where(eq(payments.stripeSessionId, session.id));

      if (feeType === "uspto") {
        // USPTO filing-fee invoice paid. Don't touch application status or
        // re-assign a docket — those happened at the first (service-fee)
        // checkout. Just notify and post into the thread so both sides
        // know it cleared.
        const amount =
          typeof session.amount_total === "number"
            ? session.amount_total
            : null;
        const messageBody = amount
          ? `Thanks for your USPTO filing fee payment of ${formatCents(amount)}. Your attorney will file your application within 3 business days and confirm here when it's done.`
          : `Thanks for your USPTO filing fee payment. Your attorney will file your application within 3 business days and confirm here when it's done.`;
        await postSystemMessage(applicationId, messageBody, null);
        notifyAttorneyOfMessage({
          applicationId,
          authorName: "System",
          body: messageBody,
        }).catch((err) =>
          console.error(
            "[notify] notifyAttorneyOfMessage (uspto paid) failed:",
            err,
          ),
        );
        break;
      }

      // Below here: original service-fee flow.
      await db
        .update(applications)
        .set({ status: "paid", updatedAt: new Date() })
        .where(eq(applications.id, applicationId));

      // Assign a firm docket number + append to the Google Sheet master.
      // Failures here are logged but do not fail the webhook — Stripe would
      // keep retrying otherwise, and we'd rather degrade to "docket unassigned,
      // attorney can assign manually later" than block payment confirmation.
      let assignedDocket: string | null = null;
      try {
        const result = await assignDocketIfNeeded(applicationId);
        if (!result.ok) {
          console.error(
            `[docket] Skipped assignment for ${applicationId}: ${result.reason}`,
          );
        } else {
          assignedDocket = result.docket;
          console.log(
            `[docket] Assigned ${result.docket} to ${applicationId}${result.alreadyAssigned ? " (already assigned)" : ""}`,
          );
        }
      } catch (err) {
        console.error(
          `[docket] Unexpected error assigning docket for ${applicationId}:`,
          err,
        );
      }

      // Push the docket onto the Stripe PaymentIntent so it shows up in the
      // Stripe dashboard next to the payment (description column + metadata).
      // This makes reconciling Stripe payouts against firm matters trivial.
      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null;
      let appForDownstream:
        | Awaited<ReturnType<typeof db.query.applications.findFirst>>
        | null = null;
      if (assignedDocket && paymentIntentId) {
        try {
          appForDownstream = await db.query.applications.findFirst({
            where: eq(applications.id, applicationId),
          });
          await stripe.paymentIntents.update(paymentIntentId, {
            description: `${assignedDocket} — ${appForDownstream?.markText ?? "Trademark filing"} — ${appForDownstream?.contactName ?? ""}`.trim(),
            metadata: {
              applicationId,
              userId: appForDownstream?.userId ?? "",
              docket: assignedDocket,
              mark: appForDownstream?.markText ?? "",
              customer: appForDownstream?.contactName ?? "",
            },
          });
        } catch (err) {
          console.error(
            "[stripe] Failed to update PaymentIntent with docket:",
            err,
          );
        }
      }

      // Drop a calendar event into the firm's intake calendar so attorneys
      // see new matters in their normal day-planning view. Failures don't
      // fail the webhook — the application is already paid and queued in
      // the admin inbox regardless.
      if (assignedDocket && isCalendarConfigured()) {
        try {
          const app =
            appForDownstream ??
            (await db.query.applications.findFirst({
              where: eq(applications.id, applicationId),
            }));
          const origin =
            process.env.AUTH_URL ?? "https://strong-trademarks.vercel.app";
          const result = await addIntakeEvent({
            docket: assignedDocket,
            markText: app?.markText ?? "(no mark text)",
            customerName: app?.contactName ?? "(no name)",
            customerEmail: app?.contactEmail ?? "",
            applicationUrl: `${origin}/admin/applications/${applicationId}`,
          });
          if (!result.ok) {
            console.error(
              `[calendar] Skipped intake event for ${applicationId}: ${result.reason}`,
            );
          } else {
            console.log(
              `[calendar] Added intake event ${result.eventId} for ${assignedDocket}`,
            );
          }
        } catch (err) {
          console.error(
            `[calendar] Unexpected error adding event for ${applicationId}:`,
            err,
          );
        }
      }
      break;
    }
    case "checkout.session.expired":
    case "payment_intent.payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.id) {
        await db
          .update(payments)
          .set({ status: "failed" })
          .where(eq(payments.stripeSessionId, session.id));
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
