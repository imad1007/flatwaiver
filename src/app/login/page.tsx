"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { APP } from "@/lib/config";
import { AuthShell, authInputClass, authButtonClass } from "@/components/auth-shell";
import { AuthPassword } from "@/components/auth-password";
import { ArrowRight, Loader2, MailCheck } from "lucide-react";
import { AuthDivider, GoogleAuthButton } from "@/components/google-auth-button";
import { safeInternalPath } from "@/lib/safe-redirect";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const next = safeInternalPath(searchParams.get("next"));

  const [mode, setMode] = useState<"password" | "magic">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const supabase = createClient();

      if (mode === "password") {
        const { error: err } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (err) {
          setError(err.message);
          setSubmitting(false);
          return;
        }
        window.location.assign(`/auth/continue?next=${encodeURIComponent(next)}`);
      } else {
        const { error: err } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: false,
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (err) {
          setError(err.message);
          setSubmitting(false);
          return;
        }
        setMagicSent(true);
        setSubmitting(false);
      }
    } catch {
      setError("Could not sign in. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <p className="text-sm font-medium text-primary">Welcome back</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Log in to your workspace</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">Pick up where you left off. Everything is right here.</p>
      <div className="mt-7"><GoogleAuthButton next={next} /></div>
      <AuthDivider />
      <div className="flex gap-1 rounded-xl bg-muted p-1 text-sm" aria-label="Sign-in method">
        {(["password", "magic"] as const).map((value) => (
          <button key={value} type="button" disabled={submitting} aria-pressed={mode === value} onClick={() => { setMode(value); setMagicSent(false); setError(null); }} className={`flex-1 rounded-lg px-3 py-2.5 font-medium transition-colors disabled:opacity-50 ${mode === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{value === "password" ? "Password" : "Email me a link"}</button>
        ))}
      </div>
      {searchParams.get("error") === "auth" && <p role="alert" className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">That sign-in link could not be used. Please try again or request a new one.</p>}
      {magicSent ? (
        <div role="status" className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-6">
          <MailCheck className="size-7 text-primary" />
          <h2 className="mt-3 font-semibold">Check your inbox</h2>
          <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">If there is an account for <strong className="text-foreground">{email}</strong>, you will receive a sign-in link. Check your spam folder too.</p>
          <button type="button" className="mt-4 text-sm font-medium text-primary underline underline-offset-4" onClick={() => setMagicSent(false)}>Use a different email or try again</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-5" aria-busy={submitting}>
          <label className="block"><span className="mb-2 block text-sm font-medium">Email address</span><input name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className={authInputClass} placeholder="you@business.com" /></label>
          {mode === "password" ? <AuthPassword value={password} onChange={setPassword} /> : <p className="text-sm text-muted-foreground">We will email you a secure link so you can sign in without a password.</p>}
          {error && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          <button type="submit" disabled={submitting} className={authButtonClass}>{submitting ? <><Loader2 className="size-4 animate-spin" />{mode === "password" ? "Signing in..." : "Sending link..."}</> : <>{mode === "password" ? "Log in" : "Send sign-in link"}<ArrowRight className="size-4" /></>}</button>
          {mode === "password" && <button type="button" onClick={() => { setMode("magic"); setError(null); }} className="block w-full text-center text-xs font-medium text-muted-foreground hover:text-primary">Forgot your password? Sign in with an email link</button>}
        </form>
      )}
      <p className="mt-8 border-t pt-6 text-center text-sm text-muted-foreground">New to {APP.name}? <Link href={`/signup?next=${encodeURIComponent(next)}`} className="font-semibold text-primary hover:underline">Start your free trial</Link></p>
    </AuthShell>
  );
}
