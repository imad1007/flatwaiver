"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveBusinessName } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";

/** Single-field business-name capture shown right after first login. */
export function OnboardingForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Please enter your business name.");
      return;
    }
    startTransition(async () => {
      try {
        await saveBusinessName(name);
        router.push("/dashboard");
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Something went wrong. Please try again."
        );
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-foreground/90">
          Business name
        </span>
        <input
          type="text"
          required
          autoFocus
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Summit Climbing Gym"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "business-name-error" : undefined}
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
        <span className="mt-1 block text-xs text-muted-foreground/70">
          This appears on your waivers and across your dashboard.
        </span>
      </label>

      {error && (
        <p id="business-name-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? "Saving…" : "Continue to dashboard"}
      </Button>
    </form>
  );
}
