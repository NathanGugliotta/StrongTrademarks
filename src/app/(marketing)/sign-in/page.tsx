import { SignInForm } from "./sign-in-form";

export default function SignInPage() {
  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Enter your email. We&apos;ll send you a one-click sign-in link.
      </p>
      <SignInForm />
    </div>
  );
}
