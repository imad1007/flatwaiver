import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { AppShell } from "@/components/app-shell";
import { APP } from "@/lib/config";
import { businessNameMissing, subscriptionIsUsable } from "@/lib/types";
import { daysLeftUntil } from "@/lib/dates";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await ensureBootstrapped(user);

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  const [{ data: org }, { data: subscription }] = await Promise.all([
    profile
      ? admin.from("organizations").select("name").eq("id", profile.org_id).single()
      : Promise.resolve({ data: null }),
    profile
      ? admin
          .from("subscriptions")
          .select("status, trial_ends_at")
          .eq("org_id", profile.org_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Profile-completion gate: no business name yet (missing, or the email
  // placeholder from OAuth bootstrap) → finish setup first. /onboarding lives
  // outside this layout, so this can't loop.
  if (businessNameMissing(org?.name, user.email)) redirect("/onboarding");

  return (
    <AppShell
      email={user.email ?? ""}
      orgName={org?.name ?? APP.name}
      banner={
        <TrialBanner
          status={subscription?.status ?? null}
          trialEndsAt={subscription?.trial_ends_at ?? null}
        />
      }
    >
      {children}
    </AppShell>
  );
}

function TrialBanner({
  status,
  trialEndsAt,
}: {
  status: string | null;
  trialEndsAt: string | null;
}) {
  if (status === "active") return null;

  if (status === "trialing" && trialEndsAt) {
    const daysLeft = daysLeftUntil(trialEndsAt);
    return (
      <div className="border-t border-brand-200/60 bg-accent text-accent-foreground dark:border-brand-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm sm:px-6">
          <span>
            Free trial — <strong>{daysLeft} day{daysLeft === 1 ? "" : "s"}</strong>{" "}
            remaining.
          </span>
          <Link
            href="/settings/billing"
            className="font-semibold underline underline-offset-2 hover:opacity-80"
          >
            Subscribe for ${APP.priceMonthlyUsd}/mo
          </Link>
        </div>
      </div>
    );
  }

  if (!subscriptionIsUsable(status)) {
    return (
      <div className="border-t border-amber-500/30 bg-amber-500/100/10 text-amber-800 dark:text-amber-200">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm sm:px-6">
          <span>
            Your subscription is{" "}
            <strong>{status === "past_due" ? "past due" : "inactive"}</strong>. New
            signatures are paused — your existing waivers remain fully accessible.
          </span>
          <Link
            href="/settings/billing"
            className="font-semibold underline underline-offset-2 hover:opacity-80"
          >
            Fix billing
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
