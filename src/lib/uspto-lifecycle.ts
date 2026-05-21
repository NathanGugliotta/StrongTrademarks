// USPTO event code → lifecycle behavior registry.
//
// Each known TSDR event code maps to:
//   - milestoneKey: a stable identifier we surface to the customer
//     (filed, approved_for_pub, published, notice_of_allowance,
//     office_action, registered, abandoned, sou_filed)
//   - customerLabel: human-readable summary the customer sees
//   - notify: whether to email + post a thread message on first observation
//   - autoDeadline: if set, the cron also creates a deadline of this kind
//     N days out from the event date
//
// Codes not listed here are still persisted to uspto_status_events for the
// attorney's full event log, but skipped on the customer-facing timeline.
//
// Code reference: https://www.uspto.gov/sites/default/files/documents/TSDR_Field_Descriptions.pdf
// We start with the high-signal codes and expand the registry as we
// observe new ones in production logs.

import type { DeadlineKind } from "./deadlines";

export type MilestoneKey =
  | "filed"
  | "approved_for_pub"
  | "published"
  | "notice_of_allowance"
  | "office_action"
  | "registered"
  | "abandoned"
  | "sou_filed";

type AutoDeadline = {
  kind: DeadlineKind;
  title: string;
  /** Days from the event date to the deadline. */
  offsetDays: number;
};

export type LifecycleEntry = {
  milestoneKey: MilestoneKey;
  customerLabel: string;
  notify: boolean;
  autoDeadline?: AutoDeadline;
};

// Event-code mapping. Codes are case-sensitive matches against TSDR's
// `code` field. Where USPTO uses several near-equivalent codes for the
// same milestone, we list them all.
const REGISTRY: Record<string, LifecycleEntry> = {
  // Application filed / received
  NWAP: { milestoneKey: "filed", customerLabel: "Application filed with USPTO", notify: true },
  NWAR: { milestoneKey: "filed", customerLabel: "Application received by USPTO", notify: true },
  NWON: { milestoneKey: "filed", customerLabel: "Application received by USPTO", notify: true },

  // Approved for publication (passed examination)
  CNSA: {
    milestoneKey: "approved_for_pub",
    customerLabel: "Approved for publication by USPTO examiner",
    notify: true,
  },
  APUB: {
    milestoneKey: "approved_for_pub",
    customerLabel: "Approved for publication by USPTO examiner",
    notify: true,
  },

  // Published for opposition (30-day clock)
  MPUB: {
    milestoneKey: "published",
    customerLabel: "Published for opposition",
    notify: true,
    autoDeadline: {
      kind: "ttab",
      title: "Opposition window closes (30 days from publication)",
      offsetDays: 30,
    },
  },
  PUBO: {
    milestoneKey: "published",
    customerLabel: "Published for opposition",
    notify: true,
    autoDeadline: {
      kind: "ttab",
      title: "Opposition window closes (30 days from publication)",
      offsetDays: 30,
    },
  },

  // Notice of Allowance (1b only — starts 6-month SOU clock)
  NOAM: {
    milestoneKey: "notice_of_allowance",
    customerLabel: "Notice of Allowance issued",
    notify: true,
    autoDeadline: {
      kind: "statement_of_use",
      title: "Statement of Use due (6 months from Notice of Allowance)",
      offsetDays: 182,
    },
  },
  NOAI: {
    milestoneKey: "notice_of_allowance",
    customerLabel: "Notice of Allowance issued",
    notify: true,
    autoDeadline: {
      kind: "statement_of_use",
      title: "Statement of Use due (6 months from Notice of Allowance)",
      offsetDays: 182,
    },
  },

  // Office actions (examiner wants something from us)
  GNRN: {
    milestoneKey: "office_action",
    customerLabel: "Office action issued by USPTO examiner",
    notify: true,
    autoDeadline: {
      kind: "office_action",
      title: "Office action response due (3 months from issuance)",
      offsetDays: 91,
    },
  },
  CNRT: {
    milestoneKey: "office_action",
    customerLabel: "Non-final office action issued",
    notify: true,
    autoDeadline: {
      kind: "office_action",
      title: "Office action response due (3 months from issuance)",
      offsetDays: 91,
    },
  },
  CNFR: {
    milestoneKey: "office_action",
    customerLabel: "Final office action issued",
    notify: true,
    autoDeadline: {
      kind: "office_action",
      title: "Office action response due (3 months from issuance)",
      offsetDays: 91,
    },
  },
  GNFN: {
    milestoneKey: "office_action",
    customerLabel: "Final office action issued",
    notify: true,
    autoDeadline: {
      kind: "office_action",
      title: "Office action response due (3 months from issuance)",
      offsetDays: 91,
    },
  },

  // Statement of Use filed (1b)
  ISOU: {
    milestoneKey: "sou_filed",
    customerLabel: "Statement of Use filed",
    notify: true,
  },

  // Registration
  REGI: { milestoneKey: "registered", customerLabel: "Trademark registered", notify: true },
  RIS: { milestoneKey: "registered", customerLabel: "Trademark registered", notify: true },
  R: { milestoneKey: "registered", customerLabel: "Trademark registered", notify: true },

  // Abandonment
  ABN1: { milestoneKey: "abandoned", customerLabel: "Application abandoned", notify: true },
  ABN2: { milestoneKey: "abandoned", customerLabel: "Application abandoned", notify: true },
  ABN3: { milestoneKey: "abandoned", customerLabel: "Application abandoned", notify: true },
};

export function lookupEvent(code: string): LifecycleEntry | null {
  return REGISTRY[code] ?? null;
}

/** Add N days to a YYYY-MM-DD date and return YYYY-MM-DD. */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
