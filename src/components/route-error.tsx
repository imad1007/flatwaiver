"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route failed", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg items-center px-6 py-12">
      <div role="alert" className="w-full rounded-2xl border border-destructive/30 bg-card p-6 shadow-card">
        <AlertTriangle aria-hidden className="size-6 text-destructive" />
        <h1 className="mt-4 text-xl font-bold">We couldn&apos;t load this page</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your data was not changed. This is often temporary—try again, or return
          to the dashboard.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            Reference: {error.digest}
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          <Button type="button" onClick={reset}>Try again</Button>
          <Button variant="outline" render={<Link href="/dashboard">Dashboard</Link>} />
        </div>
      </div>
    </main>
  );
}
