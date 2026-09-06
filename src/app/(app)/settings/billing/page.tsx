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

  return (
    <div>
      {checkout === "success" && (
        <BillingActivationNotice active={status === "active"} checkoutId={checkoutId} />
      )}
      {checkout === "canceled" && (
        <div role="status" className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
          Checkout canceled—no charge was made.
        </div>
      )}

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="font-bold">Plan</h2>
        <p className="mt-2 text-3xl font-bold">
          ${APP.priceMonthlyUsd}
          <span className="text-base font-normal text-muted-foreground">/month, flat</span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Unlimited signed waivers, templates, and storage.
        </p>

        <div className="mt-6">
          {!checkoutConfigured && status !== "active" && canManage && (
            <p className="mb-4 text-sm text-muted-foreground">
              Billing is temporarily unavailable. Your trial keeps working in the meantime.
            </p>
          )}

          {status === "trialing" && (
            <>
              <p className="mb-4 text-sm">
                You&apos;re on a free trial—<strong>{trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} remaining</strong>. No card on file.
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

          {(status === "past_due" || status === "canceled") && (
            <>
              <p className="mb-4 text-sm">
                Your subscription is <strong className="text-amber-700">{status === "past_due" ? "past due" : "canceled"}</strong>. New signatures are paused until billing is fixed.
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

          {!canManage && (
            <p className="mt-4 text-sm text-muted-foreground">
              Ask an account owner or admin to manage billing.
            </p>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-card">
        <h2 className="font-bold text-foreground">Your documents are never held hostage</h2>
        <p className="mt-2">
          Whatever happens with billing, you can always view, search, download,
          and export every waiver you&apos;ve collected. A lapsed subscription only
          pauses <em>new</em> signatures.
        </p>
      </section>
    </div>
  );
}
