import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Designed zero-data moment: layered icon medallion, one confident line,
 * and the primary next action. Never a blank table.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-card px-6 py-14 text-center shadow-card",
        className
      )}
    >
      {/* Soft backdrop glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-40 w-72 -translate-x-1/2 rounded-full bg-brand-500/10 blur-3xl"
      />

      {/* Layered icon medallion */}
      <div className="relative mx-auto w-fit" aria-hidden>
        <div className="flex size-16 rotate-3 items-center justify-center rounded-2xl border border-border bg-muted/60" />
        <div className="absolute inset-0 flex size-16 -rotate-3 items-center justify-center rounded-2xl border border-brand-200 bg-accent shadow-card dark:border-brand-800">
          <Icon className="size-7 text-brand-600 dark:text-brand-300" />
        </div>
        <Sparkles className="absolute -right-3 -top-2 size-4 text-brand-400" />
      </div>

      <h2 className="relative mt-6 text-lg font-bold">{title}</h2>
      <p className="relative mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {action && <div className="relative mt-6">{action}</div>}
    </div>
  );
}
