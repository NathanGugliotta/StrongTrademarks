import Link from "next/link";

const steps = [
  {
    n: "01",
    title: "Tell us about your mark",
    body: "Walk through a guided form: what the mark is, who owns it, what goods or services it covers, and whether you're already using it in commerce.",
  },
  {
    n: "02",
    title: "Pay the flat fee",
    body: "One transparent price covers attorney review and filing. USPTO government fees are billed separately and shown before you pay.",
  },
  {
    n: "03",
    title: "Attorney review",
    body: "A licensed trademark attorney reviews your application end-to-end — filing basis, classification, identification of goods and services, and specimen sufficiency. They reach out if anything needs to change.",
  },
  {
    n: "04",
    title: "We file with the USPTO",
    body: "Once you sign off, the attorney files your application via TEAS. You receive your serial number and a copy of the submitted application.",
  },
  {
    n: "05",
    title: "Ongoing updates",
    body: "We forward USPTO correspondence (office actions, publication notices) and can quote follow-on work if a response is needed.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-4xl font-semibold tracking-tight">How it works</h1>
      <p className="mt-4 text-zinc-600 dark:text-zinc-400">
        From a blank form to a filed application in five steps.
      </p>
      <ol className="mt-12 space-y-10">
        {steps.map((step) => (
          <li key={step.n} className="flex gap-6">
            <div className="font-mono text-sm text-zinc-400">{step.n}</div>
            <div>
              <h2 className="text-lg font-semibold">{step.title}</h2>
              <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-16">
        <Link
          href="/apply"
          className="rounded-md bg-zinc-900 px-6 py-3 text-base font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Start your application
        </Link>
      </div>
    </div>
  );
}
