import Link from "next/link";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col flex-1">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="font-semibold tracking-tight text-lg">
            StrongTrademarks
          </Link>
          <div className="hidden gap-8 text-sm sm:flex">
            <Link href="/how-it-works" className="hover:underline">
              How it works
            </Link>
            <Link href="/pricing" className="hover:underline">
              Pricing
            </Link>
            <Link href="/faq" className="hover:underline">
              FAQ
            </Link>
            <Link href="/consult" className="hover:underline">
              Talk to an attorney
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/sign-in"
              className="text-sm font-medium hover:underline"
            >
              Sign in
            </Link>
            <Link
              href="/apply"
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Start application
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-6xl px-6 py-10 text-xs text-zinc-500 dark:text-zinc-400">
          <div className="grid gap-8 sm:grid-cols-2">
            <div className="max-w-md">
              <p className="mb-2 font-medium">Important notice</p>
              <p>
                StrongTrademarks is operated by Gugliotta &amp; Gugliotta,
                LPA, a licensed Ohio law firm. The site itself is not a law
                firm and does not provide legal advice. Use of this site
                does not create an attorney-client relationship until you
                have signed an engagement letter with the firm at checkout.
              </p>
            </div>
            <div>
              <p className="mb-2 font-medium">Links</p>
              <ul className="space-y-1">
                <li>
                  <Link href="/consult" className="hover:underline">
                    Talk to an attorney
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:underline">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:underline">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/refunds" className="hover:underline">
                    Refund Policy
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:underline">
                    Contact
                  </Link>
                </li>
                <li>
                  <a
                    href="https://gugliotta.legal"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    Law firm: gugliotta.legal ↗
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <p className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
            © {new Date().getFullYear()} Gugliotta &amp; Gugliotta, LPA.
            All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
