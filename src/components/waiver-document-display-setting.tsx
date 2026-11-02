"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { setDocumentDisplay } from "@/app/(app)/waivers/actions";
import type { DocumentDisplay } from "@/lib/types";

const OPTIONS: { value: DocumentDisplay; label: string }[] = [
  { value: "full", label: "Show full document" },
  { value: "collapsed", label: 'Collapsed with "View Document"' },
];

export function WaiverDocumentDisplaySetting({
  templateId,
  documentDisplay,
}: {
  templateId: string;
  documentDisplay: DocumentDisplay;
}) {
  const [value, setValue] = useState<DocumentDisplay>(documentDisplay);
  const [pending, start] = useTransition();

  function update(next: DocumentDisplay) {
    const previous = value;
    setValue(next);
    start(async () => {
      try {
        await setDocumentDisplay(templateId, next);
        toast.success("Document display saved");
      } catch (err) {
        setValue(previous);
        toast.error(err instanceof Error ? err.message : "Couldn't save.");
      }
    });
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        Document display
        <Badge>New</Badge>
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Choose how the document appears on public links and kiosks. Saved automatically
        and applied immediately; no publishing required. The complete document remains
        available before signing. Signed PDFs are unchanged.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <select
          value={value}
          onChange={(e) => update(e.target.value as DocumentDisplay)}
          disabled={pending}
          aria-label="Document display"
          className="max-w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:border-ring focus:outline-none"
        >
          {OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span aria-live="polite" className="text-xs text-muted-foreground">{pending ? "Saving…" : "Saved automatically"}</span>
      </div>
    </section>
  );
}
