import type { Metadata } from "next";
import { Mail, Globe, MapPin } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with StrongTrademarks and Gugliotta & Gugliotta, LPA.",
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Contact us</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Questions about your trademark application, payment, or anything
        else? Reach us here.
      </p>

      <div className="mt-10 space-y-6 text-sm">
        <ContactRow
          icon={<Mail className="h-5 w-5" />}
          label="Email"
          value={
            <a
              href="mailto:support@strongtrademarks.com"
              className="underline"
            >
              support@strongtrademarks.com
            </a>
          }
          hint="We respond within 1 business day. For application-specific questions, please include your docket number (e.g. GU-7186)."
        />

        <ContactRow
          icon={<Globe className="h-5 w-5" />}
          label="Law firm website"
          value={
            <a
              href="https://gugliotta.legal"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              gugliotta.legal
            </a>
          }
          hint="StrongTrademarks is operated by Gugliotta & Gugliotta, LPA — a licensed Ohio law firm."
        />

        <ContactRow
          icon={<MapPin className="h-5 w-5" />}
          label="Law firm address"
          value={<span>Gugliotta &amp; Gugliotta, LPA — Ohio</span>}
          hint="Full mailing address can be added here once you decide whether to publish it on the customer-facing site."
        />
      </div>

      <div className="mt-12 rounded-md border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
        <p className="font-semibold">Draft notice for site owners</p>
        <p className="mt-1">
          Update support@strongtrademarks.com to a real address you
          monitor, and decide whether to publish the full mailing address
          here.
        </p>
      </div>
    </div>
  );
}

function ContactRow({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="mt-0.5 text-zinc-500">{icon}</div>
      <div>
        <div className="text-xs uppercase tracking-wide text-zinc-500">
          {label}
        </div>
        <div className="mt-0.5 font-medium">{value}</div>
        {hint && (
          <p className="mt-1 text-xs text-zinc-500">{hint}</p>
        )}
      </div>
    </div>
  );
}
