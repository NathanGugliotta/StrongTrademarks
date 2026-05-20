import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe";
import { db } from "@/db";
import { applications, payments } from "@/db/schema";
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

      await db
        .update(applications)
        .set({ status: "paid", updatedAt: new Date() })
        .where(eq(applications.id, applicationId));
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
