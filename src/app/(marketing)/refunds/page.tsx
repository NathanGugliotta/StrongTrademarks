import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "How refunds work at StrongTrademarks.",
};

export default function RefundsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-xs text-zinc-500">
        Last updated: {new Date().toLocaleDateString("en-US", { dateStyle: "long" })}
      </p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">
        Refund Policy
      </h1>

      <div className="prose prose-zinc dark:prose-invert mt-8 max-w-none text-sm leading-relaxed">
        <p>
          The Firm&apos;s flat fee for trademark filing services is earned
          upon receipt. The exception, and the circumstances under which a
          refund or credit is available, are described below.
        </p>

        <h2 className="mt-8 text-xl font-semibold">If the attorney determines your mark is unregistrable</h2>
        <p>
          During attorney review, the reviewing attorney may determine that
          your proposed mark cannot be registered as you&apos;ve described
          it — for example, because the mark is generic, merely descriptive
          without sufficient secondary meaning, or otherwise unable to
          function as a trademark.
        </p>
        <p className="mt-2">
          In that case, you have two options, your choice:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Full refund</strong> of our flat fee. We&apos;ll
            initiate the refund through your original payment method
            (typically within 5–10 business days).
          </li>
          <li>
            <strong>Apply the fee toward a new application</strong> for a
            different mark, with the attorney&apos;s guidance on choosing
            a mark more likely to register. Your prepayment carries over;
            you don&apos;t pay our fee again.
          </li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold">Otherwise, fees are earned upon receipt</h2>
        <p>
          Outside of the unregistrable-mark scenario above, our flat fee
          is non-refundable once you have submitted and paid. Specifically:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            If the USPTO refuses your application after filing — for
            example because of a likelihood-of-confusion finding,
            descriptiveness refusal, or other substantive ground — that
            is part of the normal trademark process. We will discuss
            options with you, including a possible office action response
            (quoted separately) or a refined re-application.
          </li>
          <li>
            If you change your mind after the attorney has begun review or
            filed your application, our fee is not refundable.
          </li>
          <li>
            If the USPTO issues an office action, that is part of the
            normal trademark process, not a refund event. Office action
            responses are quoted separately from our flat fee.
          </li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold">USPTO government fees</h2>
        <p>
          USPTO filing fees are paid directly to the U.S. Patent and
          Trademark Office and are non-refundable by the government once
          the application is filed. We have no ability to refund USPTO
          fees on your behalf.
        </p>

        <h2 className="mt-8 text-xl font-semibold">How to request a refund or credit</h2>
        <p>
          Email us through the{" "}
          <a href="/contact" className="underline">Contact page</a>{" "}
          with your application reference (the docket like{" "}
          <span className="font-mono">GU-7186</span>) and a brief note about
          why you&apos;re requesting a refund or credit. We&apos;ll respond
          within two business days.
        </p>

        <div className="mt-12 rounded-md border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="font-semibold">Draft notice for site owners</p>
          <p className="mt-1">
            This matches what you described: refund-or-credit only when the
            mark itself can&apos;t be filed; otherwise earned on receipt.
            Adjust the language as needed before going live.
          </p>
        </div>
      </div>
    </div>
  );
}
