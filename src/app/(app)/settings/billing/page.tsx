import Link from "next/link";
import { BillingExpiryDialog } from "@/components/billing-expiry-dialog";
import { hasAppAccess } from "@/lib/billing-access";
import { Check, ShieldCheck, Sparkles, ArrowUpRight } from "lucide-react";
import { redirect } from "next/navigation";
import { BillingActivationNotice, BillingButton } from "@/components/billing-buttons";
import { DataLoadError } from "@/components/data-load-error";
import { getOrgCaller } from "@/lib/auth";
import { APP } from "@/lib/config";
import { creemConfigured } from "@/lib/creem";
import { daysLeftUntil } from "@/lib/dates";
import { canManageBilling } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import type { Subscription } from "@/lib/types";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; checkout_id?: string }>;
}) {
  const { checkout, checkout_id: checkoutId } = await searchParams;
  const caller = await getOrgCaller();
  if (!caller) redirect("/login");

  const supabase = await createClient();
  const { data, error } = await supabase.from("subscriptions").select("*").maybeSingle();
  if (error || !data) return <DataLoadError retryHref="/settings/billing" />;

  const sub = data as Subscription;
  const status = sub.status;
  const trialDaysLeft = sub.trial_ends_at ? daysLeftUntil(sub.trial_ends_at) : 0;
  const canManage = canManageBilling(caller.role);
  const checkoutConfigured = creemConfigured();
  const portalEndpoint = sub.creem_customer_id
    ? ("/api/creem/portal" as const)
    : sub.stripe_customer_id && process.env.STRIPE_SECRET_KEY
      ? ("/api/stripe/portal" as const)
      : null;

  const pending = checkout === "success" && status !== "active";
  const statusLabel = pending ? "Confirming payment" : status === "active" ? "Active" : status === "trialing" ? (trialDaysLeft > 0 ? "Free trial" : "Trial ended") : status === "past_due" ? "Payment overdue" : "Inactive";

  return (
    <div className="space-y-6">
      {!pending && !hasAppAccess(sub) && <BillingExpiryDialog canManage={canManage} title={status === "trialing" ? "Your free trial has ended" : status === "past_due" ? "Your subscription payment is overdue" : "Your subscription has ended"} />}
      {checkout === "success" && (
        <BillingActivationNotice active={status === "active"} checkoutId={checkoutId} />
      )}
      {checkout === "canceled" && (
        <div role="status" className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
          Checkout was canceled. You can return to your plan below.
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-primary/15 bg-card shadow-sm">
        <div className="border-b border-primary/10 bg-primary/5 p-6 sm:p-8">
        <div className="mb-5 flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-sm font-semibold text-primary"><Sparkles className="size-4" /> {APP.name}</span><span className="rounded-full border bg-background px-3 py-1 text-xs font-medium">{statusLabel}</span></div>
        <h2 className="text-2xl font-semibold tracking-tight">One plan. Everything included.</h2>
        <p className="mt-5 text-5xl font-semibold tracking-tight">
          ${APP.priceMonthlyUsd}
          <span className="text-base font-normal text-muted-foreground">/ month</span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Unlimited signed waivers, templates, and storage.
        </p>

        </div>
        <div className="grid gap-3 border-b px-6 py-5 sm:grid-cols-2 sm:px-8">
          {["Unlimited waivers & signatures", "QR codes & front-desk kiosk", "Signed PDF storage", "Search & export your records"].map((feature) => <p key={feature} className="flex items-center gap-2 text-sm"><Check className="size-4 shrink-0 text-primary" />{feature}</p>)}
        </div>
        <div className="p-6 sm:p-8">
          {!checkoutConfigured && status !== "active" && canManage && (
            <p className="mb-4 text-sm text-muted-foreground">
              Billing is temporarily unavailable. Please contact support for help with your plan.
            </p>
          )}

          {status === "trialing" && !pending && (
            <>
              <p className="mb-4 text-sm">
                {trialDaysLeft > 0 ? <>Your free trial has <strong>{trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} remaining</strong>.</> : <>Your free trial has ended. Subscribe to keep collecting signatures.</>}
              </p>
              {checkoutConfigured && canManage && (
                <BillingButton endpoint="/api/creem/checkout" label={`Subscribe—$${APP.priceMonthlyUsd}/mo`} primary />
              )}
            </>
          )}

          {status === "active" && (
            <>
              <p className="mb-4 text-sm">
                Subscription <strong className="text-success">active</strong>
                {sub.current_period_end && <> · renews {new Date(sub.current_period_end).toLocaleDateString()}</>}.
              </p>
              {portalEndpoint && canManage && (
                <BillingButton endpoint={portalEndpoint} label="Manage subscription" />
              )}
              {!portalEndpoint && canManage && (
                <p className="text-sm text-muted-foreground">
                  The billing portal is temporarily unavailable. Your subscription remains active.
                </p>
              )}
            </>
          )}

          {!pending && (status === "past_due" || status === "canceled") && (
            <>
              <p className="mb-4 text-sm">
                Your subscription is <strong className="text-amber-700">{status === "past_due" ? "past due" : "canceled"}</strong>. Subscribe to restore access to your workspace.
              </p>
              {canManage && (
                <div className="flex flex-wrap gap-3">
                  {portalEndpoint && <BillingButton endpoint={portalEndpoint} label="Fix billing" primary />}
                  {checkoutConfigured && (
                    <BillingButton endpoint="/api/creem/checkout" label={`Resubscribe—$${APP.priceMonthlyUsd}/mo`} primary={!portalEndpoint} />
                  )}
                </div>
              )}
            </>
          )}

          {pending && <p className="text-sm text-muted-foreground">Your plan will update here once payment is confirmed. There is no need to subscribe again.</p>}
          {!canManage && (
            <p className="mt-4 text-sm text-muted-foreground">
              Ask an account owner or admin to manage billing.
            </p>
          )}
        </div>
      </section>

      <div className="flex items-start gap-3 rounded-xl bg-muted/40 p-5">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div><h2 className="text-sm font-medium">Your records stay yours</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Your signed waivers remain stored securely. An active subscription restores access to your workspace and records.</p>{status === "active" && <Link href="/signatures" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary">View your records<ArrowUpRight className="size-3.5" /></Link>}</div>
      </div>
    </div>
  );
}
