"use client";

import { useState } from "react";

export function BillingButton({
  endpoint,
  label,
  primary = false,
}: {
  endpoint: "/api/stripe/checkout" | "/api/stripe/portal";
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
            ? "rounded-md bg-neutral-900 px-6 py-3 font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"
            : "rounded-md border border-neutral-300 px-6 py-3 font-semibold hover:border-neutral-900 disabled:opacity-50"
        }
      >
        {busy ? "One moment…" : label}
      </button>
      {error && <span className="ml-3 text-sm text-red-600">{error}</span>}
    </span>
  );
}
