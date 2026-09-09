import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { isPlatformAdmin } from "@/lib/admin";
import { AppShell } from "@/components/app-shell";
import type { NotificationItem } from "@/components/notifications-menu";
import { APP } from "@/lib/config";
import { businessNameMissing } from "@/lib/types";
import { hasAppAccess } from "@/lib/billing-access";
import { daysLeftUntil } from "@/lib/dates";

/** ISO timestamp N days ago. Module scope so the impure time read stays out of render. */
function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

// The whole authenticated app is private — never index any dashboard route.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) throw new Error("Authenticated session lookup failed.");
  if (!user) redirect("/login");

  await ensureBootstrapped(user);

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (profileError || !profile) {
    throw new Error("Authenticated profile lookup failed.");
  }

  const [orgResult, subscriptionResult, flaggedResult] =
    await Promise.all([
      admin.from("organizations").select("name").eq("id", profile.org_id).single(),
      admin
        .from("subscriptions")
        .select("status, trial_ends_at")
        .eq("org_id", profile.org_id)
        .maybeSingle(),
      admin
        .from("signed_waivers")
        .select("id", { count: "exact", head: true })
        .eq("org_id", profile.org_id)
        .eq("flagged", true)
        .gte("signed_at", daysAgoIso(14)),
    ]);
  if (
    orgResult.error ||
    !orgResult.data ||
    subscriptionResult.error ||
    flaggedResult.error
  ) {
    throw new Error("Authenticated application shell data lookup failed.");
  }
  const org = orgResult.data;
  const subscription = subscriptionResult.data;
  const flaggedCount = flaggedResult.count;

  // Profile-completion gate: no business name yet (missing, or the email
  // placeholder from OAuth bootstrap) → finish setup first. /onboarding lives
  // outside this layout, so this can't loop.
  if (businessNameMissing(org?.name, user.email)) redirect("/onboarding");

  // Header notifications — real signals only (no decorative badges).
  const notifications: NotificationItem[] = [];
  if (subscription?.status === "trialing" && subscription.trial_ends_at) {
    const daysLeft = daysLeftUntil(subscription.trial_ends_at);
    if (daysLeft <= 5) {
      notifications.push({
        id: "trial",
        title:
          daysLeft <= 0
            ? "Your free trial has ended"
            : `Trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
        description:
          daysLeft <= 0
            ? "Upgrade to resume collecting signatures."
            : "Upgrade to keep collecting signatures.",
        href: "/settings/billing",
      });
    }
  }
  if (!hasAppAccess(subscription) && subscription?.status !== "trialing") {
    notifications.push({
      id: "subscription-expired",
      title: subscription?.status === "past_due" ? "Your subscription payment is overdue" : "Your subscription has ended",
      description: "Renew your plan to restore access to your workspace.",
      href: "/settings/billing",
    });
  }
  if ((flaggedCount ?? 0) > 0) {
    notifications.push({
      id: "flagged",
      title: `${flaggedCount} flagged signature${flaggedCount === 1 ? "" : "s"}`,
      description: "A screening answer needs your review.",
      href: "/signatures?flagged=1",
    });
  }

  return (
    <AppShell
      email={user.email ?? ""}
      orgName={org?.name ?? APP.name}
      isAdmin={isPlatformAdmin(user.email)}
      notifications={notifications}
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

  if (!hasAppAccess({ status: status ?? "", trial_ends_at: trialEndsAt })) {
    return (
      <TrialPill expired>
        <span>{status === "trialing" ? "Your trial has expired." : status === "past_due" ? "Your payment is overdue." : "Your plan has expired."}</span>
        <Link href="/settings/billing" className="font-medium underline underline-offset-2 hover:opacity-80">{status === "trialing" ? "Subscribe" : "Renew plan"}</Link>
      </TrialPill>
    );
  }

  if (status === "trialing" && trialEndsAt) {
    const daysLeft = daysLeftUntil(trialEndsAt);
    return (
      <TrialPill>
        <span>
          <strong className="font-semibold">
            {daysLeft} day{daysLeft === 1 ? "" : "s"}
          </strong>{" "}
          left in your trial.
        </span>
        <Link
          href="/settings/billing"
          className="font-semibold underline underline-offset-2 hover:opacity-80"
        >
          Upgrade · ${APP.priceMonthlyUsd}/mo
        </Link>
      </TrialPill>
    );
  }

  return null;
}

/**
 * Compact centered "reminder" pill (amber, warning icon, inline link) — the
 * shared shell for the trial / past-due notices.
 */
function TrialPill({ children, expired = false }: { children: React.ReactNode; expired?: boolean }) {
  return (
    <div className="flex w-full min-w-0 justify-center">
      <div className={`inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-xs leading-5 ${expired ? "border-red-200/80 bg-red-50 text-slate-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100" : "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"}`}>
        {expired ? <AlertTriangle className="size-3.5 shrink-0 text-red-600 dark:text-red-400" aria-hidden /> : <AlertCircle className="size-3.5 shrink-0" aria-hidden />}
        <div className="flex min-w-0 flex-wrap items-center justify-center gap-x-1.5 text-center [&>a]:rounded-sm [&>a]:focus-visible:outline-2 [&>a]:focus-visible:outline-offset-2">{children}</div>
      </div>
    </div>
  );
}
