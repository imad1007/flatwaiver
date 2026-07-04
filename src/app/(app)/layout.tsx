import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { SignOutButton } from "@/components/sign-out-button";
import { APP } from "@/lib/config";
import { subscriptionIsUsable } from "@/lib/types";
import { daysLeftUntil } from "@/lib/dates";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/waivers", label: "Waivers" },
  { href: "/signatures", label: "Signatures" },
  { href: "/settings/billing", label: "Billing" },
];

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

  // Read via admin after bootstrap (the anon-client session already proves
  // identity; profile scoping is by user id / org id).
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  const { data: subscription } = profile
    ? await admin
        .from("subscriptions")
        .select("status, trial_ends_at")
        .eq("org_id", profile.org_id)
        .maybeSingle()
    : { data: null };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="font-bold tracking-tight">
              {APP.name}
            </Link>
            <nav className="flex items-center gap-5 text-sm">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-neutral-600 hover:text-neutral-900"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-neutral-400 sm:inline">
              {user.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <TrialBanner
        status={subscription?.status ?? null}
        trialEndsAt={subscription?.trial_ends_at ?? null}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
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
      <div className="bg-blue-50 text-blue-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-2 text-sm">
          <span>
            Free trial — <strong>{daysLeft} day{daysLeft === 1 ? "" : "s"}</strong>{" "}
            remaining.
          </span>
          <Link href="/settings/billing" className="font-semibold underline">
            Subscribe for ${APP.priceMonthlyUsd}/mo
          </Link>
        </div>
      </div>
    );
  }

  if (!subscriptionIsUsable(status)) {
    return (
      <div className="bg-amber-50 text-amber-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-2 text-sm">
          <span>
            Your subscription is{" "}
            <strong>{status === "past_due" ? "past due" : "inactive"}</strong>. New
            signatures are paused — your existing waivers remain fully accessible.
          </span>
          <Link href="/settings/billing" className="font-semibold underline">
            Fix billing
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
