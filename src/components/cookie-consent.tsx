"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConsent, useConsentReady, setConsent } from "@/lib/consent";
import { isSignerPage } from "@/lib/signer-pages";

/**
 * Cookie-consent banner. Shows until the visitor chooses. "Accept" unlocks the
 * non-essential third parties (analytics, ads, chat) — until then only the
 * strictly-necessary cookies (auth, theme, bot protection) are set.
 */
export function CookieConsent() {
  const consent = useConsent();
  const ready = useConsentReady();
  const pathname = usePathname();
  // Already chosen, or on a white-labeled signer page (essential cookies only).
  if (!ready || consent !== null || isSignerPage(pathname)) return null;

  return (
    <section
      aria-label="Cookie preferences"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-2xl border border-border bg-card p-5 shadow-pop sm:inset-x-6 sm:bottom-6 sm:p-6"
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <Cookie aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight">Your privacy, your choice</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Essential cookies keep FlatWaiver running. With your permission,
            optional cookies enable analytics, advertising measurement and chat.
            You can change your choice in our{" "}
            <Link href="/privacy" className="font-medium text-foreground underline underline-offset-4 hover:text-primary">
              Privacy Policy
            </Link>.
          </p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:ml-auto sm:max-w-sm">
        <Button variant="outline" onClick={() => setConsent("denied")}>Essential only</Button>
        <Button onClick={() => setConsent("granted")}>Accept optional</Button>
      </div>
    </section>
  );
}
