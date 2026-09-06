"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fireSignupConversion } from "@/components/signup-conversion";
import { APP } from "@/lib/config";
import { AuthShell, authInputClass, authButtonClass } from "@/components/auth-shell";
import { AuthPassword } from "@/components/auth-password";
import { ArrowRight, Loader2, MailCheck } from "lucide-react";
import { AuthDivider, GoogleAuthButton } from "@/components/google-auth-button";
import { safeInternalPath } from "@/lib/safe-redirect";

const VOLUME_BANDS = ["<100", "100-300", "300-1000", "1000+"] as const;
const VOLUME_LABELS: Record<string, string> = {
  "<100": "Fewer than 100",
  "100-300": "100 – 300",
  "300-1000": "300 – 1,000",
  "1000+": "More than 1,000",
};

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const searchParams = useSearchParams();
  const next = safeInternalPath(searchParams.get("next"));
  const invitedEmail = searchParams.get("email")?.trim() ?? "";
  const isInviteSignup = next.startsWith("/invite/") && Boolean(invitedEmail);
  const [email, setEmail] = useState(invitedEmail);
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [volumeBand, setVolumeBand] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmEmailSent, setConfirmEmailSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isInviteSignup && !volumeBand) {
      setError("Please select your monthly waiver volume.");
      return;
    }
    setSubmitting(true);

    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            business_name: businessName,
            waiver_volume_band: volumeBand,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setSubmitting(false);
        return;
      }

      fireSignupConversion();

      if (data.session) {
        window.location.assign(`/auth/continue?next=${encodeURIComponent(next)}`);
      } else {
        // Email confirmation required by project settings.
        setConfirmEmailSent(true);
        setSubmitting(false);
      }
    } catch {
      setError("Could not create your account. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  if (confirmEmailSent) {
    return (
      <AuthShell signup>
        <MailCheck className="mb-5 size-10 text-primary" />
        <h1 className="text-3xl font-semibold tracking-tight">Check your email</h1>
        <p className="mt-4 text-muted-foreground">
          We sent a confirmation link to <strong>{email}</strong>. Click it to
          activate your account
          {isInviteSignup ? " and join your team." : " and start your free trial."}
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell signup>
      <p className="mb-2 text-sm font-medium text-primary">A simpler way to welcome customers</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {isInviteSignup ? "Join your team" : `Start your free ${APP.trialDays}-day trial`}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {isInviteSignup ? `Create an account as ${invitedEmail}.` : "No credit card required."}
      </p>

      <div className="mt-6">
        <GoogleAuthButton
          label={isInviteSignup ? "Join with Google" : "Sign up with Google"}
          next={next}
          emailHint={isInviteSignup ? invitedEmail : undefined}
        />
      </div>
      <AuthDivider />

      <form onSubmit={handleSubmit} className="space-y-5" aria-busy={submitting}>
        {!isInviteSignup && (
          <>
            <Field label="Business name">
              <input
                autoComplete="organization"
                name="business_name"
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
          </>
        )}

        <Field label="Email">
          <input
            autoComplete="email"
            name="email"
            type="email"
            required
            readOnly={isInviteSignup}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${inputClass} read-only:bg-muted`}
            placeholder="you@business.com"
          />
        </Field>

        <AuthPassword value={password} onChange={setPassword} newPassword />

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className={authButtonClass}
        >
          {submitting ? <><Loader2 className="size-4 animate-spin" /> Creating account…</> : <>{isInviteSignup ? "Join your team" : "Create your account"}<ArrowRight className="size-4" /></>}
        </button>
      </form>

      <p className="mt-6 text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="font-medium text-primary hover:underline"
        >
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

const inputClass = authInputClass;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
