import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "StrongTrademarks terms of service.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-xs text-zinc-500">
        Last updated: {new Date().toLocaleDateString("en-US", { dateStyle: "long" })}
      </p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">
        Terms of Service
      </h1>

      <div className="prose prose-zinc dark:prose-invert mt-8 max-w-none text-sm leading-relaxed">
        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) govern your use of the
          website at strong-trademarks.vercel.app (the &ldquo;Site&rdquo;)
          operated by Gugliotta &amp; Gugliotta, LPA, an Ohio professional
          association (&ldquo;the Firm&rdquo;, &ldquo;we&rdquo;,
          &ldquo;us&rdquo;). By using the Site you agree to these Terms.
        </p>

        <h2 className="mt-8 text-xl font-semibold">1. Not a Law Firm</h2>
        <p>
          The Site itself is not a law firm and does not provide legal
          advice. Legal services described on the Site are performed by
          Gugliotta &amp; Gugliotta, LPA, a licensed Ohio law firm, under a
          separate engagement letter signed by you and the Firm. No
          attorney-client relationship is formed by using the Site, by
          starting an application, or by paying our flat fee. The
          relationship is formed only when you and the Firm execute the
          engagement letter shown at checkout.
        </p>

        <h2 className="mt-8 text-xl font-semibold">2. What We Do</h2>
        <p>
          The Site provides a guided intake form for U.S. federal trademark
          applications (Sections 1(a) and 1(b)). When you submit and pay,
          the Firm reviews your application, prepares the filing, and files
          with the U.S. Patent and Trademark Office. The Firm will respond
          to routine office actions where included in the engagement; other
          work is quoted separately.
        </p>

        <h2 className="mt-8 text-xl font-semibold">3. Your Information</h2>
        <p>
          You are responsible for the accuracy of the information you
          provide, including the mark, owner identity, goods/services
          description, filing basis, and specimens (if any). You declare the
          accuracy of those facts to the U.S. Patent and Trademark Office as
          part of the application declaration captured at checkout, under
          penalty of perjury (18 U.S.C. § 1001).
        </p>

        <h2 className="mt-8 text-xl font-semibold">4. Fees</h2>
        <p>
          Our flat fee covers attorney review of your application,
          preparation of the filing, and filing with the USPTO. USPTO
          government filing fees are separate and paid directly to the USPTO
          at filing time. Additional services (office action responses
          beyond routine, statements of use, foreign filings, etc.) are
          quoted separately.
        </p>

        <h2 className="mt-8 text-xl font-semibold">5. Refunds</h2>
        <p>
          See our <a href="/refunds" className="underline">Refund Policy</a>.
          In short: if attorney review determines your mark is unregistrable
          (e.g. generic), you may elect a refund of our flat fee OR apply
          the same fee to a new application. Otherwise, our flat fee is
          earned upon receipt. USPTO government fees, once paid to the USPTO,
          are non-refundable by us.
        </p>

        <h2 className="mt-8 text-xl font-semibold">6. No Guarantees</h2>
        <p>
          We do not guarantee any particular outcome — including USPTO
          approval of your application, that no third party will oppose your
          mark, or that your registration will be enforceable. Trademark
          outcomes depend on USPTO discretion, third-party rights, the
          marketplace, and many factors outside our control.
        </p>

        <h2 className="mt-8 text-xl font-semibold">7. Acceptable Use</h2>
        <p>
          You agree not to use the Site to submit false information, file
          applications you are not entitled to file, infringe third parties,
          or interfere with the Site&apos;s operation. We may suspend or
          terminate your access for violations.
        </p>

        <h2 className="mt-8 text-xl font-semibold">8. Privacy</h2>
        <p>
          Your use of the Site is also governed by our{" "}
          <a href="/privacy" className="underline">Privacy Policy</a>.
        </p>

        <h2 className="mt-8 text-xl font-semibold">9. Disclaimers; Limitation of Liability</h2>
        <p>
          The Site is provided &ldquo;as is&rdquo; without warranties of any
          kind. To the maximum extent permitted by law, neither the Firm
          nor its principals, attorneys, or agents are liable for any
          indirect, incidental, consequential, or punitive damages arising
          out of your use of the Site. The Firm&apos;s aggregate liability
          for any direct damages is limited to the fees you actually paid
          us in the twelve months preceding the claim.
        </p>

        <h2 className="mt-8 text-xl font-semibold">10. Governing Law</h2>
        <p>
          These Terms are governed by the laws of the State of Ohio, without
          regard to its conflict-of-law principles. Any disputes will be
          resolved in the state or federal courts located in Summit County,
          Ohio.
        </p>

        <h2 className="mt-8 text-xl font-semibold">11. Changes</h2>
        <p>
          We may update these Terms from time to time. Material changes will
          be highlighted on the Site. Your continued use after a change
          constitutes acceptance of the updated Terms.
        </p>

        <h2 className="mt-8 text-xl font-semibold">12. Contact</h2>
        <p>
          Questions? See our{" "}
          <a href="/contact" className="underline">Contact page</a>, or visit
          the Firm&apos;s main site at{" "}
          <a href="https://gugliotta.legal" className="underline">
            gugliotta.legal
          </a>
          .
        </p>

        <div className="mt-12 rounded-md border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="font-semibold">Draft notice for site owners</p>
          <p className="mt-1">
            This is a starting-point Terms of Service. Have it reviewed by
            counsel (or just by you, with your firm hat on) and update with
            your final language before going live with real customer
            payments.
          </p>
        </div>
      </div>
    </div>
  );
}
