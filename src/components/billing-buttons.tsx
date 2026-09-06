"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function BillingActivationNotice({
  active,
  checkoutId,
}: {
  active: boolean;
  checkoutId?: string;
}) {
  const router = useRouter();

  useEffect(() => {
    if (active) return;
    const interval = window.setInterval(() => router.refresh(), 2_500);
    const stop = window.setTimeout(() => window.clearInterval(interval), 15_000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(stop);
    };
  }, [active, router]);

  return (
    <div
      role="status"
      className="mt-4 rounded-md border border-success/30 bg-success/10 p-4 text-sm text-success"
    >
      {active
        ? "Payment confirmed—your subscription is active."
        : "Checkout returned successfully. We're waiting for secure confirmation from the billing provider; this page will refresh automatically."}
      {checkoutId && (
        <span className="mt-1 block text-xs text-success/80">Reference: {checkoutId}</span>
      )}
    </div>
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
    <span>
      <button
        onClick={handleClick}
        disabled={busy}
        className={
          primary
            ? "rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            : "rounded-md border border-input px-6 py-3 font-semibold hover:border-ring disabled:opacity-50"
        }
      >
        {busy ? "One moment…" : label}
      </button>
      {error && (
        <span role="alert" className="ml-3 text-sm text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}
