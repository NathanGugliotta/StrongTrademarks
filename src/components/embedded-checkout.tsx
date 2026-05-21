"use client";

import { useCallback, useMemo } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { useRouter } from "next/navigation";

/**
 * Inline Stripe Checkout, mounted in the page (no redirect to Stripe).
 * Driven entirely by the client_secret returned from a Checkout Session
 * created with ui_mode='embedded' and redirect_on_completion='never'.
 *
 * On completion (Stripe shows its own "Payment successful" inside the
 * iframe), we router.refresh() so the surrounding page picks up the
 * webhook-updated payment + status from the DB.
 */
export function EmbeddedCheckoutPanel({
  clientSecret,
}: {
  clientSecret: string;
}) {
  const router = useRouter();
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  const stripePromise = useMemo(
    () => (publishableKey ? loadStripe(publishableKey) : null),
    [publishableKey],
  );

  const fetchClientSecret = useCallback(
    () => Promise.resolve(clientSecret),
    [clientSecret],
  );

  if (!publishableKey) {
    return (
      <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
        Stripe isn&apos;t configured (
        <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> missing).
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-950">
      <EmbeddedCheckoutProvider
        stripe={stripePromise}
        options={{
          fetchClientSecret,
          onComplete: () => router.refresh(),
        }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
