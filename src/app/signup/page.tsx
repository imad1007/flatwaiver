"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fireSignupConversion } from "@/components/signup-conversion";
import { APP } from "@/lib/config";
import { Logo } from "@/components/logo";

const VOLUME_BANDS = ["<100", "100-300", "300-1000", "1000+"] as const;
const VOLUME_LABELS: Record<string, string> = {
  "<100": "Fewer than 100",
  "100-300": "100 – 300",
  "300-1000": "300 – 1,000",
  "1000+": "More than 1,000",
};

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [volumeBand, setVolumeBand] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmEmailSent, setConfirmEmailSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!volumeBand) {
      setError("Please select your monthly waiver volume.");
      return;
    }
    setSubmitting(true);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          business_name: businessName,
          waiver_volume_band: volumeBand,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setSubmitting(false);
      return;
    }

    fireSignupConversion();

    if (data.session) {
      router.push("/dashboard");
      router.refresh();
    } else {
      // Email confirmation required by project settings.
      setConfirmEmailSent(true);
      setSubmitting(false);
    }
  }

  if (confirmEmailSent) {
    return (
      <AuthShell>
        <h1 className="text-2xl font-bold">Check your email</h1>
        <p className="mt-4 text-muted-foreground">
          We sent a confirmation link to <strong>{email}</strong>. Click it to
          activate your account and start your free trial.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="text-2xl font-bold">Start your free {APP.trialDays}-day trial</h1>
      <p className="mt-2 text-sm text-muted-foreground">No credit card required.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <Field label="Business name">
          <input
            type="text"
            required
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className={inputClass}
            placeholder="Summit Climbing Gym"
          />
        </Field>

        <Field label="How many waivers do you collect per month?">
          <select
            required
            value={volumeBand}
            onChange={(e) => setVolumeBand(e.target.value)}
            className={inputClass}
          >
            <option value="" disabled>
              Select…
            </option>
            {VOLUME_BANDS.map((band) => (
              <option key={band} value={band}>
                {VOLUME_LABELS[band]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Email">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="you@business.com"
          />
        </Field>

        <Field label="Password">
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            placeholder="At least 8 characters"
          />
        </Field>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-primary px-4 py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Log in
        </Link>
      </p>
      <p className="mt-4 text-xs text-muted-foreground/70">
        By signing up you agree to our{" "}
        <Link href="/terms" className="underline">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline">
          Privacy Policy
        </Link>
        .
      </p>
    </AuthShell>
  );
}

const inputClass =
  "w-full rounded-md border border-input px-3 py-2 focus:border-ring focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-foreground/90">{label}</span>
      {children}
    </label>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <Link href="/" aria-label={`${APP.name} home`} className="inline-block">
          <Logo />
        </Link>
        <div className="mt-8 rounded-xl border border-border p-8">{children}</div>
      </div>
    </main>
  );
}
