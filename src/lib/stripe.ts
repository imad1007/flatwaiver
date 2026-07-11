// ⚠️ STRIPE — DORMANT. Paddle is the active billing provider (src/lib/paddle.ts,
// /api/paddle/*). This module and the /api/stripe/* routes are kept intact for
// a possible future switch back: nothing in the UI calls them, and they are
// inert without the STRIPE_* env vars. To reactivate, restore the commented
// Stripe blocks in settings/billing/page.tsx and set the env vars.

import "server-only";

import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return stripeClient;
}

/** Map a Stripe subscription status onto our four states. */
export function mapStripeStatus(
  status: Stripe.Subscription.Status
): "trialing" | "active" | "past_due" | "canceled" {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    default:
      // canceled, unpaid, incomplete, incomplete_expired, paused
      return "canceled";
  }
}

/**
 * `current_period_end` lives on the subscription item in newer Stripe API
 * versions and on the subscription itself in older ones. Handle both.
 */
export function getCurrentPeriodEnd(sub: Stripe.Subscription): string | null {
  const item = sub.items?.data?.[0] as
    | (Stripe.SubscriptionItem & { current_period_end?: number })
    | undefined;
  const ts =
    item?.current_period_end ??
    (sub as Stripe.Subscription & { current_period_end?: number })
      .current_period_end;
  return ts ? new Date(ts * 1000).toISOString() : null;
}
