"use client";

import { useState } from "react";

/**
 * Fetches a short-lived signed URL from the server (after an org check)
 * and opens the file. Buckets are private — this is the only way in.
 */
export function FileDownloadButton({
  bucket,
  path,
  label,
}: {
  bucket: "uploads" | "signatures" | "signed-pdfs";
  path: string;
  label: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/files/sign-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket, path }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Could not generate download link.");
        return;
      }
      const { url } = await res.json();
      window.open(url, "_blank", "noopener");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span>
      <button
        onClick={handleClick}
        disabled={busy}
        className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {busy ? "Preparing…" : label}
      </button>
      {error && <span className="ml-3 text-sm text-destructive">{error}</span>}
    </span>
  );
}
