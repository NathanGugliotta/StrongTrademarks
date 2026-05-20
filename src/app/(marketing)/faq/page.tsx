const faqs = [
  {
    q: "Is StrongTrademarks a law firm?",
    a: "No. StrongTrademarks is a service that connects you with licensed independent trademark attorneys who review and file your application. The attorney is the one providing legal services, and an attorney-client relationship is formed when you sign their engagement letter.",
  },
  {
    q: "Why not just file myself on the USPTO website?",
    a: "You can, and many people do. The risk is that filing fees are non-refundable, and the most common pro se mistakes — wrong filing basis, vague goods/services descriptions, defective specimens — either get your application refused or weaken the mark you eventually receive. An attorney catches those before you pay the USPTO.",
  },
  {
    q: "What does the flat fee cover?",
    a: "Attorney review of your filing basis, goods/services classification, mark description, and specimen, plus filing the application via TEAS and forwarding USPTO correspondence to you. It does not cover the USPTO's own filing fee (paid directly to the government) or follow-on work like responding to office actions.",
  },
  {
    q: "How long does the process take?",
    a: "Filing typically happens within a few business days of your payment, depending on attorney review queue. Once filed, the USPTO's own timeline is several months to publication and longer to registration.",
  },
  {
    q: "What if the USPTO refuses my application?",
    a: "If a refusal is issued (an \"office action\"), we'll send you a copy and a quote to respond. Some refusals are routine; others may require restructuring the application. Either way, you're not on the hook unless you decide to proceed.",
  },
  {
    q: "Do you do trademark searches?",
    a: "Our flat fee includes a basic knock-out search to catch obvious conflicts. A full clearance search is a separate paid add-on.",
  },
];

export default function FAQPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-4xl font-semibold tracking-tight">FAQ</h1>
      <dl className="mt-12 space-y-8">
        {faqs.map((item) => (
          <div key={item.q}>
            <dt className="text-lg font-semibold">{item.q}</dt>
            <dd className="mt-2 text-zinc-600 dark:text-zinc-400">{item.a}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
