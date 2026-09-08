"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function BillingExpiryDialog({ title, canManage }: { title: string; canManage: boolean }) {
  const [open, setOpen] = useState(true);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-6 sm:max-w-md">
        <div className="w-fit rounded-xl bg-destructive/10 p-3 text-destructive">
          <AlertCircle className="size-6" aria-hidden />
        </div>
        <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
        <DialogDescription className="leading-6">
          {canManage
            ? "Your workspace is paused. Subscribe or renew your plan to restore access. Your saved waivers remain securely stored."
            : "Your workspace is paused. Ask your account owner or admin to renew the subscription and restore access."}
        </DialogDescription>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground hover:bg-primary/90">
          {canManage ? "Review billing options" : "Understood"}
        </button>
      </DialogContent>
    </Dialog>
  );
}
