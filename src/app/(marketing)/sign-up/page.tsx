import Link from "next/link";
import { SignUpForm } from "./sign-up-form";

export default function SignUpPage() {
  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">
        Create an account
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Set up an account so you can track your applications and sign in
        without an email round-trip every time.
      </p>
      <SignUpForm />
      <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
