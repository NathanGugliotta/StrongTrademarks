import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { formatCents } from "@/lib/utils";

const FEE_CENTS = Number(process.env.TRADEMARK_FEE_CENTS ?? 49900);

const included = [
  "Guided intake form",
  "Attorney review of filing basis and classification",
  "Goods/services language aligned with the USPTO ID Manual",
  "Specimen review and feedback",
  "Filing via TEAS",
  "Serial number + filed application copy",
  "Forwarding of USPTO correspondence",
];

const notIncluded = [
  "USPTO government filing fees (billed separately, shown before payment)",
  "Office action responses (quoted separately if needed)",
  "Trademark searches beyond a basic knock-out review",
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-4xl font-semibold tracking-tight">Pricing</h1>
      <p className="mt-4 text-zinc-600 dark:text-zinc-400">
        One flat fee for attorney review and filing. No hourly billing, no
        surprises.
      </p>

      <div className="mt-12 rounded-lg border border-zinc-200 p-8 dark:border-zinc-800">
        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-semibold tracking-tight">
            {formatCents(FEE_CENTS)}
          </span>
          <span className="text-zinc-500">per mark, per class</span>
        </div>
        <p className="mt-2 text-sm text-zinc-500">
          USPTO government filing fee is billed separately and shown before you
          pay.
        </p>

        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <div>
            <h2 className="font-semibold">What&apos;s included</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {included.map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-emerald-600" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-semibold">Not included</h2>
            <ul className="mt-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              {notIncluded.map((line) => (
                <li key={line}>— {line}</li>
              ))}
            </ul>
          </div>
        </div>

        <Link
          href="/apply"
          className="mt-10 inline-block rounded-md bg-zinc-900 px-6 py-3 text-base font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Start your application
        </Link>
      </div>
    </div>
  );
}
