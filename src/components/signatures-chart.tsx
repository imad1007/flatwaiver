"use client";

import { useState } from "react";

export interface DayCount {
  /** ISO date (yyyy-mm-dd, UTC). */
  date: string;
  count: number;
}

const H = 160; // plot height
const BAR_GAP = 2;

/**
 * 30-day signatures bar chart. Single series in the brand color; grid and
 * labels stay on text/border tokens. Hover any bar for the exact day + count.
 */
export function SignaturesChart({ days }: { days: DayCount[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(1, ...days.map((d) => d.count));
  // Nice y-axis top: 1/2/5 × 10^n ≥ max
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const top = [1, 2, 5, 10].map((m) => m * pow).find((v) => v >= max) ?? max;
  const gridLines = [top, top / 2];

  const n = days.length;
  const w = 100 / n; // percentage-based x layout
  const peak = days.reduce((best, d, i) => (d.count > days[best].count ? i : best), 0);

  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });

  return (
    <div className="relative">
      <div className="flex h-[200px] gap-3">
        {/* y-axis labels */}
        <div className="relative w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground/70">
          {gridLines.map((v) => (
            <span
              key={v}
              className="absolute right-0 -translate-y-1/2"
              style={{ top: `${(1 - v / top) * H + 12}px` }}
            >
              {v}
            </span>
          ))}
          <span className="absolute right-0 -translate-y-1/2" style={{ top: `${H + 12}px` }}>
            0
          </span>
        </div>

        {/* plot */}
        <div className="relative min-w-0 flex-1">
          <svg
            viewBox={`0 0 100 ${H + 24}`}
            preserveAspectRatio="none"
            className="h-full w-full"
            role="img"
            aria-label="Signatures per day over the last 30 days"
          >
            {/* gridlines */}
            {gridLines.map((v) => (
              <line
                key={v}
                x1="0"
                x2="100"
                y1={(1 - v / top) * H + 12}
                y2={(1 - v / top) * H + 12}
                className="stroke-border"
                strokeWidth="0.5"
                vectorEffect="non-scaling-stroke"
                strokeDasharray="2 3"
              />
            ))}
            {/* baseline */}
            <line
              x1="0"
              x2="100"
              y1={H + 12}
              y2={H + 12}
              className="stroke-border"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            {/* bars */}
            {days.map((d, i) => {
              const h = (d.count / top) * H;
              return (
                <rect
                  key={d.date}
                  x={i * w + BAR_GAP / 2}
                  width={Math.max(0.5, w - BAR_GAP)}
                  y={H + 12 - h}
                  height={Math.max(d.count > 0 ? 1 : 0, h)}
                  rx={0.6}
                  className={
                    hover === null || hover === i
                      ? "fill-primary"
                      : "fill-primary opacity-45"
                  }
                />
              );
            })}
            {/* hover hit targets (full column height, bigger than the mark) */}
            {days.map((d, i) => (
              <rect
                key={`hit-${d.date}`}
                x={i * w}
                width={w}
                y="0"
                height={H + 24}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            ))}
          </svg>

          {/* peak direct label (selective — only the max, only when nonzero) */}
          {days[peak].count > 0 && hover === null && (
            <span
              className="pointer-events-none absolute -translate-x-1/2 font-mono text-[10px] font-semibold tabular-nums text-foreground/80"
              style={{
                left: `${(peak + 0.5) * w}%`,
                top: `${(1 - days[peak].count / top) * H - 4}px`,
              }}
            >
              {days[peak].count}
            </span>
          )}

          {/* tooltip */}
          {hover !== null && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md"
              style={{
                left: `${Math.min(92, Math.max(8, (hover + 0.5) * w))}%`,
                top: "-4px",
              }}
            >
              <span className="font-medium">{fmt(days[hover].date)}</span>
              <span className="ml-2 font-mono tabular-nums text-muted-foreground">
                {days[hover].count} signature{days[hover].count === 1 ? "" : "s"}
              </span>
            </div>
          )}

          {/* x-axis: first / middle / last date */}
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground/70">
            <span>{fmt(days[0].date)}</span>
            <span>{fmt(days[Math.floor(n / 2)].date)}</span>
            <span>{fmt(days[n - 1].date)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
