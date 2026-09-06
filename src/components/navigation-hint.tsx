"use client";

import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";

/** Reserve space so pending feedback never shifts the navigation label. */
export function NavigationHint() {
  const { pending } = useLinkStatus();
  return (
    <span className="ml-auto inline-flex size-4 shrink-0 items-center justify-center" role={pending ? "status" : undefined}>
      {pending && <><Loader2 aria-hidden className="size-3.5 motion-safe:animate-spin" /><span className="sr-only">Loading page</span></>}
    </span>
  );
}
