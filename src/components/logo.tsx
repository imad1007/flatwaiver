import { APP } from "@/lib/config";
import { cn } from "@/lib/utils";

/**
 * Brand mark: filled shield in the primary color with a white check.
 * Mirrors src/app/icon.svg (the favicon) — keep the two in sync.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("text-primary", className)}
    >
      <path
        d="M7 3.4h10c1 0 1.8.8 1.8 1.8v6.1c0 4.6-2.7 7.7-6.2 9.6-.4.2-.8.2-1.2 0-3.5-1.9-6.2-5-6.2-9.6V5.2c0-1 .8-1.8 1.8-1.8Z"
        fill="currentColor"
      />
      <path
        d="m8.6 11.9 2.3 2.3 4.6-4.8"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Primary lockup: shield mark + two-tone wordmark ("Flat" in ink, "Waiver"
 * in the primary color). Splits APP.name on its camel-case boundary so the
 * name still lives only in src/lib/config.ts.
 */
export function Logo({
  className,
  markClassName,
  wordmarkClassName,
}: {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
}) {
  const split = /^([A-Z][a-z]+)([A-Z].+)$/.exec(APP.name);
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={cn("size-7 shrink-0", markClassName)} />
      <span className={cn("text-lg font-bold tracking-tight", wordmarkClassName)}>
        {split ? (
          <>
            {split[1]}
            <span className="text-primary">{split[2]}</span>
          </>
        ) : (
          APP.name
        )}
      </span>
    </span>
  );
}
