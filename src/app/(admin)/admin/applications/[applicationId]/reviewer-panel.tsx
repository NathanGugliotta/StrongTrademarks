"use client";

import { useActionState } from "react";
import { reviewerDecision } from "./actions";

const initialState: { ok?: true } | { ok: false; error: string } | null = null;

export function ReviewerPanel({
  applicationId,
  applicationStatus,
}: {
  applicationId: string;
  applicationStatus: string;
}) {
  const [state, formAction, pending] = useActionState(
    async (
      _prev: typeof initialState,
      formData: FormData,
    ): Promise<typeof initialState> => {
      const result = await reviewerDecision(formData);
      return result;
    },
    initialState,
  );

  const terminal =
    applicationStatus === "filed" || applicationStatus === "rejected";

  return (
    <div className="mt-12 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
      <h2 className="text-lg font-semibold">Reviewer decision</h2>

      {terminal && (
        <p className="mt-2 rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          This application is in terminal state (
          <span className="capitalize">
            {applicationStatus.replace(/_/g, " ")}
          </span>
          ). No further reviewer actions are needed.
        </p>
      )}

      <form action={formAction} className="mt-4 space-y-4">
        <input type="hidden" name="applicationId" value={applicationId} />

        <label className="block">
          <span className="mb-1 block text-sm font-medium">
            USPTO serial number
            <span className="ml-2 text-xs font-normal text-zinc-500">
              required when marking filed
            </span>
          </span>
          <input
            type="text"
            name="usptoSerialNumber"
            placeholder="e.g. 97/123,456"
            disabled={terminal || pending}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">
            Notes
            <span className="ml-2 text-xs font-normal text-zinc-500">
              required for Request changes / Reject; visible to the customer
            </span>
          </span>
          <textarea
            name="notes"
            rows={4}
            disabled={terminal || pending}
            placeholder="What did you find? What does the customer need to do?"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            name="intent"
            value="filed"
            disabled={terminal || pending}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Mark filed
          </button>
          <button
            type="submit"
            name="intent"
            value="changes_requested"
            disabled={terminal || pending}
            className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            Request changes
          </button>
          <button
            type="submit"
            name="intent"
            value="rejected"
            disabled={terminal || pending}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Reject
          </button>
        </div>

        {state && state.ok === false && (
          <p className="text-sm text-red-600">{state.error}</p>
        )}
        {state && state.ok === true && (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            Decision recorded.
          </p>
        )}
      </form>
    </div>
  );
}
