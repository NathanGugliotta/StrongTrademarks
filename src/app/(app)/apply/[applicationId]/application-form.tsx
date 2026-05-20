"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { saveApplication, submitApplicationForReview } from "../actions";
import { applicationSchema, type ApplicationInput } from "../schema";

const sections = [
  { id: "mark", label: "Mark" },
  { id: "owner", label: "Owner" },
  { id: "basis", label: "Filing basis" },
  { id: "goods", label: "Goods & services" },
];

export function ApplicationForm({
  applicationId,
  defaultValues,
  isResubmission = false,
}: {
  applicationId: string;
  defaultValues?: Partial<ApplicationInput>;
  isResubmission?: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<ApplicationInput>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
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

  async function onSave() {
    setSaving(true);
    const values = form.getValues();
    await saveApplication(applicationId, values);
    setSaving(false);
  }

  async function onSubmit(values: ApplicationInput) {
    setSubmitting(true);
    setSubmitError(null);
    const saved = await saveApplication(applicationId, values);
    if (!saved.ok) {
      setSubmitError(saved.error);
      setSubmitting(false);
      return;
    }
    const result = await submitApplicationForReview(applicationId);
    if (!result.ok) {
      setSubmitError(result.error);
      setSubmitting(false);
      return;
    }
    if (result.paymentRequired) {
      router.push(`/apply/${applicationId}/review`);
    } else {
      router.push("/dashboard");
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-12">
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
              The mark is already being used commercially.
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
              You have a bona fide intent to use the mark in commerce.
            </span>
          </span>
        </label>
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

      <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
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
