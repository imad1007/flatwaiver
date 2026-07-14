import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { businessNameMissing } from "@/lib/types";
import { OnboardingForm } from "@/components/onboarding-form";
import { Logo } from "@/components/logo";
import { APP } from "@/lib/config";

export const metadata: Metadata = {
  title: `Finish setting up — ${APP.name}`,
  robots: { index: false, follow: false },
};

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Idempotent — guarantees the org/profile exist even if the user landed here
  // directly (first request never hit the (app) layout).
  await ensureBootstrapped(user);

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  const { data: org } = profile
    ? await admin
        .from("organizations")
        .select("name")
        .eq("id", profile.org_id)
        .single()
    : { data: null };

  // Already has a real business name → never show this screen.
  if (!businessNameMissing(org?.name, user.email)) redirect("/dashboard");

  // Greet with the Google-provided personal name when we have one (email
  // signups won't) so it doesn't feel like starting from zero.
  const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string };
  const firstName = (meta.full_name || meta.name || "").trim().split(/\s+/)[0] || null;

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <Link href="/" aria-label={`${APP.name} home`} className="inline-block">
          <Logo />
        </Link>
        <div className="mt-8 rounded-xl border border-border p-8">
          <h1 className="text-2xl font-bold">
            {firstName ? `Welcome, ${firstName}!` : "Welcome!"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            One quick thing before your dashboard — what&apos;s your business name?
            It appears on your waivers.
          </p>
          <OnboardingForm />
        </div>
      </div>
    </main>
  );
}
