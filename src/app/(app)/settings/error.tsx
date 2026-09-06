"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function SettingsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Settings page failed", error); }, [error]);
  return (
    <div role="alert" className="rounded-xl border border-destructive/25 bg-card p-6">
      <AlertTriangle aria-hidden className="size-5 text-destructive" />
      <h2 className="mt-3 text-lg font-semibold">We couldn’t load these settings</h2>
      <p className="mt-2 text-sm text-muted-foreground">Your changes have not been affected. Try again, or contact support if the problem continues.</p>
      {error.digest && <p className="mt-3 text-xs text-muted-foreground">Reference: {error.digest}</p>}
      <div className="mt-5 flex gap-3">
        <button type="button" onClick={reset} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Try again</button>
        <Link href="/help" className="rounded-lg border px-4 py-2 text-sm font-medium">Contact support</Link>
      </div>
    </div>
  );
}
