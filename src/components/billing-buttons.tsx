"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, CheckCircle2, Clock3, ArrowRight } from "lucide-react";

export function BillingActivationNotice({
  active,
  checkoutId,
}: {
  active: boolean;
  checkoutId?: string;
}) {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (active) return;
    const interval = window.setInterval(() => router.refresh(), 2_500);
    const stop = window.setTimeout(() => {
      window.clearInterval(interval);
      setTimedOut(true);
    }, 30_000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(stop);
    };
  }, [active, router]);

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <div className="flex items-start gap-4">
        <div className={active ? "rounded-xl bg-success/10 p-3 text-success" : "rounded-xl bg-primary/10 p-3 text-primary"}>
          {active ? <CheckCircle2 aria-hidden className="size-6" /> : timedOut ? <Clock3 aria-hidden className="size-6" /> : <Loader2 aria-hidden className="size-6 motion-safe:animate-spin" />}
        </div>
        <div className="min-w-0 flex-1">
          <div role="status" aria-live="polite">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{active ? "You're all set" : "One last step"}</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">{active ? "Your subscription is active" : timedOut ? "Confirmation is taking a little longer" : "Confirming your payment"}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{active ? "Everything is ready. You can start collecting signatures and manage your plan below." : timedOut ? "We haven't received confirmation yet. Please don't pay again. Check your status or ask our team for help." : "We're waiting for secure confirmation from the billing provider. Your plan will update automatically."}</p>
          </div>
          {active ? <Link href="/dashboard" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">Go to dashboard<ArrowRight aria-hidden className="size-4" /></Link> : timedOut ? <div className="mt-4 flex flex-wrap items-center gap-4"><button type="button" onClick={() => router.refresh()} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">Check status</button><Link href="/help" className="text-sm font-medium text-primary">Get help</Link></div> : <p className="mt-3 text-xs text-muted-foreground">You can safely leave this page.</p>}
          {checkoutId && <p className="mt-4 break-all text-xs text-muted-foreground">Reference: {checkoutId}</p>}
        </div>
      </div>
    </section>
  );
}

export function BillingButton({
  endpoint,
  label,
  primary = false,
}: {
  endpoint:
    | "/api/creem/checkout"
    | "/api/creem/portal"
    | "/api/stripe/checkout"
    | "/api/stripe/portal";
  label: string;
  primary?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.url) {
        setError(body?.error ?? "Something went wrong. Try again.");
        return;
      }
      window.location.href = body.url;
    } catch {
      setError("Couldn't reach billing. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className={
          primary
            ? "rounded-xl bg-primary px-6 py-3 transition-colors font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            : "rounded-xl border border-input px-6 py-3 transition-colors font-semibold hover:border-ring disabled:opacity-50"
        }
      >
        {busy ? <span className="inline-flex items-center gap-2"><Loader2 aria-hidden className="size-4 motion-safe:animate-spin" />Opening secure checkout…</span> : label}
      </button>
      {error && (
        <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          <p>{error}</p>
          <Link href="/help" className="mt-1 inline-block font-medium underline underline-offset-2">Contact support</Link>
        </div>
      )}
    </div>
  );
}
