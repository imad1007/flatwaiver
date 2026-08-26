"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setPhotoMode } from "@/app/(app)/waivers/actions";
import type { PhotoMode } from "@/lib/types";

const OPTIONS: { value: PhotoMode; label: string }[] = [
  { value: "off", label: "No photo" },
  { value: "optional", label: "Optional photo" },
  { value: "required", label: "Require a photo" },
];

export function WaiverPhotoSetting({
  templateId,
  photoMode,
}: {
  templateId: string;
  photoMode: PhotoMode;
}) {
  const [value, setValue] = useState<PhotoMode>(photoMode);
  const [saved, setSaved] = useState<PhotoMode>(photoMode);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      try {
        await setPhotoMode(templateId, value);
        setSaved(value);
        toast.success("Photo setting saved");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't save.");
      }
    });
  }

  return (
    <section className="rounded-xl border border-border p-5">
      <h2 className="font-bold">Photo / ID capture</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Ask signers to add a photo (a selfie or a photo ID) at signing. Captured
        photos are stored privately with the signature as identity evidence.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={value}
          onChange={(e) => setValue(e.target.value as PhotoMode)}
          aria-label="Photo capture policy"
          className="rounded-md border border-input bg-card px-3 py-2 text-sm focus:border-ring focus:outline-none"
        >
          {OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
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
