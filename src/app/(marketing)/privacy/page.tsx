import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How StrongTrademarks handles your personal information.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-xs text-zinc-500">
        Last updated: {new Date().toLocaleDateString("en-US", { dateStyle: "long" })}
      </p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">
        Privacy Policy
      </h1>

      <div className="prose prose-zinc dark:prose-invert mt-8 max-w-none text-sm leading-relaxed">
        <p>
          This Privacy Policy describes how Gugliotta &amp; Gugliotta, LPA
          (&ldquo;the Firm&rdquo;, &ldquo;we&rdquo;) collects, uses, and
          protects your personal information when you use the
          StrongTrademarks site.
        </p>

        <h2 className="mt-8 text-xl font-semibold">What we collect</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Account info:</strong> name, email, phone (if provided),
            and password hash if you create an account.
          </li>
          <li>
            <strong>Application info:</strong> the trademark you&apos;re
            seeking to register, the owner&apos;s name and address, the
            mark&apos;s goods/services, filing basis, and any specimens
            (images, PDFs) you upload.
          </li>
          <li>
            <strong>Payment info:</strong> processed by Stripe. We do not
            store your full card number — Stripe does, in compliance with
            PCI-DSS. We retain the Stripe payment IDs and the dollar
            amounts charged.
          </li>
          <li>
            <strong>Operational info:</strong> the signed USPTO declaration
            (with your typed signature and timestamp), the signed
            engagement letter, attorney review notes, and the resulting
            USPTO serial number once your mark is filed.
          </li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold">How we use it</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            To prepare and file your USPTO trademark application via the
            Firm&apos;s licensed Ohio attorney.
          </li>
          <li>
            To communicate with you about your filing — status updates,
            office actions, additional information requests.
          </li>
          <li>
            To process your payment and provide receipts.
          </li>
          <li>
            To meet the Firm&apos;s legal and ethical obligations as a law
            firm, including conflict checks and record retention.
          </li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold">Who sees your information</h2>
        <p>
          Your application data is shared with the licensed attorney
          reviewing and filing it (an attorney at Gugliotta &amp; Gugliotta,
          LPA). Application data is also shared with the United States
          Patent and Trademark Office at filing — much of that becomes
          public record once the application is filed (your mark, owner
          name, address, goods/services description, attorney of record).
          You should not include sensitive personal information in
          application fields beyond what&apos;s required.
        </p>

        <h2 className="mt-8 text-xl font-semibold">Third-party services</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Stripe</strong> for payment processing.
          </li>
          <li>
            <strong>Vercel</strong> for hosting and file storage (Vercel
            Blob).
          </li>
          <li>
            <strong>Neon</strong> for database hosting.
          </li>
          <li>
            <strong>Resend</strong> for transactional email (if configured).
          </li>
          <li>
            <strong>Google Workspace</strong> for the Firm&apos;s
            internal docket spreadsheet and document storage.
          </li>
        </ul>
        <p className="mt-2">
          Each of these services has its own privacy practices. We only
          send them data necessary to provide the service.
        </p>

        <h2 className="mt-8 text-xl font-semibold">Cookies</h2>
        <p>
          We use cookies for authentication (keeping you signed in) and to
          track anonymous drafts of in-progress applications. We do not use
          third-party advertising or tracking cookies.
        </p>

        <h2 className="mt-8 text-xl font-semibold">Retention</h2>
        <p>
          We retain client records — application data, signed
          declarations and engagement letters, uploaded files, and
          attorney communications — for the period the Firm is ethically
          required to keep them under Ohio rules of professional conduct,
          typically at least five years after the matter closes. After that
          period, records are securely destroyed unless you request
          otherwise.
        </p>

        <h2 className="mt-8 text-xl font-semibold">Your rights</h2>
        <p>
          You may request a copy of your data, ask us to correct
          inaccurate data, or request deletion of data the Firm is not
          ethically required to retain. Contact us via the{" "}
          <a href="/contact" className="underline">Contact page</a>.
        </p>

        <h2 className="mt-8 text-xl font-semibold">Security</h2>
        <p>
          We use reasonable technical and organizational measures to
          protect your data (encryption in transit via HTTPS, encrypted
          databases at rest, role-based access). No system is perfectly
          secure; we cannot guarantee absolute security.
        </p>

        <h2 className="mt-8 text-xl font-semibold">Children</h2>
        <p>
          The Site is not intended for use by children under 13. We do not
          knowingly collect data from children.
        </p>

        <h2 className="mt-8 text-xl font-semibold">Changes</h2>
        <p>
          We may update this Privacy Policy from time to time. Material
          changes will be posted prominently on the Site.
        </p>

        <h2 className="mt-8 text-xl font-semibold">Contact</h2>
        <p>
          For privacy questions, contact us at the email shown on the{" "}
          <a href="/contact" className="underline">Contact page</a>, or
          visit the Firm at{" "}
          <a href="https://gugliotta.legal" className="underline">
            gugliotta.legal
          </a>
          .
        </p>

        <div className="mt-12 rounded-md border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="font-semibold">Draft notice for site owners</p>
          <p className="mt-1">
            This is a starting-point Privacy Policy that matches what the
            site actually does today. Review carefully and update with your
            final language — particularly state-specific requirements
            (CCPA/CPRA if you have California customers, etc.) — before
            going live.
          </p>
        </div>
      </div>
    </div>
  );
}
