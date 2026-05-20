import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { stripe, TRADEMARK_FEE_CENTS } from "@/lib/stripe";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { applications, payments } from "@/db/schema";

const bodySchema = z.object({
  applicationId: z.string().min(1),
});

export async function POST(req: Request) {
  const user = await requireUser();

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { applicationId } = parsed.data;

  const app = await db.query.applications.findFirst({
    where: and(
      eq(applications.id, applicationId),
      eq(applications.userId, user.id),
    ),
  });
  if (!app) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (app.status !== "submitted") {
    return NextResponse.json(
      { error: `Application is in status '${app.status}', not ready for payment.` },
      { status: 409 },
    );
  }

  const origin =
    req.headers.get("origin") ??
    process.env.AUTH_URL ??
    "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: user.email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "StrongTrademarks — attorney review & filing",
            description:
              "Flat fee per mark, per class. USPTO fees billed separately.",
          },
          unit_amount: TRADEMARK_FEE_CENTS,
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/apply/${applicationId}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/apply/${applicationId}/review`,
    metadata: {
      applicationId,
      userId: user.id,
    },
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Stripe did not return a checkout URL" },
      { status: 500 },
    );
  }

  await db.insert(payments).values({
    applicationId,
    stripeSessionId: session.id,
    amountCents: TRADEMARK_FEE_CENTS,
    status: "pending",
  });

  return NextResponse.json({ url: session.url });
}
