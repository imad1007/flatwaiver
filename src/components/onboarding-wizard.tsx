"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { completeOnboarding } from "@/app/onboarding/actions";
import {
  SPECIAL_STARTERS,
  STARTER_TEMPLATES,
} from "@/lib/starter-templates";

const PRESET_COLORS = [
  "#1F2937", // slate
  "#4F46E5", // indigo (default)
  "#0891B2", // cyan
  "#059669", // emerald
  "#D97706", // amber
  "#7C3AED", // violet
  "#DC2626", // red
];

const HEX = /^#[0-9a-fA-F]{6}$/;

type Choice = { id: string; name: string; category: string; icon: LucideIcon };

const CHOICES: Choice[] = [
  ...STARTER_TEMPLATES.map((s) => ({
    id: s.id,
    name: s.name,
    category: s.category,
    icon: s.icon,
  })),
  ...SPECIAL_STARTERS.map((s) => ({
    id: s.id,
    name: s.name,
    category: s.category,
    icon: s.icon,
  })),
];

export function OnboardingWizard({
  firstName,
  defaultBusinessName,
  defaultColor,
}: {
  firstName: string | null;
  defaultBusinessName: string;
  defaultColor: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState(defaultBusinessName);
  const [color, setColor] = useState(defaultColor);

  const effectiveColor = HEX.test(color) ? color : "#4F46E5";

  function finish(starterId: string, name: string) {
    startTransition(async () => {
      const res = await completeOnboarding({ businessName: name, color, starterId });
      if (res.ok) {
        router.push(res.redirectTo);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="w-full">
      {/* Progress header */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Step {step} of 2 ·{" "}
          <span className="text-primary">{step === 1 ? "Onboarding" : "Brand"}</span>
        </p>
        {step === 1 && (
          <button
            type="button"
            onClick={() => finish("skip", businessName)}
            disabled={pending}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            Skip onboarding →
          </button>
        )}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <span className="h-1 rounded-full bg-primary" />
        <span className={cn("h-1 rounded-full", step === 2 ? "bg-primary" : "bg-border")} />
      </div>

      {step === 1 ? (
        <div className="mt-8">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {firstName ? `Welcome, ${firstName} — ` : ""}let&apos;s get you collecting waivers.
          </h1>
          <p className="mt-2 text-muted-foreground">
            Pick a starter template — you can edit every word later. We&apos;ll set
            up the rest in a couple of clicks.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {CHOICES.map((choice) => {
              const active = selected === choice.id;
              return (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => setSelected(choice.id)}
                  className={cn(
                    "group relative flex items-start gap-3 rounded-xl border p-4 text-left transition-all",
                    active
                      ? "border-primary bg-accent/60 ring-1 ring-primary"
                      : "border-border bg-card hover:border-ring/50 hover:shadow-card"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-accent text-brand-600 dark:text-brand-300"
                    )}
                  >
                    <choice.icon className="size-4.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold leading-tight">{choice.name}</span>
                    <span className="mt-0.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {choice.category}
                    </span>
                  </span>
                  {active && (
                    <Check className="absolute right-3 top-3 size-4 text-primary" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-8 flex justify-end">
            <Button
              size="lg"
              disabled={!selected || pending}
              onClick={() => setStep(2)}
              className="gap-1.5"
            >
              Continue
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-8">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Make it look like you.
          </h1>
          <p className="mt-2 text-muted-foreground">
            Just enough so customers know they&apos;re in the right place. You can
            change this any time.
          </p>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            {/* Controls */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Business name
                </span>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Acme Climbing Gym"
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
                <span className="mt-1 block text-xs text-muted-foreground">
                  Shown to signers on every waiver and email.
                </span>
              </label>

              <div className="mt-6">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Accent color
                </span>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {PRESET_COLORS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setColor(preset)}
                      aria-label={`Use ${preset}`}
                      className={cn(
                        "size-8 rounded-full border-2 transition-transform hover:scale-110",
                        color.toUpperCase() === preset ? "border-foreground" : "border-transparent"
                      )}
                      style={{ backgroundColor: preset }}
                    />
                  ))}
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-24 rounded-md border border-input bg-background px-2.5 py-1.5 font-mono text-xs focus:border-ring focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Live preview */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <span className="size-2 rounded-full bg-success" />
                Live preview
              </p>
              <div className="mt-4 rounded-xl border border-border bg-background p-5">
                <div className="flex items-center gap-2">
                  <span
                    className="size-6 shrink-0 rounded"
                    style={{ backgroundColor: effectiveColor }}
                  />
                  <span className="truncate font-semibold">
                    {businessName.trim() || "Your Organization"}
                  </span>
                </div>
                <p className="mt-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Liability Waiver
                </p>
                <h3 className="mt-1 text-lg font-bold leading-tight">
                  Sign before you participate
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  By signing, you acknowledge the inherent risks of the activity
                  and release the organization from liability claims arising from
                  your participation…
                </p>
                <span
                  className="mt-4 inline-flex rounded-md px-4 py-2 text-sm font-semibold text-white"
                  style={{ backgroundColor: effectiveColor }}
                >
                  Sign waiver →
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between">
            <Button
              variant="outline"
              size="lg"
              onClick={() => setStep(1)}
              disabled={pending}
              className="gap-1.5"
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
            <Button
              size="lg"
              disabled={pending || businessName.trim().length < 2}
              onClick={() => finish(selected ?? "blank", businessName)}
              className="gap-1.5"
            >
              {pending
                ? "Setting up…"
                : selected === "upload"
                  ? "Continue"
                  : "Open editor"}
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
