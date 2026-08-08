"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConsent, setConsent } from "@/lib/consent";
import { isSignerPage } from "@/lib/signer-pages";

/**
 * Cookie-consent banner. Shows until the visitor chooses. "Accept" unlocks the
 * non-essential third parties (analytics, ads, chat) — until then only the
 * strictly-necessary cookies (auth, theme, bot protection) are set.
 */
export function CookieConsent() {
  const consent = useConsent();
  const pathname = usePathname();
  // Already chosen, or on a white-labeled signer page (essential cookies only).
  if (consent !== null || isSignerPage(pathname)) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 shadow-pop backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-start gap-2.5">
          <Cookie className="mt-0.5 size-5 shrink-0 text-brand-600 dark:text-brand-300" />
          <p className="text-sm text-muted-foreground">
            We use essential cookies to run the site, and — only if you agree —
            analytics and chat to improve it. See our{" "}
            <Link
              href="/privacy"
              className="font-medium text-primary underline underline-offset-2 hover:opacity-80"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => setConsent("denied")}>
            Decline
          </Button>
          <Button size="sm" onClick={() => setConsent("granted")}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
