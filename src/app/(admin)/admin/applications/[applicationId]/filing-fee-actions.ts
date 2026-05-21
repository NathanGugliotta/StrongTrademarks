"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { applications, payments } from "@/db/schema";
import { requireAttorney } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { formatCents } from "@/lib/utils";
import { postSystemMessage } from "@/lib/messages";
import { notifyCustomerOfMessage } from "@/lib/notify";

const schema = z.object({
  applicationId: z.string().uuid(),
  amountCents: z
    .number({ message: "Enter an amount" })
    .int("Whole cents only")
    .positive("Amount must be greater than zero")
    .max(10_000_00, "That seems too high — double-check"),
  memo: z.string().max(2000).optional(),
});

export type IssueInvoiceInput = z.input<typeof schema>;

export async function issueFilingFeeInvoice(
  input: IssueInvoiceInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const attorney = await requireAttorney();

  if (!process.env.STRIPE_SECRET_KEY) {
    return {
      ok: false,
      error:
        "Stripe is not configured (STRIPE_SECRET_KEY missing). Add it to env vars and redeploy.",
    };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const { applicationId, amountCents, memo } = parsed.data;

  const app = await db.query.applications.findFirst({
    where: eq(applications.id, applicationId),
  });
  if (!app) return { ok: false, error: "Application not found" };
  if (!app.contactEmail) {
    return { ok: false, error: "Application has no contact email" };
  }

  const origin =
    process.env.AUTH_URL ?? "https://strong-trademarks.vercel.app";

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
              name: `USPTO filing fee — ${app.docketNumber ?? "trademark application"}`,
              description:
                memo ??
                "USPTO government filing fee. Once paid, your attorney will file your application.",
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/apply/${applicationId}/review`,
      cancel_url: `${origin}/apply/${applicationId}/review`,
      metadata: {
        applicationId,
        userId: app.userId ?? "",
        fee_type: "uspto",
        docket: app.docketNumber ?? "",
      },
    });
  } catch (err) {
    console.error("[stripe] issueFilingFeeInvoice failed:", err);
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Stripe rejected the invoice: ${err.message}`
          : "Stripe rejected the invoice",
    };
  }

  if (!session.url) {
    return { ok: false, error: "Stripe did not return a checkout URL" };
  }

  await db.insert(payments).values({
    applicationId,
    feeType: "uspto",
    stripeSessionId: session.id,
    amountCents,
    status: "pending",
  });

  const messageBody = [
    `Your USPTO filing fee invoice is ready.`,
    ``,
    `Amount: ${formatCents(amountCents)}`,
    memo ? `\n${memo}\n` : "",
    `[Pay here](${session.url})`,
    ``,
    `Once paid, your attorney will proceed with filing your application.`,
  ]
    .filter((line) => line !== "")
    .join("\n");
  await postSystemMessage(applicationId, messageBody, attorney.id);
  notifyCustomerOfMessage({
    applicationId,
    authorName: "Your attorney",
    body: messageBody,
  }).catch((err) =>
    console.error(
      "[notify] notifyCustomerOfMessage (filing-fee invoice) failed:",
      err,
    ),
  );

  revalidatePath(`/admin/applications/${applicationId}`);
  revalidatePath(`/apply/${applicationId}/review`);
  return { ok: true };
}
