"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setWaiverExpiry } from "@/app/(app)/waivers/actions";
import { EXPIRY_OPTIONS } from "@/lib/expiry";

export function WaiverRenewalSetting({
  templateId,
  expiryMonths,
}: {
  templateId: string;
  expiryMonths: number | null;
}) {
  const [value, setValue] = useState<number | null>(expiryMonths);
  const [saved, setSaved] = useState<number | null>(expiryMonths);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      try {
        await setWaiverExpiry(templateId, value);
        setSaved(value);
        toast.success("Renewal setting saved");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't save.");
      }
    });
  }

  return (
    <section className="rounded-xl border border-border p-5">
      <h2 className="font-bold">Renewal</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        How long a signature stays valid before the signer should re-sign.
        Expiring and expired signers show up under{" "}
        <span className="font-medium">Signatures → Renewals</span>, where you can
        send re-sign reminders.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={value ?? ""}
          onChange={(e) => setValue(e.target.value ? Number(e.target.value) : null)}
          aria-label="Renewal window"
          className="rounded-md border border-input bg-card px-3 py-2 text-sm focus:border-ring focus:outline-none"
        >
          {EXPIRY_OPTIONS.map((o) => (
            <option key={o.label} value={o.value ?? ""}>
              {o.label}
            </option>
          ))}
        </select>
        <Button onClick={save} disabled={pending || value === saved}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </section>
  );
}
