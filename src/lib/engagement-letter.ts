// Renders the Fixed Fee Legal Services Agreement (engagement letter)
// between the customer and Gugliotta & Gugliotta, LPA, with the customer's
// specific application data filled in. Called both for display on the
// review/checkout page and for the snapshot saved to the database at the
// point of signature.
//
// Versioned via ENGAGEMENT_LETTER_VERSION so future revisions are
// auditable — we know which version each customer signed.

import { formatCents } from "./utils";

export const ENGAGEMENT_LETTER_VERSION = "v1-2026-05";

export type EngagementLetterData = {
  agreementNumber: string; // shown as "Professional Services Agreement number ..."
  agreementDate: string; // "5/13/2026"
  clientName: string;
  clientAddress: string; // single-line formatted address
  markText: string;
  goodsServicesSummary: string; // e.g. "Class 25 (clothing); Class 35 (retail apparel services)"
  feeCents: number;
};

/**
 * Plain-text version of the engagement letter. Used on the review page for
 * display (rendered with whitespace preserved) and stored as the snapshot
 * the customer signed.
 */
export function renderEngagementLetter(data: EngagementLetterData): string {
  const fee = formatCents(data.feeCents);
  return `FIXED FEE LEGAL SERVICES AGREEMENT

This Professional Services Agreement number ${data.agreementNumber} is entered into on ${data.agreementDate} between ${data.clientName} of ${data.clientAddress} ("You") and Gugliotta & Gugliotta, LPA ("Law Firm").

1. Services Provided. Law Firm will provide the following limited legal services to You ("Services"):

The Law Firm shall prepare and file one application with the United States Patent and Trademark Office to register Client's trademark consisting of the wordmark "${data.markText}" for use in connection with ${data.goodsServicesSummary}. The Law Firm will keep Client informed throughout the full application process.

Office Action responses are not included in the Services and will be separately quoted to the Client if and when needed.

2. Fixed Fee. You must pay Law Firm a fixed flat fee of ${fee} for the Services ("Fixed Fee"). The Fixed Fee is per class of goods and services in the application. The Fixed Fee is earned upon receipt, except in the limited circumstances described in our Refund Policy at /refunds.

3. Additional Costs. You must reimburse Law Firm for out-of-pocket costs incurred, including USPTO filing fees, copying, travel, etc. Law Firm is not obligated to advance costs. USPTO filing fees are paid by you directly to the USPTO at the time of filing.

4. Payment. You must pay the Fixed Fee upfront before Services commence. Payment is made at checkout via Stripe.

5. Term and Termination. This Agreement begins on the execution date and ends when Services are completed. Either party may terminate by reasonable notice, subject to payment of fees and costs owed.

6. No Guarantees. Law Firm makes no guarantees about the outcome — including USPTO approval of your application or the enforceability of any resulting registration. You must cooperate fully with the Law Firm in providing accurate information and timely responses.

7. Client Records. Law Firm will maintain client records digitally. You consent to use of cloud storage and digital service providers (including but not limited to Vercel, Neon, Stripe, and Google Workspace) for storage and processing of the records associated with this matter. Records will be returned upon written request and destroyed securely after the retention period required by Ohio rules of professional conduct, unless requested otherwise.

8. Entire Agreement. This Agreement constitutes the entire agreement between the parties with respect to the trademark application filing services and supersedes prior statements. Any modifications must be in writing and signed.

By signing below electronically, you accept and agree to the terms of this Agreement.`;
}

/** Same content as renderEngagementLetter but escaped for safe HTML embedding. */
export function renderEngagementLetterHtml(data: EngagementLetterData): string {
  const text = renderEngagementLetter(data);
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<pre style="white-space:pre-wrap;font-family:inherit;font-size:inherit;margin:0;">${escaped}</pre>`;
}
