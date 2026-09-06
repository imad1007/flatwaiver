"use client";

import { useId, useState } from "react";

type ExportKind = "csv" | "pdfs";

const EXPORTS: Record<
  ExportKind,
  { path: string; label: string; busyLabel: string; fallbackName: string }
> = {
  csv: {
    path: "/api/signatures/export",
    label: "Export CSV",
    busyLabel: "Preparing CSV…",
    fallbackName: "flatwaiver-signatures.csv",
  },
  pdfs: {
    path: "/api/signatures/export-pdfs",
    label: "Download PDFs (ZIP)",
    busyLabel: "Preparing ZIP…",
    fallbackName: "flatwaiver-signed-pdfs.zip",
  },
};

export function SignatureExportButtons({ query }: { query: string }) {
  const errorId = useId();
  const [busy, setBusy] = useState<ExportKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download(kind: ExportKind) {
    if (busy) return;
    const config = EXPORTS[kind];
    setBusy(kind);
    setError(null);

    try {
      const response = await fetch(`${config.path}${query ? `?${query}` : ""}`);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(
          body?.error ??
            "The export could not be prepared. Narrow your filters and try again.",
        );
        return;
      }

      const blob = await response.blob();
      if (blob.size === 0) {
        setError("The export was empty. Try again before relying on this file.");
        return;
      }

      const disposition = response.headers.get("content-disposition") ?? "";
      const suppliedName = disposition.match(/filename="?([^";]+)"?/i)?.[1];
      const filename = suppliedName?.split(/[\\/]/).pop() || config.fallbackName;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch {
      setError(
        "We couldn't reach the export service. Check your connection and try again.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {(Object.keys(EXPORTS) as ExportKind[]).map((kind) => {
        const config = EXPORTS[kind];
        return (
          <button
            key={kind}
            type="button"
            onClick={() => download(kind)}
            disabled={busy !== null}
            aria-describedby={error ? errorId : undefined}
            className="rounded-md border border-input px-4 py-2 text-sm font-semibold hover:border-ring disabled:cursor-wait disabled:opacity-60"
          >
            {busy === kind ? config.busyLabel : config.label}
          </button>
        );
      })}
      {error && (
        <p id={errorId} role="alert" className="basis-full text-right text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
