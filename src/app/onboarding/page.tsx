import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { businessNameMissing } from "@/lib/types";
import { OnboardingWizard } from "@/components/onboarding-wizard";
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
        .select("name, branding")
        .eq("id", profile.org_id)
        .single()
    : { data: null };

  // Already has a real business name → never show this screen.
  if (!businessNameMissing(org?.name, user.email)) redirect("/dashboard");

  // Greet with the Google-provided personal name when we have one (email
  // signups won't), and use it to pre-fill a sensible default org name.
  const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string };
  const fullName = (meta.full_name || meta.name || "").trim();
  const firstName = fullName.split(/\s+/)[0] || null;
  const defaultBusinessName = fullName ? `${fullName}'s Organization` : "My Organization";

  const branding = (org?.branding ?? null) as { color?: string } | null;
  const defaultColor = branding?.color ?? "#4F46E5";

  return (
    <main className="flex flex-1 justify-center px-6 py-12">
      <div className="w-full max-w-3xl">
        <Link href="/" aria-label={`${APP.name} home`} className="inline-block">
          <Logo />
        </Link>
        <div className="mt-8 rounded-2xl border border-border bg-card/40 p-6 shadow-card sm:p-8">
          <OnboardingWizard
            firstName={firstName}
            defaultBusinessName={defaultBusinessName}
            defaultColor={defaultColor}
          />
        </div>
      </div>
    </main>
  );
}
