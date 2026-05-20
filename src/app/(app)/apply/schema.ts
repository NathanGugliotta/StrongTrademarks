import { z } from "zod";

// Either an empty string (unfilled input) or a valid ISO date. We need to
// accept empty strings because react-hook-form's default for unfilled <input
// type="date"> is "" rather than undefined, and we only want to enforce
// real dates when the filing basis actually requires them (see superRefine
// in applicationSchema below).
const isoDateOrEmpty = z.union([
  z.literal(""),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker (YYYY-MM-DD)")
    .refine((s) => !isNaN(Date.parse(s)), "Invalid date"),
]);

// Object schema kept separately so .partial() / .pick() still work on it.
// Cross-field rules live on `applicationSchema` (with .superRefine), which
// is the version used for *submission* validation. Autosaves use the
// partial draft schema below since draft fields can legitimately be empty.
const applicationObject = z.object({
  contactEmail: z.string().email(),
  contactName: z.string().min(1).max(200),
  contactPhone: z.string().max(40).optional(),

  markType: z.enum(["word", "design", "combined"]),
  markText: z.string().min(1).max(200).optional(),
  markDescription: z.string().max(2000).optional(),

  ownerName: z.string().min(1).max(200),
  ownerEntityType: z.enum([
    "individual",
    "sole_proprietor",
    "corporation",
    "llc",
    "partnership",
    "other",
  ]),
  ownerAddress: z.object({
    line1: z.string().min(1),
    line2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().min(2),
    postalCode: z.string().min(3),
    country: z.string().min(2),
  }),

  filingBasis: z.enum(["use", "intent_to_use"]),
  firstUseInCommerceDate: isoDateOrEmpty.optional(),
  firstUseAnywhereDate: isoDateOrEmpty.optional(),

  goodsServices: z
    .array(
      z.object({
        class: z.string().min(1),
        description: z.string().min(1).max(1000),
      }),
    )
    .min(1),
});

// Loose schema used by saveApplication — every field is optional, and the
// address object is also accepted partially. Validates types but not
// completeness, so autosaving an in-progress draft never fails.
export const applicationDraftSchema = applicationObject
  .partial()
  .extend({
    ownerAddress: applicationObject.shape.ownerAddress.partial().optional(),
    goodsServices: applicationObject.shape.goodsServices.optional(),
  });

// Strict schema for final submission. Enforces 1(a)-specific cross-field
// rules in addition to the base shape.
export const applicationSchema = applicationObject.superRefine((data, ctx) => {
  if (data.filingBasis === "use") {
    if (!data.firstUseInCommerceDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["firstUseInCommerceDate"],
        message:
          "Required for use-in-commerce filings (the date you first sold or offered the goods/services).",
      });
    }
    if (!data.firstUseAnywhereDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["firstUseAnywhereDate"],
        message:
          "Required for use-in-commerce filings (the date you first used the mark anywhere, even before commercial sale).",
      });
    }
  }
});

export type ApplicationInput = z.infer<typeof applicationSchema>;
export type ApplicationDraftInput = z.infer<typeof applicationDraftSchema>;
