import type { Metadata } from "next";
import { Phone, Mail, Scale } from "lucide-react";

export const metadata: Metadata = {
  title: "Talk to an attorney",
  description:
    "Switch from self-service filing to a full consultation with Gugliotta & Gugliotta, LPA.",
};

export default function ConsultPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">
        Talk to an attorney
      </h1>
      <p className="mt-3 text-zinc-600 dark:text-zinc-400">
        StrongTrademarks is a streamlined, flat-fee self-service product. If
        your situation is unusual or you&apos;d rather have an attorney walk
        you through it from the start, we&apos;re happy to take you on as a
        traditional client instead.
      </p>

      <div className="mt-10 space-y-4">
        <CalloutBox
          icon={<Scale className="h-5 w-5" />}
          title="When you should probably talk to an attorney instead of self-filing"
        >
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
            <li>
              You&apos;ve already received a cease-and-desist letter about
              your mark, or you&apos;re aware of a similar mark in your space.
            </li>
            <li>
              Your mark is descriptive, geographic, or includes a surname —
              these face uphill registration battles and need careful framing.
            </li>
            <li>
              You operate in multiple countries and need a coordinated
              filing strategy (Madrid Protocol, foreign filings).
            </li>
            <li>
              You&apos;re acquiring an existing mark or splitting one between
              entities.
            </li>
            <li>
              You want a full clearance search (not the basic knock-out
              check included in our flat fee).
            </li>
            <li>
              The mark is core to your business and you want hands-on
              counsel for the entire prosecution, including any office
              actions or oppositions.
            </li>
          </ul>
        </CalloutBox>

        <CalloutBox
          icon={<Mail className="h-5 w-5" />}
          title="Request a consultation"
        >
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Send us a short note describing your mark and your situation.
            We&apos;ll respond within one business day to schedule a call.
          </p>
          <a
            href="mailto:consult@gugliotta.legal?subject=Trademark%20consultation%20request&body=Hi%2C%20I'd%20like%20to%20discuss%20a%20trademark%20matter%20with%20an%20attorney.%0A%0AThe%20mark%3A%20%0AMy%20goods%2Fservices%3A%20%0AMy%20situation%3A%20%0A%0AThanks%2C"
            className="mt-3 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Email the firm
          </a>
        </CalloutBox>

        <CalloutBox
          icon={<Phone className="h-5 w-5" />}
          title="Visit the firm directly"
        >
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Gugliotta &amp; Gugliotta, LPA &mdash; a licensed Ohio law firm
            with a broader trademark, patent, and IP practice.
          </p>
          <a
            href="https://gugliotta.legal"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            gugliotta.legal ↗
          </a>
        </CalloutBox>
      </div>

      <div className="mt-12 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
        <p>
          You can switch to a full consultation at any time, even after you
          start a self-service application — we&apos;ll credit your
          self-service flat fee toward the consultation if the matter is
          large enough that switching makes sense.
        </p>
      </div>

      <div className="mt-8 rounded-md border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
        <p className="font-semibold">Draft notice for site owners</p>
        <p className="mt-1">
          Update consult@gugliotta.legal to a real address the firm
          monitors. Decide whether to also publish a phone number or
          scheduling link here.
        </p>
      </div>
    </div>
  );
}

function CalloutBox({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="flex items-center gap-2">
        <div className="text-zinc-500">{icon}</div>
        <h2 className="font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}
