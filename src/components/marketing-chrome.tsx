import Link from "next/link";
import { APP } from "@/lib/config";

export function MarketingHeader() {
  return (
    <header className="border-b border-neutral-200">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-bold tracking-tight">
          {APP.name}
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/login" className="text-neutral-600 hover:text-neutral-900">
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-md bg-neutral-900 px-4 py-2 font-medium text-white hover:bg-neutral-700"
          >
            Start free trial
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-neutral-200 py-8">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 text-sm text-neutral-500">
        <span>
          © {new Date().getFullYear()} {APP.name}
        </span>
        <nav className="flex items-center gap-4">
          <Link href="/privacy" className="hover:text-neutral-900">
            Privacy
          </Link>
          <span aria-hidden>·</span>
          <Link href="/terms" className="hover:text-neutral-900">
            Terms
          </Link>
          <span aria-hidden>·</span>
          <a href={`mailto:${APP.supportEmail}`} className="hover:text-neutral-900">
            {APP.supportEmail}
          </a>
        </nav>
      </div>
    </footer>
  );
}
