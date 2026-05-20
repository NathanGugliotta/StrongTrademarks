"use client";

import { useActionState, useState } from "react";
import { sendMagicLink, signInWithPassword } from "./actions";

export function SignInForm() {
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [pwState, pwAction, pwPending] = useActionState(
    signInWithPassword,
    null,
  );
  const [mlState, mlAction, mlPending] = useActionState(sendMagicLink, null);

  return (
    <div className="mt-8 space-y-6">
      <div className="flex rounded-md border border-zinc-200 p-1 text-sm dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setMode("password")}
          className={`flex-1 rounded px-3 py-1.5 font-medium ${
            mode === "password"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-600 dark:text-zinc-400"
          }`}
        >
          Password
        </button>
        <button
          type="button"
          onClick={() => setMode("magic")}
          className={`flex-1 rounded px-3 py-1.5 font-medium ${
            mode === "magic"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-600 dark:text-zinc-400"
          }`}
        >
          Email link
        </button>
      </div>

      {mode === "password" ? (
        <form action={pwAction} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Email</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Password</span>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <button
            type="submit"
            disabled={pwPending}
            className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {pwPending ? "Signing in…" : "Sign in"}
          </button>
          {pwState?.error && (
            <p className="text-sm text-red-600">{pwState.error}</p>
          )}
        </form>
      ) : (
        <form action={mlAction} className="space-y-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            We&apos;ll email you a one-click sign-in link. The link expires in
            24 hours.
          </p>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Email</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <button
            type="submit"
            disabled={mlPending}
            className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {mlPending ? "Sending…" : "Send magic link"}
          </button>
          {mlState?.error && (
            <p className="text-sm text-red-600">{mlState.error}</p>
          )}
        </form>
      )}
    </div>
  );
}
