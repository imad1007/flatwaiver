"use client";

import { useState } from "react";
import {
  COMPARABLE_COMPETITORS,
  COMPETITOR_PRICING_CHECKED_ON,
  publishedPlanCost,
  SMARTWAIVER_PRICING,
  SMARTWAIVER_PRICING_NOTICE,
} from "@/lib/competitor-pricing";
import { APP } from "@/lib/config";

const OUR_PRICE = APP.priceMonthlyUsd;
const MIN_VOLUME = 100;
const MAX_VOLUME = 1_000;
const CHART_MAX = 160;

export function SavingsCalculator() {
  const [schedule, setSchedule] = useState<"current" | "announced">("current");
  const [volume, setVolume] = useState(1_000);
  const estimates = COMPARABLE_COMPETITORS.map((competitor) => ({
    name: competitor.name,
    cost: publishedPlanCost(competitor.name === "Smartwaiver" ? SMARTWAIVER_PRICING[schedule].plans : competitor.plans, volume),
  }));
  const yearlyDifferences = estimates.filter((estimate): estimate is typeof estimate & { cost: number } => estimate.cost !== null).map((estimate) =>
    Math.max(0, Math.round((estimate.cost - OUR_PRICE) * 12)),
  );
  const minYearlyDifference = yearlyDifferences.length ? Math.min(...yearlyDifferences) : 0;
  const maxYearlyDifference = yearlyDifferences.length ? Math.max(...yearlyDifferences) : 0;
  const bars = [
    ...estimates.map((estimate) => ({ ...estimate, us: false })),
    { name: APP.name, cost: OUR_PRICE, us: true },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-8">
      <label className="mb-4 block text-xs">Smartwaiver pricing period <select aria-label="Smartwaiver pricing period" value={schedule} onChange={(event) => setSchedule(event.target.value as "current" | "announced")} className="ml-2 max-w-full rounded border bg-background p-1"><option value="current">Current — through October 7, 2026</option><option value="announced">Announced — from October 8, 2026</option></select></label>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor="volume-slider" className="text-sm font-medium">
          Waivers you collect per month
        </label>
        <span className="min-w-20 text-right font-mono text-lg font-bold tabular-nums text-brand-600 dark:text-brand-300">
          {volume.toLocaleString()}
        </span>
      </div>
      <input
        id="volume-slider"
        type="range"
        min={MIN_VOLUME}
        max={MAX_VOLUME}
        step={25}
        value={volume}
        onChange={(event) => setVolume(Number(event.target.value))}
        className="mt-2 w-full accent-primary"
      />
      <div className="flex justify-between text-[10px] text-muted-foreground/70">
        <span>{MIN_VOLUME}</span>
        <span>500</span>
        <span>{MAX_VOLUME.toLocaleString()}</span>
      </div>

      <div className="mt-6 flex h-56 items-end justify-around gap-3 sm:gap-6">
        {bars.map((bar) => (
          <div
            key={bar.name}
            className="flex h-full w-full max-w-28 flex-col items-center justify-end gap-2"
          >
            <span
              className={
                bar.us
                  ? "min-w-16 text-center font-mono text-lg font-extrabold tabular-nums text-brand-600 dark:text-brand-300"
                  : "min-w-16 text-center font-mono text-sm font-semibold tabular-nums text-muted-foreground"
              }
            >
              {bar.cost === null ? "Not verified" : `$${Math.round(bar.cost)}`}
              {bar.cost !== null && <span className="text-[10px] font-normal">/mo</span>}
            </span>
            <div
              className={
                bar.us
                  ? "w-full rounded-t-lg bg-gradient-to-t from-brand-600 to-brand-500 shadow-pop transition-[height] duration-300 ease-out"
                  : "w-full rounded-t-lg bg-muted-foreground/20 transition-[height] duration-300 ease-out"
              }
              style={{
                height: `${Math.max(4, Math.round(((bar.cost ?? 0) / CHART_MAX) * 82))}%`,
              }}
            />
            <span
              className={`truncate text-xs ${bar.us ? "font-bold" : "text-muted-foreground"}`}
            >
              {bar.name}
            </span>
          </div>
        ))}
      </div>

      <div
        className="mt-5 flex min-h-11 items-center justify-center rounded-lg bg-success/10 px-4 text-center text-sm font-semibold text-success"
        aria-live="polite"
      >
        {yearlyDifferences.length === 0 ? <span>No verified comparison is available at this volume.</span> : maxYearlyDifference > 0 ? (
          <span>
            That&apos;s{" "}
            <span className="font-mono tabular-nums">
              {minYearlyDifference === maxYearlyDifference
                ? `$${maxYearlyDifference.toLocaleString()}`
                : `$${minYearlyDifference.toLocaleString()}–$${maxYearlyDifference.toLocaleString()}`}
            </span>{" "}
            less over 12 months at the selected monthly rates.
          </span>
        ) : (
          <span>
            At this volume, the published entry plans shown match our monthly
            price.
          </span>
        )}
      </div>

      <p className="mt-3 text-center text-xs">{SMARTWAIVER_PRICING_NOTICE} Announced on September 8, 2026. Effective from October 8, 2026 at the applicable billing date. Enterprise is unaffected.</p>
      <p className="mt-3 text-center text-[11px] text-muted-foreground/70">
        Uses the lowest published monthly plan that covers this volume; no
        interpolation. Excludes annual discounts, taxes, add-ons, overages, and
        feature differences. Checked on {COMPETITOR_PRICING_CHECKED_ON}. {APP.name}
        is ${OUR_PRICE}/month at any volume.
      </p>
    </div>
  );
}
