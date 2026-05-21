"use client";

import { useState } from "react";
import {
  useForm,
  useFieldArray,
  useWatch,
  type FieldErrors,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { saveApplication, submitApplicationForReview } from "../actions";
import { applicationSchema, type ApplicationInput } from "../schema";
import { SpecimenUploader } from "./specimen-uploader";
import { USPTO_CLASSES, getUsptoClass } from "@/lib/uspto-classes";
import { HelpToggle } from "@/components/help-toggle";

type ExistingFile = {
  id: string;
  kind: "specimen" | "drawing" | "other";
  url: string;
  mimeType: string;
  sizeBytes: number;
};

// Human-friendly labels for field paths shown in the validation error banner.
const FIELD_LABELS: Record<string, string> = {
  contactEmail: "Your email",
  contactName: "Your name",
  contactPhone: "Your phone",
  markType: "Mark type",
  markText: "Mark text",
  markDescription: "Mark description",
  ownerName: "Owner name",
  ownerEntityType: "Owner entity type",
  "ownerAddress.line1": "Owner address — line 1",
  "ownerAddress.city": "Owner address — city",
  "ownerAddress.state": "Owner address — state",
  "ownerAddress.postalCode": "Owner address — postal code",
  "ownerAddress.country": "Owner address — country",
  filingBasis: "Filing basis",
  firstUseInCommerceDate: "First use in commerce",
  firstUseAnywhereDate: "First use anywhere",
  goodsServices: "Goods & services",
};

function flattenErrors(
  errors: FieldErrors,
  prefix = "",
): Array<{ path: string; message: string }> {
  const out: Array<{ path: string; message: string }> = [];
  for (const [key, val] of Object.entries(errors)) {
    if (!val) continue;
    if (
      typeof val === "object" &&
      "message" in val &&
      typeof (val as { message?: unknown }).message === "string"
    ) {
      out.push({
        path: `${prefix}${key}`,
        message: String((val as { message: string }).message),
      });
    } else if (typeof val === "object") {
      out.push(...flattenErrors(val as FieldErrors, `${prefix}${key}.`));
    }
  }
  return out;
}

const sections = [
  { id: "contact", label: "Your info" },
  { id: "mark", label: "Mark" },
  { id: "owner", label: "Owner" },
  { id: "basis", label: "Filing basis" },
  { id: "goods", label: "Goods & services" },
];

export function ApplicationForm({
  applicationId,
  defaultValues,
  initialFiles,
  isResubmission = false,
}: {
  applicationId: string;
  defaultValues?: Partial<ApplicationInput>;
  initialFiles: ExistingFile[];
  isResubmission?: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const form = useForm<ApplicationInput>({
    resolver: zodResolver(applicationSchema),
    // Re-validate on every change so the error banner clears as soon as the
    // user fixes the underlying field (e.g. switching filing basis from
    // "use" to "intent_to_use" immediately drops the first-use-date errors).
    mode: "onChange",
    defaultValues: {
      contactEmail: defaultValues?.contactEmail ?? "",
      contactName: defaultValues?.contactName ?? "",
      contactPhone: defaultValues?.contactPhone ?? "",
      markType: defaultValues?.markType ?? "word",
      markText: defaultValues?.markText ?? "",
      markDescription: defaultValues?.markDescription ?? "",
      ownerName: defaultValues?.ownerName ?? "",
      ownerEntityType: defaultValues?.ownerEntityType ?? "individual",
      ownerAddress: defaultValues?.ownerAddress ?? {
        line1: "",
        city: "",
        state: "",
        postalCode: "",
        country: "US",
      },
      filingBasis: defaultValues?.filingBasis ?? "use",
      firstUseInCommerceDate: defaultValues?.firstUseInCommerceDate ?? "",
      firstUseAnywhereDate: defaultValues?.firstUseAnywhereDate ?? "",
      goodsServices:
        defaultValues?.goodsServices && defaultValues.goodsServices.length > 0
          ? defaultValues.goodsServices
          : [{ class: "", description: "" }],
    },
  });

  const goods = useFieldArray({
    control: form.control,
    name: "goodsServices",
  });

  const filingBasis = useWatch({ control: form.control, name: "filingBasis" });
  const markType = useWatch({ control: form.control, name: "markType" });

  const needsDrawing = markType === "design" || markType === "combined";
  const needsSpecimen = filingBasis === "use";
  const drawings = initialFiles.filter((f) => f.kind === "drawing");
  const specimens = initialFiles.filter((f) => f.kind === "specimen");

  const validationErrors = submitAttempted
    ? flattenErrors(form.formState.errors)
    : [];

  function onValidationFailed(errors: FieldErrors) {
    setSubmitAttempted(true);
    // Scroll to the error banner at the bottom so the user can see what went
    // wrong without hunting through the form.
    setTimeout(() => {
      const banner = document.querySelector("[data-validation-banner]");
      banner?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
    console.warn("[apply] form validation failed", errors);
  }

  async function onSave() {
    setSaving(true);
    try {
      const values = form.getValues();
      await saveApplication(applicationId, values);
    } catch (err) {
      console.error("[apply] saveApplication threw:", err);
    } finally {
      setSaving(false);
    }
  }

  async function onSubmit(values: ApplicationInput) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const saved = await saveApplication(applicationId, values);
      if (!saved.ok) {
        setSubmitError(saved.error);
        return;
      }
      const result = await submitApplicationForReview(applicationId);
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      if (result.paymentRequired) {
        router.push(`/apply/${applicationId}/review`);
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      console.error("[apply] submission threw:", err);
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit, onValidationFailed)}
      className="space-y-12"
    >
      <nav className="flex gap-4 border-b border-zinc-200 pb-3 text-sm dark:border-zinc-800">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="text-zinc-600 hover:underline dark:text-zinc-400"
          >
            {s.label}
          </a>
        ))}
      </nav>

      <section id="contact" className="space-y-4">
        <h2 className="text-xl font-semibold">Your contact info</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          So we can email you updates and tie this application to your
          account. (This is <span className="font-medium">you</span> — the
          trademark owner can be a different person or entity in the next
          section.)
        </p>
        <Field label="Email">
          <input
            type="email"
            {...form.register("contactEmail")}
            placeholder="you@example.com"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </Field>
        <Field label="Full name">
          <input
            type="text"
            {...form.register("contactName")}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </Field>
        <Field label="Phone" hint="Optional. Used only if the attorney needs to reach you about your filing.">
          <input
            type="tel"
            {...form.register("contactPhone")}
            placeholder="(555) 123-4567"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </Field>
      </section>

      <section id="mark" className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">What&apos;s the mark?</h2>
          <HelpToggle
            title="What counts as a trademark"
            linkHref="https://www.uspto.gov/trademarks/basics/what-trademark"
            linkLabel="USPTO: What is a trademark?"
          >
            <p>
              A trademark is anything that identifies the source of your
              goods or services — a brand name, logo, slogan, or
              combination. You can register a word-only mark (just the
              letters), a design mark (a logo), or both together.
            </p>
            <p>
              Tip: a word-only registration is broader because it covers
              the wording regardless of how it&apos;s styled. A design
              registration only covers that specific design.
            </p>
          </HelpToggle>
        </div>

        <Field
          label="What kind of mark are you registering?"
          hint="If you're not sure, pick word-only — you can always file a separate design mark later."
        >
          <select
            {...form.register("markType")}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="word">Just the words (no logo)</option>
            <option value="design">Just the logo / design (no text)</option>
            <option value="combined">The words and the logo together</option>
          </select>
        </Field>

        <Field
          label="The mark itself (exact text)"
          hint="Type it exactly as you want it registered. Capitalization and punctuation matter."
        >
          <input
            type="text"
            {...form.register("markText")}
            placeholder="e.g. Strong Trademarks"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </Field>
        <Field
          label="Mark description"
          hint="If your mark includes design elements, describe them in words here (the USPTO requires this for logos). Skip for a word-only mark."
        >
          <textarea
            {...form.register("markDescription")}
            rows={3}
            placeholder="e.g. The mark consists of a blue circle containing a stylized lowercase letter 's'."
            className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </Field>
      </section>

      <section id="owner" className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Who will own the trademark?</h2>
          <HelpToggle
            title="Why owner matters"
            linkHref="https://www.uspto.gov/trademarks/basics/application-requirements"
            linkLabel="USPTO: Application requirements"
          >
            <p>
              The trademark owner is the legal person or company that holds
              the rights to the mark. Owning the mark wrong is one of the
              most common application killers — the USPTO will refuse a
              registration if the owner doesn&apos;t actually use the mark
              in commerce.
            </p>
            <p>
              If your business is an LLC, corporation, or partnership, the{" "}
              <strong>business is usually the owner</strong>, not you
              personally — because the business is what sells the products
              or provides the services. If you&apos;re a sole proprietor
              with no separate entity, you own it personally.
            </p>
            <p>
              Your contact info (above) is separate — that&apos;s you, the
              human filling out the form.
            </p>
          </HelpToggle>
        </div>

        <Field
          label="Owner name"
          hint="Your business name if it's an LLC / corp / partnership, or your personal name if you're a sole proprietor."
        >
          <input
            type="text"
            {...form.register("ownerName")}
            placeholder="e.g. Acme Apparel LLC, or Jane Q. Applicant"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </Field>
        <Field label="What kind of owner?">
          <select
            {...form.register("ownerEntityType")}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="individual">Individual</option>
            <option value="sole_proprietor">Sole proprietor</option>
            <option value="llc">LLC</option>
            <option value="corporation">Corporation</option>
            <option value="partnership">Partnership</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Address line 1">
          <input
            type="text"
            {...form.register("ownerAddress.line1")}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="City">
            <input
              type="text"
              {...form.register("ownerAddress.city")}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </Field>
          <Field label="State">
            <input
              type="text"
              {...form.register("ownerAddress.state")}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </Field>
          <Field label="Postal code">
            <input
              type="text"
              {...form.register("ownerAddress.postalCode")}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </Field>
          <Field label="Country">
            <input
              type="text"
              {...form.register("ownerAddress.country")}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </Field>
        </div>
      </section>

      <section id="basis" className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Are you using this mark yet?</h2>
          <HelpToggle
            title="Filing basis (Section 1(a) vs. Section 1(b))"
            linkHref="https://www.uspto.gov/trademarks/basics/application-filing-basis"
            linkLabel="USPTO: Filing basis"
          >
            <p>
              The USPTO needs to know whether your mark is already being used
              commercially or you&apos;re reserving it for future use. These
              are formally called <strong>Section 1(a)</strong> (use in
              commerce) and <strong>Section 1(b)</strong> (intent to use).
            </p>
            <p>
              The difference matters: a use-based filing can go all the way to
              registration on its own, while an intent-to-use filing requires
              a follow-up Statement of Use (with an additional USPTO fee)
              before the mark is registered.
            </p>
          </HelpToggle>
        </div>

        <label className="flex items-start gap-2">
          <input
            type="radio"
            value="use"
            {...form.register("filingBasis")}
            className="mt-1"
          />
          <span>
            <span className="font-medium">
              Yes — I&apos;m already selling under this mark
            </span>
            <span className="block text-sm text-zinc-500">
              You&apos;re using the mark on your product or service in real
              commerce today (e.g. you&apos;ve made sales across state lines).
              You&apos;ll provide the first-use dates and upload a specimen
              showing the mark in use.
              <span className="ml-1 text-zinc-400">
                (USPTO Section 1(a))
              </span>
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input
            type="radio"
            value="intent_to_use"
            {...form.register("filingBasis")}
            className="mt-1"
          />
          <span>
            <span className="font-medium">
              Not yet — I&apos;m planning to use it soon
            </span>
            <span className="block text-sm text-zinc-500">
              You&apos;re reserving the mark for a real plan you intend to
              act on. You don&apos;t need a specimen now, but you&apos;ll
              need one later (along with an additional USPTO fee) before the
              mark can register.
              <span className="ml-1 text-zinc-400">
                (USPTO Section 1(b))
              </span>
            </span>
          </span>
        </label>

        {filingBasis === "use" && (
          <div className="mt-4 space-y-4 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">
                When did you start using the mark?
              </p>
              <HelpToggle
                title="First-use dates"
                linkHref="https://www.uspto.gov/trademarks/basics/application-filing-basis"
                linkLabel="USPTO: Filing basis & use in commerce"
              >
                <p>
                  <strong>First use in commerce</strong> is the date you
                  first sold, shipped, or offered your goods/services using
                  this mark across state lines (or in U.S. commerce
                  generally). This is the date the USPTO cares about.
                </p>
                <p>
                  <strong>First use anywhere</strong> is the date you first
                  used the mark publicly in any way — e.g. demoing it at a
                  local event, using it on a website before launch, etc. It
                  can be earlier than first use in commerce, or the same.
                </p>
                <p>
                  If you only know the month or year, pick the first of that
                  month — your attorney will refine if needed.
                </p>
              </HelpToggle>
            </div>
            <Field label="First use in commerce">
              <input
                type="date"
                {...form.register("firstUseInCommerceDate")}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </Field>
            <Field label="First use anywhere">
              <input
                type="date"
                {...form.register("firstUseAnywhereDate")}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </Field>
          </div>
        )}
      </section>

      <section id="goods" className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">
            What does the mark cover?
          </h2>
          <HelpToggle
            title="Classes of goods and services"
            linkHref="https://www.uspto.gov/trademarks/basics/goods-and-services"
            linkLabel="USPTO: Goods and services"
          >
            <p>
              The USPTO groups everything into 45 international classes
              (1–34 are physical goods, 35–45 are services). You file the
              mark in each class that describes what you sell.
            </p>
            <p>
              You pay USPTO + our fees <em>per class</em>, so be honest
              about scope: don&apos;t file in a class you don&apos;t
              actually sell in (the USPTO refuses non-use), but also
              don&apos;t skip a class you genuinely operate in.
            </p>
            <p>
              The attorney will refine your classification during review,
              including moving items to a different class if you picked one
              that doesn&apos;t quite fit.
            </p>
          </HelpToggle>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Pick the closest class for each thing you sell. Describe in plain
          English what you actually do under this mark — your attorney will
          polish the wording.
        </p>
        {goods.fields.map((field, i) => (
          <div
            key={field.id}
            className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <Field
              label="Class"
              hint="The international class for the goods or services this mark will cover."
            >
              <select
                {...form.register(`goodsServices.${i}.class`)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="">Select a class…</option>
                <optgroup label="Goods (classes 1–34)">
                  {USPTO_CLASSES.filter((c) => c.category === "goods").map(
                    (c) => (
                      <option key={c.number} value={c.number}>
                        Class {c.number} — {c.shortTitle}
                      </option>
                    ),
                  )}
                </optgroup>
                <optgroup label="Services (classes 35–45)">
                  {USPTO_CLASSES.filter(
                    (c) => c.category === "services",
                  ).map((c) => (
                    <option key={c.number} value={c.number}>
                      Class {c.number} — {c.shortTitle}
                    </option>
                  ))}
                </optgroup>
              </select>
              <ClassExamplesHint
                control={form.control}
                index={i}
              />
            </Field>
            <Field
              label="Description"
              hint="Describe in plain English what goods or services this mark will be used on. Don't worry about USPTO ID Manual phrasing — your attorney will polish it."
            >
              <textarea
                {...form.register(`goodsServices.${i}.description`)}
                rows={2}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </Field>
            {goods.fields.length > 1 && (
              <button
                type="button"
                onClick={() => goods.remove(i)}
                className="mt-2 text-sm text-red-600 hover:underline"
              >
                Remove
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => goods.append({ class: "", description: "" })}
          className="text-sm font-medium underline"
        >
          + Add another class
        </button>
      </section>

      {(needsDrawing || needsSpecimen) && (
        <section id="files" className="space-y-6">
          <h2 className="text-xl font-semibold">Specimens &amp; drawings</h2>

          {needsDrawing && (
            <div className="space-y-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">
                    Upload your logo{" "}
                    <span className="text-xs font-normal text-zinc-500">
                      (required)
                    </span>
                  </h3>
                  <HelpToggle
                    title="What the USPTO calls a &ldquo;drawing&rdquo;"
                    linkHref="https://www.uspto.gov/trademarks/basics/drawings-and-specimens"
                    linkLabel="USPTO: Drawings and specimens"
                  >
                    <p>
                      The USPTO calls this a <strong>drawing</strong>. It&apos;s
                      a clean image of the mark exactly as you want it
                      registered — no extra decoration, no shadows, no
                      background scenery, no other text.
                    </p>
                    <p>
                      For a combined word + design mark, include the wording
                      as part of the drawing. For a design-only mark, just
                      the design.
                    </p>
                    <p>
                      Vector formats (SVG, EPS) are ideal but a clean PNG or
                      JPG at high resolution works fine.
                    </p>
                  </HelpToggle>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  A clean image of your logo / design as you want it
                  registered.
                </p>
              </div>
              <SpecimenUploader
                applicationId={applicationId}
                kind="drawing"
                initialFiles={drawings}
              />
            </div>
          )}

          {needsSpecimen && (
            <div className="space-y-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">
                    Upload proof that you&apos;re using the mark{" "}
                    <span className="text-xs font-normal text-zinc-500">
                      (required)
                    </span>
                  </h3>
                  <HelpToggle
                    title="What the USPTO calls a &ldquo;specimen&rdquo;"
                    linkHref="https://www.uspto.gov/trademarks/basics/drawings-and-specimens"
                    linkLabel="USPTO: Drawings and specimens"
                  >
                    <p>
                      The USPTO calls this a <strong>specimen</strong>. It&apos;s
                      a real-world example showing the mark being used to
                      sell or advertise your goods/services right now.
                    </p>
                    <p>For physical products, good specimens include:</p>
                    <ul className="list-disc space-y-0.5 pl-5">
                      <li>A photo of the product with the mark on it</li>
                      <li>A photo of the packaging or label</li>
                      <li>A screenshot of an e-commerce listing page (URL visible)</li>
                    </ul>
                    <p>For services, good specimens include:</p>
                    <ul className="list-disc space-y-0.5 pl-5">
                      <li>Screenshot of your website where you advertise the service</li>
                      <li>Photo of signage</li>
                      <li>A flyer or brochure (with the mark) advertising the service</li>
                    </ul>
                    <p>
                      Bad specimens: mockups, drawings of the product, the
                      drawing of the mark itself, anything that doesn&apos;t
                      show actual commerce.
                    </p>
                  </HelpToggle>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  A photo of the product / packaging, a screenshot of your
                  website or listing page, or signage with the mark visible.
                </p>
              </div>
              <SpecimenUploader
                applicationId={applicationId}
                kind="specimen"
                initialFiles={specimens}
              />
            </div>
          )}
        </section>
      )}

      <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
        {validationErrors.length > 0 && (
          <div
            data-validation-banner
            className="mb-4 rounded-md border border-red-300 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/30"
          >
            <p className="text-sm font-semibold text-red-900 dark:text-red-200">
              Please fix the following before submitting:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-900 dark:text-red-200">
              {validationErrors.map((e) => (
                <li key={e.path}>
                  <span className="font-medium">
                    {FIELD_LABELS[e.path] ?? e.path}
                  </span>
                  : {e.message}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            {saving ? "Saving…" : "Save draft"}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-zinc-900 px-6 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {submitting
              ? "Submitting…"
              : isResubmission
                ? "Resubmit for review"
                : "Submit for attorney review"}
          </button>
        </div>
        {submitError && (
          <p className="mt-3 text-sm text-red-600">{submitError}</p>
        )}
      </div>
    </form>
  );
}

function ClassExamplesHint({
  control,
  index,
}: {
  control: ReturnType<typeof useForm<ApplicationInput>>["control"];
  index: number;
}) {
  const value = useWatch({ control, name: `goodsServices.${index}.class` });
  const matched = value ? getUsptoClass(String(value)) : undefined;
  if (!matched) return null;
  return (
    <span className="mt-1 block text-xs text-zinc-500">
      Examples: {matched.examples}
    </span>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {hint && (
        <span className="mb-1 block text-xs text-zinc-500">{hint}</span>
      )}
      {children}
    </label>
  );
}
