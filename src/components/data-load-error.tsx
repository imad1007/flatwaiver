import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function DataLoadError({
  title = "We couldn't load this data",
  description = "Nothing was changed. Try loading this page again.",
  retryHref,
  className,
}: {
  title?: string;
  description?: string;
  retryHref: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-xl border border-destructive/30 bg-destructive/5 p-6",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0 text-destructive" />
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          <Link
            href={retryHref}
            className="mt-4 inline-flex rounded-md border border-input bg-background px-3 py-2 text-sm font-semibold hover:border-ring"
          >
            Try again
          </Link>
        </div>
      </div>
    </div>
  );
}
