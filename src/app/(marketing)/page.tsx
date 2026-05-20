import Link from "next/link";
import { CheckCircle2, FileText, Scale, ShieldCheck } from "lucide-react";

export default function LandingPage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-500">
            Trademark filings, done right
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
            File your trademark with an attorney on your side — without the
            attorney price tag.
          </h1>
          <p className="mt-6 text-lg text-zinc-600 dark:text-zinc-400">
            You fill out the application. A licensed trademark attorney reviews
            every filing before it goes to the USPTO. No surprises, no rookie
            mistakes that cost you the mark.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/apply"
              className="rounded-md bg-zinc-900 px-6 py-3 text-base font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Start your application
            </Link>
            <Link
              href="/how-it-works"
              className="rounded-md border border-zinc-300 px-6 py-3 text-base font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              See how it works
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 sm:grid-cols-3">
          <Feature
            icon={<FileText className="h-6 w-6" />}
            title="Guided intake"
            body="Step-by-step questions translate plain English into the USPTO's TEAS-ready format."
          />
          <Feature
            icon={<Scale className="h-6 w-6" />}
            title="Attorney review"
            body="A licensed trademark attorney reviews your filing for classification errors, specimen issues, and likelihood-of-confusion risks."
          />
          <Feature
            icon={<ShieldCheck className="h-6 w-6" />}
            title="Filed for you"
            body="We file directly with the USPTO and send you the serial number. You stay in the loop on office actions."
          />
        </div>
      </section>

      <section className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <h2 className="text-3xl font-semibold tracking-tight">
            Why not just file pro se?
          </h2>
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">
            You can. But the USPTO doesn&apos;t refund filing fees, and the most
            common pro se mistakes — wrong filing basis, sloppy identification
            of goods/services, defective specimens — can either kill your
            application or weaken the mark you eventually get.
          </p>
          <ul className="mt-6 space-y-3 text-zinc-700 dark:text-zinc-300">
            {[
              "Pick the right filing basis (use vs. intent-to-use) the first time.",
              "Get goods and services descriptions that match the USPTO ID Manual.",
              "Submit a specimen that actually shows use in commerce.",
              "Avoid descriptive or generic claims that get refused.",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2">
                <CheckCircle2 className="mt-1 h-4 w-4 flex-none text-emerald-600" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div>
      <div className="mb-3 text-zinc-900 dark:text-zinc-100">{icon}</div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{body}</p>
    </div>
  );
}
