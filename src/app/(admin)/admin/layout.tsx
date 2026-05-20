import Link from "next/link";
import { requireAttorney } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";

// Admin pages depend on per-request session + DB lookups. Never prerender.
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAttorney();

  return (
    <div className="flex flex-col flex-1">
      <header className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="font-semibold tracking-tight">
              Attorney inbox
            </Link>
            <span className="rounded bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
              Internal
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <Link href="/admin" className="hover:underline">
              Inbox
            </Link>
            <Link href="/dashboard" className="hover:underline">
              Customer view
            </Link>
            <span className="text-zinc-500">{user.email}</span>
            <SignOutButton />
          </div>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
