"use client";

import { useState } from "react";
import { APP } from "@/lib/config";

/**
 * Interactive comparison: drag the volume slider, competitor estimates move,
 * our $39 bar stays flat. Estimates are linear interpolations between each
 * competitor's published entry price and their published cost at 1,000
 * waivers/month, capped at their top listed plan price — labeled as
 * estimates, sourced from public pricing pages (July 2026).
 *
 * Layout-shift safe: the chart lives in a fixed-height container, bars
 * animate `height` inside it, and all numbers use tabular figures inside
 * fixed-min-width slots.
 */

interface Competitor {
  name: string;
  /** Published entry price (lowest tier). */
  entry: number;
  /** Published cost at 1,000 waivers/month. */
  atThousand: number;
  /** Top listed plan price (cap). */
  cap: number;
}

const COMPETITORS: Competitor[] = [
  { name: "Smartwaiver", entry: 19, atThousand: 155, cap: 155 },
  { name: "WaiverForever", entry: 19.99, atThousand: 129, cap: 129 },
  { name: "WaiverFile", entry: 15, atThousand: 104, cap: 199 },
];

const OUR_PRICE = APP.priceMonthlyUsd;
const MIN_VOLUME = 100;
const MAX_VOLUME = 3000;
const CHART_MAX = 210; // y-axis ceiling for bar heights

function estimate(c: Competitor, volume: number): number {
  const slope = (c.atThousand - c.entry) / 1000;
  return Math.min(c.cap, c.entry + slope * volume);
}

export function SavingsCalculator() {
  const [volume, setVolume] = useState(1000);

  const estimates = COMPETITORS.map((c) => ({
    name: c.name,
    cost: estimate(c, volume),
  }));
  const priciest = Math.max(...estimates.map((e) => e.cost));
  const yearlySavings = Math.max(0, Math.round((priciest - OUR_PRICE) * 12));

  const bars = [
    ...estimates.map((e) => ({ ...e, us: false })),
    { name: APP.name, cost: OUR_PRICE, us: true },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
      {/* Volume slider */}
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
        step={50}
        value={volume}
        onChange={(e) => setVolume(Number(e.target.value))}
        className="mt-2 w-full accent-primary"
      />
      <div className="flex justify-between text-[10px] text-muted-foreground/70">
        <span>{MIN_VOLUME}</span>
        <span>1,000</span>
        <span>{MAX_VOLUME.toLocaleString()}</span>
      </div>

      {/* Bars */}
      <div className="mt-6 flex h-56 items-end justify-around gap-4">
        {bars.map((bar) => (
          <div
            key={bar.name}
            className="flex h-full w-full max-w-24 flex-col items-center justify-end gap-2"
          >
            <span
              className={
                bar.us
                  ? "min-w-16 text-center font-mono text-lg font-extrabold tabular-nums text-brand-600 dark:text-brand-300"
                  : "min-w-16 text-center font-mono text-sm font-semibold tabular-nums text-muted-foreground"
              }
            >
              ${Math.round(bar.cost)}
              <span className="text-[10px] font-normal">/mo</span>
            </span>
            <div
              className={
                bar.us
                  ? "w-full rounded-t-lg bg-gradient-to-t from-brand-600 to-brand-500 shadow-pop transition-[height] duration-300 ease-out"
                  : "w-full rounded-t-lg bg-muted-foreground/20 transition-[height] duration-300 ease-out"
              }
              style={{
                height: `${Math.max(4, Math.round((bar.cost / CHART_MAX) * 82))}%`,
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

      {/* Savings line — fixed height so the text swap never shifts layout */}
      <div className="mt-5 flex min-h-11 items-center justify-center rounded-lg bg-success/10 px-4 text-center text-sm font-semibold text-success">
        {yearlySavings > 0 ? (
          <span>
            That&apos;s{" "}
            <span className="font-mono tabular-nums">
              ${yearlySavings.toLocaleString()}
            </span>{" "}
            back in your pocket every year vs. the priciest option.
          </span>
        ) : (
          <span>
            At low volume we&apos;re not the cheapest — we&apos;re built for
            businesses that sign a lot of waivers.
          </span>
        )}
      </div>

      <p className="mt-3 text-center text-[11px] text-muted-foreground/70">
        Competitor costs are estimates interpolated from public pricing pages,
        July 2026. {APP.name} is ${OUR_PRICE}/month at any volume.
      </p>
    </div>
  );
}
