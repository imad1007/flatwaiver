import { NextResponse } from "next/server";
import { constructWebhookEventEntity } from "creem/webhooks";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapCreemStatus } from "@/lib/creem";
import type { SubscriptionStatus } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Creem webhook — the source of truth for billing access (never the success
 * redirect). Verifies the raw-body signature, dedupes redelivered events via
 * the webhook_events table, then mirrors the subscription lifecycle onto the
 * `subscriptions.status` column that gates the app.
 *
 * Org linkage: `checkout.completed` carries metadata.org_id and establishes the
 * org → (creem_customer_id, creem_subscription_id) mapping. Later subscription
 * events (renewals, cancellations) match by that stored subscription id, with a
 * metadata.org_id fast path when Creem propagates it.
 */

// Creem entities expand `customer`/`subscription` as either an id string or the
// full object — accept both and pull the id.
function idOf(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

function periodEndOf(value: unknown): string | null {
  if (value && typeof value === "object" && "currentPeriodEndDate" in value) {
    const d = (value as { currentPeriodEndDate?: unknown }).currentPeriodEndDate;
    if (d instanceof Date) return d.toISOString();
    if (typeof d === "string") return new Date(d).toISOString();
  }
  return null;
}

function orgIdOf(metadata: unknown): string | null {
  if (metadata && typeof metadata === "object" && "org_id" in metadata) {
    const v = (metadata as { org_id?: unknown }).org_id;
    return typeof v === "string" ? v : null;
  }
  return null;
}

/** eventType → gating status. The event itself signals the transition. */
function statusForEvent(eventType: string, objectStatus: unknown): SubscriptionStatus {
  switch (eventType) {
    case "checkout.completed":
    case "subscription.active":
    case "subscription.paid":
    case "subscription.scheduled_cancel": // still usable until period end
      return "active";
    case "subscription.trialing":
      return "trialing";
    case "subscription.past_due":
    case "subscription.unpaid":
    case "subscription.paused":
      return "past_due";
    case "subscription.canceled":
    case "subscription.expired":
      return "canceled";
    case "subscription.update":
    default:
      return mapCreemStatus(typeof objectStatus === "string" ? objectStatus : "");
  }
}

type SubUpdate = {
  status: SubscriptionStatus;
  updated_at: string;
  creem_customer_id?: string | null;
  creem_subscription_id?: string | null;
  current_period_end?: string | null;
};

async function updateByOrg(
  admin: SupabaseClient,
  orgId: string,
  update: SubUpdate
) {
  const { error } = await admin.from("subscriptions").update(update).eq("org_id", orgId);
  if (error) throw new Error(`update by org failed: ${error.message}`);
}

async function updateBySubscription(
  admin: SupabaseClient,
  subscriptionId: string,
  update: SubUpdate
) {
  const { error } = await admin
    .from("subscriptions")
    .update(update)
    .eq("creem_subscription_id", subscriptionId);
  if (error) throw new Error(`update by subscription failed: ${error.message}`);
}

async function applyEvent(
  admin: SupabaseClient,
  eventType: string,
  object: Record<string, unknown>
) {
  if (eventType === "checkout.completed") {
    const orgId = orgIdOf(object.metadata);
    if (!orgId) return; // can't link without an org; nothing to apply
    await updateByOrg(admin, orgId, {
      status: "active",
      creem_customer_id: idOf(object.customer),
      creem_subscription_id: idOf(object.subscription),
      current_period_end: periodEndOf(object.subscription),
      updated_at: new Date().toISOString(),
    });
    return;
  }

  if (eventType.startsWith("subscription.")) {
    const subscriptionId = idOf(object.id ?? object);
    const update: SubUpdate = {
      status: statusForEvent(eventType, object.status),
      creem_customer_id: idOf(object.customer),
      creem_subscription_id: subscriptionId,
      current_period_end: periodEndOf(object),
      updated_at: new Date().toISOString(),
    };
    const orgId = orgIdOf(object.metadata);
    if (orgId) {
      await updateByOrg(admin, orgId, update);
    } else if (subscriptionId) {
      await updateBySubscription(admin, subscriptionId, update);
    }
    return;
  }

  // refund.created, dispute.created, etc. — acknowledged, no state change.
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  let event;
  try {
    event = await constructWebhookEventEntity(rawBody, request.headers, {
      secret: process.env.CREEM_WEBHOOK_SECRET!,
    });
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const admin = createAdminClient();
  const eventId = event.id;

  // Idempotency: claim the event id before applying. A redelivery hits the
  // primary-key conflict and is acknowledged without re-applying.
  if (eventId) {
    const { error } = await admin
      .from("webhook_events")
      .insert({ provider: "creem", event_id: eventId });
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ received: true, duplicate: true });
      }
      // Don't block billing on the dedupe table — log and continue.
      console.error("creem webhook dedupe insert failed", error);
    }
  }

  try {
    await applyEvent(
      admin,
      event.eventType,
      event.object as unknown as Record<string, unknown>
    );
  } catch (e) {
    console.error("creem webhook apply failed", e);
    // Release the idempotency claim so Creem's retry reprocesses this event.
    if (eventId) {
      await admin
        .from("webhook_events")
        .delete()
        .match({ provider: "creem", event_id: eventId });
    }
    return NextResponse.json({ error: "Processing failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
