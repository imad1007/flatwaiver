import { createClient } from "@/lib/supabase/server";
import { BillingButton } from "@/components/billing-buttons";
import { APP } from "@/lib/config";
import { daysLeftUntil } from "@/lib/dates";
import type { Subscription } from "@/lib/types";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { checkout } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("subscriptions").select("*").maybeSingle();
  const sub = (data ?? null) as Subscription | null;

  const status = sub?.status ?? "trialing";
  const trialDaysLeft = sub?.trial_ends_at ? daysLeftUntil(sub.trial_ends_at) : 0;

  return (
    <div>
      {checkout === "success" && (
        <div className="mt-4 rounded-md border border-success/30 bg-success/10 p-4 text-sm text-success">
          Thanks — your subscription is active. (It may take a few seconds to
          reflect here.)
        </div>
      )}
      {checkout === "canceled" && (
        <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
          Checkout canceled — no charge was made.
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
          {status === "trialing" && (
            <>
              <p className="mb-4 text-sm">
                You&apos;re on a free trial —{" "}
                <strong>
                  {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} remaining
                </strong>
                . No card on file.
              </p>
              <BillingButton
                endpoint="/api/stripe/checkout"
                label={`Subscribe — $${APP.priceMonthlyUsd}/mo`}
                primary
              />
            </>
          )}

          {status === "active" && (
            <>
              <p className="mb-4 text-sm">
                Subscription <strong className="text-success">active</strong>
                {sub?.current_period_end && (
                  <>
                    {" "}
                    · renews {new Date(sub.current_period_end).toLocaleDateString()}
                  </>
                )}
                .
              </p>
              <BillingButton endpoint="/api/stripe/portal" label="Manage subscription" />
            </>
          )}

          {(status === "past_due" || status === "canceled") && (
            <>
              <p className="mb-4 text-sm">
                Your subscription is{" "}
                <strong className="text-amber-700">
                  {status === "past_due" ? "past due" : "canceled"}
                </strong>
                . New signatures are paused until billing is fixed.
              </p>
              <div className="flex flex-wrap gap-3">
                {sub?.stripe_customer_id && (
                  <BillingButton
                    endpoint="/api/stripe/portal"
                    label="Fix billing"
                    primary
                  />
                )}
                <BillingButton
                  endpoint="/api/stripe/checkout"
                  label={`Resubscribe — $${APP.priceMonthlyUsd}/mo`}
                  primary={!sub?.stripe_customer_id}
                />
              </div>
            </>
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
