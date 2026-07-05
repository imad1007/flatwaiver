"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, FlaskConical, RotateCcw } from "lucide-react";
import {
  SignatureCanvas,
  type SignatureCanvasHandle,
} from "@/components/signature-canvas";
import { Button } from "@/components/ui/button";

/**
 * Interactive signing sandbox for the landing page. Deliberately and
 * unmistakably a demo: labeled everywhere, runs 100% client-side, makes no
 * network calls, stores nothing, and the "receipt" is visibly fake — no
 * authentic-looking PDF, no real hash, no legal language.
 */
export function DemoSandbox() {
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const signatureRef = useRef<SignatureCanvasHandle>(null);

  function handleSign(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!signatureRef.current?.getDataUrl()) {
      setError("Draw a signature first — a quick scribble works here, it's a demo.");
      return;
    }
    // Nothing leaves the browser: the drawn signature is discarded on reset.
    setSignedAt(
      new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  }

  function reset() {
    setName("");
    setConsent(false);
    setError(null);
    setSignedAt(null);
    signatureRef.current?.clear();
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-pop sm:p-8">
        {/* Demo label — always visible */}
        <div className="mb-5 flex items-center justify-center gap-2 rounded-lg border border-dashed border-brand-400/60 bg-accent/60 px-3 py-2 text-xs font-bold uppercase tracking-wider text-accent-foreground">
          <FlaskConical className="size-3.5" />
          Interactive demo — nothing is saved
        </div>

        {signedAt === null ? (
          <form onSubmit={handleSign} className="space-y-5">
            {/* Sample waiver text — obviously a sample */}
            <div className="space-y-2 rounded-lg border border-border bg-background p-4">
              <h3 className="text-sm font-bold">DEMO ACTIVITY WAIVER</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                This is sample text for demonstration only — not a legal
                document. In the real product this is <em>your</em> waiver,
                with your exact wording preserved character-for-character.
              </p>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">Your name (optional)</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Demo"
                className="w-full rounded-md border border-input bg-card px-3 py-2.5 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </label>

            <SignatureCanvas ref={signatureRef} label="Draw any signature" />

            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 size-5 accent-primary"
              />
              I understand this is a demo — nothing is stored, sent, or signed.
            </label>

            {error && (
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" className="w-full">
              Sign the demo waiver
            </Button>
          </form>
        ) : (
          <div className="text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-success/15 text-2xl text-success duration-300 animate-in zoom-in-75">
              ✓
            </div>
            <h3 className="mt-4 text-xl font-bold">
              Nicely done — that&apos;s the whole signer experience.
            </h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Ten seconds on any phone, no app, no account.
            </p>

            {/* Visibly fake receipt — not a legal record */}
            <div className="mt-5 rounded-lg border-2 border-dashed border-border bg-muted/40 p-4 text-left text-sm">
              <p className="text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Demo receipt — not a legal record
              </p>
              <div className="mt-3 space-y-1.5 text-muted-foreground">
                <div className="flex justify-between">
                  <span>Signer</span>
                  <span className="text-foreground/80">{name.trim() || "Jane Demo"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Signed at</span>
                  <span className="text-foreground/80">{signedAt} (your clock)</span>
                </div>
                <div className="flex justify-between">
                  <span>Integrity hash</span>
                  <span className="text-foreground/80">none — demo only</span>
                </div>
              </div>
              <p className="mt-3 flex items-start gap-1.5 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                <BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
                In the real product, this moment produces a court-ready PDF with a
                SHA-256 integrity hash, locked to the exact waiver version signed.
              </p>
            </div>

            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button size="lg" render={<Link href="/signup" />}>
                Start free 14-day trial
                <ArrowRight className="size-4" />
              </Button>
              <Button variant="ghost" onClick={reset}>
                <RotateCcw className="size-3.5" />
                Try again
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
