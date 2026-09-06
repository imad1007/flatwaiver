import "server-only";

import { Creem } from "creem";
import { APP } from "@/lib/config";
import { billingOfferMismatches } from "@/lib/billing-offer";
import type { SubscriptionStatus } from "@/lib/types";

/**
 * Creem billing (the active provider; Paddle removed, Stripe dormant).
 * Server-only — CREEM_API_KEY must never reach the client. Test vs live is
 * driven by CREEM_SERVER: "prod" hits the live API, anything else stays on the
 * test sandbox (verified against the SDK's ServerList — the value is "prod",
 * not "live").
 */

function creemServer(): "test" | "prod" {
  return process.env.CREEM_SERVER === "prod" ? "prod" : "test";
}

/** True when the keys needed to run checkout exist. */
export function creemConfigured(): boolean {
  return Boolean(process.env.CREEM_API_KEY && process.env.CREEM_PRODUCT_ID);
}

function client(): Creem {
  return new Creem({
    apiKey: process.env.CREEM_API_KEY!,
    server: creemServer(),
  });
}

export class CreemConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreemConfigurationError";
  }
}

async function assertCheckoutProductMatchesOffer(
  creem: Creem,
  productId: string
): Promise<void> {
  const product = await creem.products.get(productId);
  const mismatches = billingOfferMismatches(product, APP.priceMonthlyUsd);

  if (mismatches.length > 0) {
    throw new CreemConfigurationError(
      `CREEM_PRODUCT_ID ${productId} conflicts with the public offer: ${mismatches.join(
        "; "
      )}`
    );
  }
}

/**
 * Create a hosted checkout for the single flat-rate product and return its URL.
 * org_id rides along as checkout metadata so the webhook can map the resulting
 * subscription back to the org. Returns null if billing isn't configured.
 */
export async function createCreemCheckoutUrl(opts: {
  orgId: string;
  email: string | null;
}): Promise<string | null> {
  const productId = process.env.CREEM_PRODUCT_ID;
  if (!productId || !process.env.CREEM_API_KEY) return null;

  const creem = client();
  await assertCheckoutProductMatchesOffer(creem, productId);

  const successUrl = `${APP.url}/settings/billing?checkout=success`;
  const checkout = await creem.checkouts.create({
    productId,
    successUrl,
    metadata: { org_id: opts.orgId },
    ...(opts.email ? { customer: { email: opts.email } } : {}),
  });
  return checkout.checkoutUrl ?? null;
}

/**
 * Generate a Creem customer-portal link (manage payment method, invoices,
 * cancel). Returns null if billing isn't configured.
 */
export async function createCreemPortalUrl(
  customerId: string
): Promise<string | null> {
  if (!process.env.CREEM_API_KEY) return null;
  const links = await client().customers.generateBillingLinks({ customerId });
  return links.customerPortalLink ?? null;
}

/**
 * Map a Creem SubscriptionStatus onto our four-state gating enum. Used for
 * `subscription.update` events, where the current status is authoritative.
 * (scheduled_cancel is still usable until the period actually ends.)
 */
export function mapCreemStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "scheduled_cancel":
      return "active";
    case "past_due":
    case "unpaid":
    case "paused":
      return "past_due";
    default:
      // canceled, expired, and anything unknown → not usable
      return "canceled";
  }
}
