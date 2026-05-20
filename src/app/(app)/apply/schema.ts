import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker (YYYY-MM-DD)")
  .refine((s) => !isNaN(Date.parse(s)), "Invalid date");

export const applicationSchema = z
  .object({
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
    // Only required when filingBasis === "use". Cross-field validation below.
    firstUseInCommerceDate: isoDate.optional(),
    firstUseAnywhereDate: isoDate.optional(),

    goodsServices: z
      .array(
        z.object({
          class: z.string().min(1),
          description: z.string().min(1).max(1000),
        }),
      )
      .min(1),
  })
  .superRefine((data, ctx) => {
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
