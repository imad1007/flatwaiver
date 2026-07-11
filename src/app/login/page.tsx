"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { APP } from "@/lib/config";
import { Logo } from "@/components/logo";
import { AuthDivider, GoogleAuthButton } from "@/components/google-auth-button";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";

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
      router.push(next);
      router.refresh();
    } else {
      const { error: err } = await supabase.auth.signInWithOtp({
        email,
        options: {
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
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <Link href="/" aria-label={`${APP.name} home`} className="inline-block">
          <Logo />
        </Link>
        <div className="mt-8 rounded-xl border border-border p-8">
          <h1 className="text-2xl font-bold">Log in</h1>

          <div className="mt-6">
            <GoogleAuthButton next={next} />
          </div>
          <AuthDivider />

          <div className="flex rounded-md border border-border p-1 text-sm">
            <button
              type="button"
              onClick={() => setMode("password")}
              className={`flex-1 rounded px-3 py-1.5 ${mode === "password" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => setMode("magic")}
              className={`flex-1 rounded px-3 py-1.5 ${mode === "magic" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Magic link
            </button>
          </div>

          {magicSent ? (
            <p className="mt-6 text-muted-foreground">
              Check your email — we sent a sign-in link to <strong>{email}</strong>.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-foreground/90">
                  Email
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-input px-3 py-2 focus:border-ring focus:outline-none"
                />
              </label>

              {mode === "password" && (
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-foreground/90">
                    Password
                  </span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-md border border-input px-3 py-2 focus:border-ring focus:outline-none"
                  />
                </label>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-md bg-primary px-4 py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {submitting
                  ? "Signing in…"
                  : mode === "password"
                    ? "Log in"
                    : "Send magic link"}
              </button>
            </form>
          )}

          <p className="mt-6 text-sm text-muted-foreground">
            New here?{" "}
            <Link href="/signup" className="underline">
              Start your free trial
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
