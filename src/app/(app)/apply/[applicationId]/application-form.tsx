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
        <h2 className="text-xl font-semibold">Mark</h2>
        <Field label="Mark type">
          <select
            {...form.register("markType")}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="word">Word mark (text only)</option>
            <option value="design">Design mark (logo)</option>
            <option value="combined">Combined word + design</option>
          </select>
        </Field>
        <Field label="Mark text">
          <input
            type="text"
            {...form.register("markText")}
            placeholder="The exact text of your mark"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </Field>
        <Field
          label="Mark description"
          hint="If your mark includes design elements, describe them here. (Optional for word-only marks.)"
        >
          <textarea
            {...form.register("markDescription")}
            rows={3}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </Field>
      </section>

      <section id="owner" className="space-y-4">
        <h2 className="text-xl font-semibold">Owner</h2>
        <Field label="Owner name">
          <input
            type="text"
            {...form.register("ownerName")}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </Field>
        <Field label="Entity type">
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
        <h2 className="text-xl font-semibold">Filing basis</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Are you already using the mark in commerce, or do you intend to use
          it?
        </p>
        <label className="flex items-start gap-2">
          <input
            type="radio"
            value="use"
            {...form.register("filingBasis")}
            className="mt-1"
          />
          <span>
            <span className="font-medium">Use in commerce (1(a))</span>
            <span className="block text-sm text-zinc-500">
              The mark is already being used commercially. Requires a
              specimen and first-use dates.
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
            <span className="font-medium">Intent to use (1(b))</span>
            <span className="block text-sm text-zinc-500">
              You have a bona fide intent to use the mark in commerce. A
              Statement of Use (with an additional USPTO fee) will be required
              later, before registration.
            </span>
          </span>
        </label>

        {filingBasis === "use" && (
          <div className="mt-4 space-y-4 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
            <p className="text-sm font-medium">
              First-use dates (required for use-in-commerce filings)
            </p>
            <Field
              label="First use in commerce"
              hint="The first date you sold or offered the goods/services under this mark across state lines or in U.S. commerce."
            >
              <input
                type="date"
                {...form.register("firstUseInCommerceDate")}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </Field>
            <Field
              label="First use anywhere"
              hint="The first date you used the mark publicly in any capacity, even before formal commercial sale. Often the same as the date above."
            >
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
        <h2 className="text-xl font-semibold">Goods & services</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          List the goods or services covered by the mark, with the
          international class.
        </p>
        {goods.fields.map((field, i) => (
          <div
            key={field.id}
            className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <Field label="Class">
              <input
                type="text"
                {...form.register(`goodsServices.${i}.class`)}
                placeholder="e.g. 25 (clothing)"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </Field>
            <Field label="Description">
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
                <h3 className="font-medium">
                  Drawing of the mark{" "}
                  <span className="text-xs font-normal text-zinc-500">
                    (required)
                  </span>
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  An image showing the design portion of your mark exactly as
                  you want it registered. For combined word + design marks,
                  this is the logo with the wording included.
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
                <h3 className="font-medium">
                  Specimen of use in commerce{" "}
                  <span className="text-xs font-normal text-zinc-500">
                    (required for 1(a) filings)
                  </span>
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  Evidence that you&apos;re actually using the mark with your
                  goods or services in commerce — a photo of the product or
                  packaging, a screenshot of the listing page, a photo of
                  signage, etc.
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
