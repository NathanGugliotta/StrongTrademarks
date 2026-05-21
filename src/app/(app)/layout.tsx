import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";

// (app) pages depend on per-request cookies + session + DB. Never prerender.
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-col flex-1">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="font-semibold tracking-tight text-lg">
            StrongTrademarks
          </Link>
          <div className="flex items-center gap-6 text-sm">
            {user ? (
              <>
                <Link href="/dashboard" className="hover:underline">
                  Dashboard
                </Link>
                <Link href="/apply" className="hover:underline">
                  New application
                </Link>
                <Link href="/consult" className="hover:underline">
                  Talk to an attorney
                </Link>
                {(user.role === "attorney" || user.role === "admin") && (
                  <Link href="/admin" className="hover:underline">
                    Inbox
                  </Link>
                )}
                <span className="text-zinc-500">{user.email}</span>
                <SignOutButton />
              </>
            ) : (
              <>
                <Link href="/apply" className="hover:underline">
                  Start application
                </Link>
                <Link href="/consult" className="hover:underline">
                  Talk to an attorney
                </Link>
                <Link
                  href="/sign-in"
                  className="text-sm font-medium hover:underline"
                >
                  Sign in
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
