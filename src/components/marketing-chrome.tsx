import Link from "next/link";
import { APP } from "@/lib/config";

export function MarketingHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-bold tracking-tight">
          {APP.name}
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/login" className="text-muted-foreground hover:text-foreground">
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90"
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
    <footer className="border-t border-border py-8">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 text-sm text-muted-foreground">
        <span>
          © {new Date().getFullYear()} {APP.name}
        </span>
        <nav className="flex items-center gap-4">
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <span aria-hidden>·</span>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <span aria-hidden>·</span>
          <a href={`mailto:${APP.supportEmail}`} className="hover:text-foreground">
            {APP.supportEmail}
          </a>
        </nav>
      </div>
    </footer>
  );
}
