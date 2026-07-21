import { BadgeCheck, GripVertical, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** Browser chrome wrapper for product mockups. */
export function BrowserFrame({
  children,
  className,
  url = "flatwaiver.app",
}: {
  children: React.ReactNode;
  className?: string;
  url?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-pop",
        className
      )}
    >
      <div className="flex items-center gap-2 border-b border-border bg-muted/60 px-3 py-2">
        <span className="size-2.5 rounded-full bg-red-400/80" />
        <span className="size-2.5 rounded-full bg-amber-400/80" />
        <span className="size-2.5 rounded-full bg-emerald-400/80" />
        <span className="ml-2 flex-1 truncate rounded-md bg-background/80 px-2 py-0.5 text-center text-[10px] text-muted-foreground">
          {url}
        </span>
      </div>
      {children}
    </div>
  );
}

/** Mini two-pane waiver builder (hero visual). */
export function BuilderMockup({ className }: { className?: string }) {
  return (
    <BrowserFrame className={className} url="flatwaiver.app/waivers/editor">
      <div className="grid grid-cols-5 text-[10px]">
        {/* Editor pane */}
        <div className="col-span-3 space-y-2 border-r border-border p-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">Adult Liability Waiver</span>
            <span className="rounded-full bg-success/15 px-1.5 py-0.5 text-[8px] font-medium text-success">
              published · v3
            </span>
          </div>
          {[
            { label: "RELEASE OF LIABILITY", w: "w-4/5", heading: true },
            { label: "", w: "w-full" },
            { label: "", w: "w-11/12" },
            { label: "ASSUMPTION OF RISK", w: "w-3/5", heading: true },
            { label: "", w: "w-full" },
          ].map((row, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 rounded-md border border-border/70 bg-background px-2 py-1.5"
            >
              <GripVertical className="size-2.5 shrink-0 text-muted-foreground/50" />
              {row.heading ? (
                <span className="font-bold tracking-wide text-foreground/80">
                  {row.label}
                </span>
              ) : (
                <span className={cn("h-1.5 rounded bg-muted-foreground/25", row.w)} />
              )}
            </div>
          ))}
          <div className="flex items-center gap-1.5 rounded-md border border-dashed border-brand-400/50 bg-accent/50 px-2 py-1.5 text-brand-600 dark:text-brand-300">
            <Sparkles className="size-2.5" />
            <span className="font-medium">AI converted from your PDF</span>
          </div>
        </div>
        {/* Live preview pane */}
        <div className="col-span-2 space-y-2 bg-muted/40 p-3">
          <div className="text-[8px] font-medium uppercase tracking-wider text-muted-foreground">
            Live preview
          </div>
          <div className="space-y-1.5 rounded-lg border border-border bg-card p-2 shadow-card">
            <div className="h-1.5 w-2/3 rounded bg-foreground/70" />
            <div className="h-1 w-full rounded bg-muted-foreground/25" />
            <div className="h-1 w-full rounded bg-muted-foreground/25" />
            <div className="h-1 w-4/5 rounded bg-muted-foreground/25" />
            <div className="mt-1.5 h-4 rounded border border-border bg-background" />
            <div className="flex h-7 items-end rounded border border-border bg-background px-1.5 pb-1">
              <SignatureSquiggle className="h-4 w-16 text-brand-600 dark:text-brand-300" />
            </div>
            <div className="h-3.5 rounded-md bg-primary text-center text-[7px] font-semibold leading-[14px] text-primary-foreground">
              Sign waiver
            </div>
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}

/** Signed-waiver evidence card (floats over the hero mockup). */
export function EvidenceCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "w-56 rounded-xl border border-border bg-card p-3 shadow-pop",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold">Maya Rodriguez</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-1.5 py-0.5 text-[9px] font-medium text-success">
          <BadgeCheck className="size-2.5" />
          Signed
        </span>
      </div>
      <div className="mt-2 space-y-1 text-[9px] text-muted-foreground">
        <div className="flex justify-between">
          <span>Signed at</span>
          <span className="text-foreground/80">14:32:07 UTC</span>
        </div>
        <div className="flex justify-between">
          <span>Version</span>
          <span className="text-foreground/80">v3 · locked</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>SHA-256</span>
          <span className="truncate font-mono text-[8px] text-foreground/70">
            9f2ab8e1c44d07a6…
          </span>
        </div>
      </div>
      <div className="mt-2 flex h-6 items-end rounded border border-border bg-background px-1.5 pb-0.5">
        <SignatureSquiggle className="h-4 w-20 text-foreground/80" />
      </div>
    </div>
  );
}

/** Little QR chip (floats over the hero mockup). */
export function QrChip({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-xl border border-border bg-card p-2.5 shadow-pop",
        className
      )}
    >
      <QrPattern className="size-12 text-foreground" />
      <div className="text-[9px] leading-tight">
        <p className="font-semibold">Scan to sign</p>
        <p className="text-muted-foreground">Any phone. No app.</p>
      </div>
    </div>
  );
}

/** Phone frame with a signing flow (feature section visual). */
export function PhoneMockup({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "w-52 rounded-[2rem] border-4 border-foreground/80 bg-card p-3 shadow-pop dark:border-foreground/30",
        className
      )}
    >
      <div className="mx-auto mb-2 h-1 w-12 rounded-full bg-muted-foreground/30" />
      <div className="space-y-1.5 text-[9px]">
        <p className="font-semibold text-foreground">Summit Climbing Gym</p>
        <p className="text-muted-foreground">Adult Liability Waiver</p>
        <div className="space-y-1 rounded-lg border border-border bg-background p-2">
          <div className="h-1 w-full rounded bg-muted-foreground/25" />
          <div className="h-1 w-11/12 rounded bg-muted-foreground/25" />
          <div className="h-1 w-full rounded bg-muted-foreground/25" />
          <div className="h-1 w-3/5 rounded bg-muted-foreground/25" />
        </div>
        <div className="rounded-lg border border-border bg-background px-2 py-1.5 text-muted-foreground">
          Full legal name
        </div>
        <div className="flex h-12 items-end rounded-lg border border-border bg-background px-2 pb-1">
          <SignatureSquiggle className="h-6 w-28 text-brand-600 dark:text-brand-300" />
        </div>
        <div className="flex items-start gap-1 py-0.5 text-[7px] leading-snug text-muted-foreground">
          <span className="mt-px inline-block size-2 shrink-0 rounded-sm border border-brand-500 bg-brand-500 text-center text-[6px] leading-[7px] text-primary-foreground">
            ✓
          </span>
          I agree to sign this document electronically…
        </div>
        <div className="rounded-lg bg-primary py-1.5 text-center text-[9px] font-semibold text-primary-foreground">
          Sign waiver
        </div>
      </div>
    </div>
  );
}

/** PDF → structured blocks conversion visual (AI import feature). */
export function ConvertMockup({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 sm:gap-3", className)}>
      {/* PDF side */}
      <div className="w-28 rotate-[-3deg] rounded-lg border border-border bg-card p-2.5 shadow-card sm:w-32">
        <div className="mb-1.5 flex items-center gap-1">
          <span className="rounded bg-destructive/15 px-1 py-0.5 text-[7px] font-bold text-destructive">
            PDF
          </span>
          <span className="truncate text-[8px] text-muted-foreground">waiver-2019-final.pdf</span>
        </div>
        {["w-full", "w-11/12", "w-full", "w-4/5", "w-full", "w-2/3", "w-full", "w-5/6"].map(
          (w, i) => (
            <div key={i} className={cn("mb-1 h-1 rounded bg-muted-foreground/25", w)} />
          )
        )}
      </div>
      {/* Arrow */}
      <div className="flex flex-col items-center gap-1 text-brand-600 dark:text-brand-300">
        <Sparkles className="size-4" />
        <span className="text-[8px] font-semibold uppercase tracking-wide">AI</span>
        <svg width="28" height="8" viewBox="0 0 28 8" fill="none" aria-hidden>
          <path d="M0 4h24m0 0-4-3m4 3-4 3" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
      {/* Structured side */}
      <div className="w-32 rotate-[2deg] space-y-1 rounded-lg border border-border bg-card p-2.5 shadow-card sm:w-36">
        <div className="rounded border border-border/70 bg-background px-1.5 py-1 text-[7px] font-bold tracking-wide text-foreground/80">
          RELEASE OF LIABILITY
        </div>
        <div className="rounded border border-border/70 bg-background px-1.5 py-1">
          <div className="h-1 w-full rounded bg-muted-foreground/25" />
          <div className="mt-0.5 h-1 w-4/5 rounded bg-muted-foreground/25" />
        </div>
        <div className="flex items-center justify-between rounded border border-border/70 bg-background px-1.5 py-1 text-[7px] text-muted-foreground">
          <span>Email</span>
          <span className="rounded bg-muted px-1 text-[6px]">required</span>
        </div>
        <div className="flex items-center justify-between rounded border border-border/70 bg-background px-1.5 py-1 text-[7px] text-muted-foreground">
          <span>Date of birth</span>
          <span className="rounded bg-muted px-1 text-[6px]">required</span>
        </div>
        <div className="rounded bg-success/15 px-1.5 py-1 text-[7px] font-medium text-success">
          Wording preserved exactly ✓
        </div>
      </div>
    </div>
  );
}

function SignatureSquiggle({ className }: { className?: string }) {
  // `fw-draw`: strokes draw themselves when inside a visible Reveal wrapper
  // (see globals.css; instantly complete under prefers-reduced-motion).
  return (
    <svg viewBox="0 0 100 30" fill="none" className={cn("fw-draw", className)} aria-hidden>
      <path
        d="M4 22c6-14 10-16 12-9s2 12 7 6 8-16 12-10-1 16 5 12 9-14 14-11 3 13 9 9 10-12 14-8 4 8 9 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function QrPattern({ className }: { className?: string }) {
  // Decorative QR-style pattern (not a real code).
  const cells = [
    "M1 1h3v3H1z", "M8 1h3v3H8z", "M1 8h3v3H1z",
    "M5 5h1v1H5z", "M7 5h1v1H7z", "M5 7h1v1H5z", "M9 6h1v1H9z",
    "M6 9h1v1H6z", "M8 8h1v1H8z", "M10 9h1v1h-1z", "M9 10h1v1H9z",
    "M5 1h1v2H5z", "M1 5h2v1H1z", "M10 4h1v1h-1z", "M4 10h1v1H4z",
  ];
  return (
    <svg viewBox="0 0 12 12" className={className} aria-hidden>
      {cells.map((d, i) => (
        <path key={i} d={d} fill="currentColor" />
      ))}
      <path d="M2 2h1v1H2zM9 2h1v1H9zM2 9h1v1H2z" fill="var(--color-card)" />
    </svg>
  );
}
