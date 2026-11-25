"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

export type DisplayPass = { number: number; code: string; revoked: boolean };
export const receiptStorageKey = (slug: string) => `fw-pass-receipt:${slug}`;

export function PassCards({ passes }: { passes: DisplayPass[] }) {
  const [images, setImages] = useState<Record<number, string>>({});
  useEffect(() => {
    let live = true;
    void Promise.all(passes.filter(p => !p.revoked).map(async p => [p.number, await QRCode.toDataURL(p.code, { width: 320, margin: 4, errorCorrectionLevel: "M" })] as const)).then(entries => { if (live) setImages(Object.fromEntries(entries)); });
    return () => { live = false; };
  }, [passes]);
  return <div data-clarity-mask="true" data-private className="mt-5 grid gap-5 sm:grid-cols-2">
    {passes.map(pass => <article key={pass.number} className="rounded-xl border bg-card p-5 text-center">
      <h3 className="font-semibold">Participant {pass.number}</h3>
      {pass.revoked ? <p className="mt-3 text-sm text-destructive">This pass was revoked. Contact the venue.</p> : <>
        {images[pass.number] ? <>
          {/* QR deliberately contains an opaque code, not a URL or personal details. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[pass.number]} alt={`Check-in QR for participant ${pass.number}`} width={320} height={320} className="mx-auto mt-3 h-auto w-full max-w-64 rounded-lg bg-white" />
          <a href={images[pass.number]} download={`waiver-pass-${pass.number}.png`} className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground">Download QR pass</a>
          <details className="mt-3 text-sm"><summary className="cursor-pointer py-2 text-primary underline">Code for manual staff entry</summary><code className="mt-2 block break-all rounded-lg border p-3 text-xs">{pass.code}</code></details>
        </> : <p role="status" className="py-8 text-sm text-muted-foreground">Preparing QR…</p>}
      </>}
    </article>)}
  </div>;
}

export function SignerPasses({ slug, receipt: provided }: { slug: string; receipt?: string }) {
  const [passes, setPasses] = useState<DisplayPass[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      let receipt = provided;
      if (!receipt) { try { receipt = sessionStorage.getItem(receiptStorageKey(slug)) ?? undefined; } catch { /* Private browser storage can be unavailable. */ } }
      if (!receipt) { setError("Ask the venue to retrieve your pass from your signed record. Your waiver is already saved."); return; }
      try {
        setError("");
        const response = await fetch("/api/waiver-passes/receipt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ receipt }), cache: "no-store", signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Could not load passes.");
        setPasses(body.passes);
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Could not load passes."); }
    })();
    return () => controller.abort();
  }, [slug, provided, attempt]);
  return <section className="mt-7 w-full max-w-2xl text-left" aria-labelledby="pass-heading" data-clarity-mask="true" data-private>
    <h2 id="pass-heading" className="text-xl font-bold">Your check-in pass</h2>
    <p className="mt-2 text-sm text-muted-foreground">Save each participant&apos;s QR and present it to venue staff. A pass helps staff find the signed waiver; it does not guarantee admission. Participant numbers follow the order on the signing form. Guardians only need a separate pass if they also participated.</p>
    {error ? <div role="alert" className="mt-4 rounded-lg border p-4 text-sm"><p>{error}</p><button type="button" onClick={() => setAttempt(n => n + 1)} className="mt-2 min-h-11 font-semibold text-primary underline">Try loading passes again</button></div> : passes ? <PassCards passes={passes} /> : <p role="status" className="mt-5">Loading passes…</p>}
  </section>;
}

export function StaffPasses({ signatureId }: { signatureId: string }) {
  const [passes, setPasses] = useState<DisplayPass[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <div className="mt-2" data-private data-clarity-mask="true">
    <button type="button" disabled={busy} className="min-h-11 text-xs font-medium text-primary underline disabled:opacity-50" onClick={async () => {
      if (passes) { setPasses(null); return; }
      setBusy(true); setError("");
      try { const r = await fetch("/api/checkin/passes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signatureId }) }); const body = await r.json(); if (!r.ok) throw new Error(body.error); setPasses(body.passes); }
      catch { setError("Could not load passes. Try again."); } finally { setBusy(false); }
    }}>{busy ? "Loading…" : passes ? "Hide QR passes" : "Get QR passes"}</button>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    {passes && <PassCards passes={passes} />}
  </div>;
}
