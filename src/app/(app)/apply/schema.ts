import { z } from "zod";

export const applicationSchema = z.object({
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
  goodsServices: z
    .array(
      z.object({
        class: z.string().min(1),
        description: z.string().min(1).max(1000),
      }),
    )
    .min(1),
});

export type ApplicationInput = z.infer<typeof applicationSchema>;
