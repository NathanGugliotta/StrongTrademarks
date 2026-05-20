import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRADEMARK_FEE_CENTS } from "@/lib/stripe";
import { db } from "@/db";
import { applications, payments } from "@/db/schema";
import { canViewApplication } from "@/app/(app)/apply/actions";

const DECLARATION_VERSION = "v1-2026-05";

const bodySchema = z.object({
  applicationId: z.string().min(1),
  signature: z.string().trim().min(2).max(200),
});

export async function POST(req: Request) {
  // Fail fast with a clear message when Stripe isn't configured, instead of
  // letting the lazy Proxy throw an opaque "STRIPE_SECRET_KEY is not set"
  // somewhere deep in module evaluation.
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      {
        error:
          "Payments are not configured yet (STRIPE_SECRET_KEY missing). Add it to your environment variables and redeploy.",
      },
      { status: 503 },
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }
  const { applicationId, signature } = parsed.data;

  if (!(await canViewApplication(applicationId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const app = await db.query.applications.findFirst({
    where: eq(applications.id, applicationId),
  });
  if (!app) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (app.status !== "submitted") {
    return NextResponse.json(
      {
        error: `Application is in status '${app.status}', not ready for payment.`,
      },
      { status: 409 },
    );
  }
  if (!app.contactEmail) {
    return NextResponse.json(
      { error: "Contact email missing on application" },
      { status: 400 },
    );
  }

  const classCount = app.goodsServices?.length ?? 0;
  if (classCount < 1) {
    return NextResponse.json(
      { error: "Application must have at least one class of goods/services" },
      { status: 400 },
    );
  }

  // Per-class pricing. Our flat fee is per class, matching the marketing
  // page and how trademark filings actually scale.
  const totalCents = TRADEMARK_FEE_CENTS * classCount;

  const origin =
    req.headers.get("origin") ??
    process.env.AUTH_URL ??
    "http://localhost:3000";

  // Record the declaration before opening Stripe. If Stripe fails after this,
  // the signature is still on file — we can resubmit checkout against the same
  // application.
  await db
    .update(applications)
    .set({
      declarationSignature: signature,
      declarationSignedAt: new Date(),
      declarationVersion: DECLARATION_VERSION,
      updatedAt: new Date(),
    })
    .where(eq(applications.id, applicationId));

  // Lazy-load Stripe to keep STRIPE_SECRET_KEY off the build path.
  const { stripe } = await import("@/lib/stripe");

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: app.contactEmail,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "StrongTrademarks — attorney review & filing",
              description: `${classCount} class${classCount === 1 ? "" : "es"}. USPTO filing fees billed separately at filing.`,
            },
            unit_amount: TRADEMARK_FEE_CENTS,
          },
          quantity: classCount,
        },
      ],
      success_url: `${origin}/apply/${applicationId}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/apply/${applicationId}/review`,
      metadata: {
        applicationId,
        userId: app.userId ?? "",
      },
    });
  } catch (err) {
    console.error("[stripe] checkout.sessions.create failed:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Stripe rejected the request: ${err.message}`
            : "Stripe rejected the request",
      },
      { status: 502 },
    );
  }

  if (!session.url) {
    return NextResponse.json(
      { error: "Stripe did not return a checkout URL" },
      { status: 500 },
    );
  }

  await db.insert(payments).values({
    applicationId,
    stripeSessionId: session.id,
    amountCents: totalCents,
    status: "pending",
  });

  return NextResponse.json({ url: session.url });
}
