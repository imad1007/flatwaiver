"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, Rocket, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface GuideStep {
  key: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  done: boolean;
}

const DISMISS_KEY = "fw-getting-started-dismissed";
const DISMISS_EVENT = "fw-getting-started-dismiss";

// Read the (client-only) dismissed flag without a setState-in-effect and
// without a hydration mismatch: SSR snapshot is always false; the client reads
// localStorage and re-renders once hydrated.
function subscribe(callback: () => void) {
  window.addEventListener(DISMISS_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(DISMISS_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
function useDismissed() {
  return useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(DISMISS_KEY) === "1",
    () => false
  );
}

/**
 * First-run getting-started checklist for the dashboard. Steps compute their
 * "done" state from real data (server-side), so it reflects actual progress and
 * disappears once everything's complete. A user can also dismiss it (persisted
 * in localStorage). Pairs with the onboarding wizard: new users land here with
 * step 1 already done and are guided to publish, brand, and collect.
 */
export function GettingStarted({ steps }: { steps: GuideStep[] }) {
  const dismissed = useDismissed();

  const done = steps.filter((s) => s.done).length;
  const allDone = done === steps.length;
  if (allDone || dismissed) return null;

  const nextIdx = steps.findIndex((s) => !s.done);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
      window.dispatchEvent(new Event(DISMISS_EVENT));
    } catch {
      // ignore (private mode, etc.)
    }
  }

  return (
    <section className="mb-8 rounded-2xl border border-brand-500/40 bg-card p-6 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-brand-600 dark:text-brand-300">
            <Rocket className="size-4.5" />
          </span>
          <div>
            <h2 className="font-bold leading-tight">Get set up</h2>
            <p className="text-sm text-muted-foreground">
              {done} of {steps.length} done — a few quick steps to your first
              signature.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss getting-started guide"
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${(done / steps.length) * 100}%` }}
        />
      </div>

      <ol className="mt-5 space-y-2">
        {steps.map((step, i) => {
          const isNext = i === nextIdx;
          return (
            <li
              key={step.key}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3",
                isNext ? "border-brand-500/40 bg-accent/40" : "border-border"
              )}
            >
              {step.done ? (
                <CheckCircle2 className="size-5 shrink-0 text-success" />
              ) : (
                <Circle
                  className={cn(
                    "size-5 shrink-0",
                    isNext ? "text-primary" : "text-muted-foreground/40"
                  )}
                />
              )}
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    step.done && "text-muted-foreground line-through"
                  )}
                >
                  {step.title}
                </p>
                {!step.done && (
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                )}
              </div>
              {!step.done && (
                <Link
                  href={step.href}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                    isNext
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border border-input hover:border-ring"
                  )}
                >
                  {step.cta}
                  <ArrowRight className="size-3" />
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
