import { Mail } from "lucide-react";

export default function VerifyRequestPage() {
  return (
    <div className="mx-auto max-w-md px-6 py-20 text-center">
      <Mail className="mx-auto h-10 w-10 text-zinc-500" />
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        Check your email
      </h1>
      <p className="mt-3 text-zinc-600 dark:text-zinc-400">
        A sign-in link has been sent to your email address. Click the link to
        finish signing in. The link expires in 24 hours.
      </p>
      <p className="mt-6 text-xs text-zinc-500">
        Didn&apos;t get the email? Check your spam folder, or request a new
        link.
      </p>
    </div>
  );
}
