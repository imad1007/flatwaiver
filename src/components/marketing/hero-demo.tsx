"use client";

import { useEffect, useRef, useState } from "react";
import { GripVertical, Sparkles } from "lucide-react";
import { BrowserFrame } from "@/components/marketing/mockups";
import { cn } from "@/lib/utils";

/**
 * Hero conversion loop: PDF is "scanned" → blocks stagger into the editor →
 * preview assembles → published. Safeguards:
 * - SSR renders the finished "done" frame: first paint is complete, no CLS.
 * - The loop starts only after hydration, only while in the viewport.
 * - prefers-reduced-motion disables the loop entirely (static final frame).
 * - Every transition is opacity/transform inside a fixed-height frame.
 */

type Stage = "scan" | "convert" | "done";

const STEPS: [Stage, number][] = [
  ["scan", 2400],
  ["convert", 2800],
  ["done", 3600],
];

const EDITOR_ROWS: { heading?: string; w: string }[] = [
  { heading: "RELEASE OF LIABILITY", w: "w-4/5" },
  { w: "w-full" },
  { w: "w-11/12" },
  { heading: "ASSUMPTION OF RISK", w: "w-3/5" },
  { w: "w-full" },
];

export function HeroDemo({ className }: { className?: string }) {
  const [stage, setStage] = useState<Stage>("done");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;

    let timer: number | undefined;
    let index = -1;

    const advance = () => {
      index = (index + 1) % STEPS.length;
      setStage(STEPS[index][0]);
      timer = window.setTimeout(advance, STEPS[index][1]);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (timer === undefined) {
            index = -1;
            timer = window.setTimeout(advance, 600);
          }
        } else if (timer !== undefined) {
          window.clearTimeout(timer);
          timer = undefined;
          setStage("done");
        }
      },
      { threshold: 0.3 }
    );
    io.observe(el);

    return () => {
      io.disconnect();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  const converting = stage !== "scan"; // blocks visible during convert + done

  return (
    <div ref={ref} className={className} data-stage={stage}>
      <BrowserFrame url="flatwaiver.app/waivers/editor">
        <div className="grid h-60 grid-cols-5 text-[10px]">
          {/* ── Left: PDF scan layer ⇄ editor blocks layer ── */}
          <div className="relative col-span-3 border-r border-border">
            {/* PDF being read */}
            <div
              aria-hidden
              className={cn(
                "absolute inset-0 p-3 transition-opacity duration-500",
                stage === "scan" ? "opacity-100" : "pointer-events-none opacity-0"
              )}
            >
              <div className="relative mx-auto h-full w-4/5 overflow-hidden rounded-md border border-border bg-background p-3">
                <div className="mb-2 flex items-center gap-1.5">
                  <span className="rounded bg-destructive/15 px-1 py-0.5 text-[7px] font-bold text-destructive">
                    PDF
                  </span>
                  <span className="truncate text-[8px] text-muted-foreground">
                    waiver-2019-final.pdf
                  </span>
                </div>
                {["w-full", "w-11/12", "w-full", "w-4/5", "w-full", "w-2/3", "w-full", "w-5/6", "w-3/4"].map(
                  (w, i) => (
                    <div key={i} className={cn("mb-1.5 h-1 rounded bg-muted-foreground/25", w)} />
                  )
                )}
                {/* Scan line */}
                {stage === "scan" && (
                  <div className="animate-fw-scan absolute inset-x-0 h-8 bg-gradient-to-b from-transparent via-brand-500/25 to-transparent" />
                )}
              </div>
              <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[8px] font-semibold text-accent-foreground">
                <Sparkles className="size-2.5" />
                Reading your PDF…
              </div>
            </div>

            {/* Editor blocks (stagger in on convert) */}
            <div
              className={cn(
                "absolute inset-0 space-y-2 p-3 transition-opacity duration-500",
                converting ? "opacity-100" : "pointer-events-none opacity-0"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Adult Liability Waiver</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[8px] font-medium transition-all duration-300",
                    stage === "done"
                      ? "scale-100 bg-success/15 text-success opacity-100"
                      : "scale-75 bg-muted text-muted-foreground opacity-70"
                  )}
                >
                  {stage === "done" ? "published · v3" : "converting…"}
                </span>
              </div>
              {EDITOR_ROWS.map((row, i) => (
                <div
                  key={i}
                  style={{ transitionDelay: converting ? `${i * 220}ms` : "0ms" }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border border-border/70 bg-background px-2 py-1.5 transition-all duration-400",
                    converting ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
                  )}
                >
                  <GripVertical className="size-2.5 shrink-0 text-muted-foreground/50" />
                  {row.heading ? (
                    <span className="font-bold tracking-wide text-foreground/80">
                      {row.heading}
                    </span>
                  ) : (
                    <span className={cn("h-1.5 rounded bg-muted-foreground/25", row.w)} />
                  )}
                </div>
              ))}
              <div
                style={{ transitionDelay: converting ? `${EDITOR_ROWS.length * 220}ms` : "0ms" }}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border border-dashed border-brand-400/50 bg-accent/50 px-2 py-1.5 text-brand-600 transition-all duration-400 dark:text-brand-300",
                  converting ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
                )}
              >
                <Sparkles className="size-2.5" />
                <span className="font-medium">Wording preserved exactly</span>
              </div>
            </div>
          </div>

          {/* ── Right: live preview assembles ── */}
          <div className="col-span-2 space-y-2 bg-muted/40 p-3">
            <div className="text-[8px] font-medium uppercase tracking-wider text-muted-foreground">
              Live preview
            </div>
            <div
              className={cn(
                "space-y-1.5 rounded-lg border border-border bg-card p-2 shadow-card transition-all duration-500",
                converting ? "translate-y-0 opacity-100" : "translate-y-3 opacity-30"
              )}
              style={{ transitionDelay: converting ? "500ms" : "0ms" }}
            >
              <div className="h-1.5 w-2/3 rounded bg-foreground/70" />
              <div className="h-1 w-full rounded bg-muted-foreground/25" />
              <div className="h-1 w-full rounded bg-muted-foreground/25" />
              <div className="h-1 w-4/5 rounded bg-muted-foreground/25" />
              <div className="mt-1.5 h-4 rounded border border-border bg-background" />
              <div className="flex h-7 items-end rounded border border-border bg-background px-1.5 pb-1">
                <svg
                  viewBox="0 0 100 30"
                  fill="none"
                  className={cn(
                    "h-4 w-16 text-brand-600 transition-opacity duration-500 dark:text-brand-300",
                    stage === "done" ? "opacity-100" : "opacity-0"
                  )}
                  aria-hidden
                >
                  <path
                    d="M4 22c6-14 10-16 12-9s2 12 7 6 8-16 12-10-1 16 5 12 9-14 14-11 3 13 9 9 10-12 14-8 4 8 9 6"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div
                className={cn(
                  "h-3.5 rounded-md text-center text-[7px] font-semibold leading-[14px] transition-colors duration-500",
                  stage === "done"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                Sign waiver
              </div>
            </div>
          </div>
        </div>
      </BrowserFrame>
    </div>
  );
}
