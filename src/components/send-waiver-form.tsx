"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { sendSigningLink } from "@/app/(app)/waivers/actions";
import { Button } from "@/components/ui/button";

/** Share page: email a customer the signing link directly. */
export function SendWaiverForm({ templateId }: { templateId: string }) {
  const [email, setEmail] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const to = email.trim();
    if (!to) return;
    startTransition(async () => {
      try {
        await sendSigningLink(templateId, to);
        toast.success(`Signing link sent to ${to}`);
        setEmail("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't send the email.");
      }
    });
  }

  return (
    <div className="mt-6 rounded-xl border border-border p-5">
      <h2 className="font-bold">Email it to a signer</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Sends the signing link straight to their inbox — handy for bookings and
        customers who struggle with QR codes.
      </p>
      <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="customer@example.com"
          aria-label="Signer email address"
          className="min-w-56 flex-1 rounded-md border border-input bg-card px-3 py-2 text-sm focus:border-ring focus:outline-none"
        />
        <Button type="submit" disabled={isPending}>
          <Send className="size-4" />
          {isPending ? "Sending…" : "Send link"}
        </Button>
      </form>
    </div>
  );
}
