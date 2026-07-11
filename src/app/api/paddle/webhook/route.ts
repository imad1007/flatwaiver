import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapPaddleStatus, verifyPaddleWebhook } from "@/lib/paddle";

export const runtime = "nodejs";

interface PaddleSubscriptionData {
  id: string;
  status: string;
  customer_id: string;
  custom_data?: { org_id?: string } | null;
  current_billing_period?: { ends_at?: string } | null;
}

/**
 * Paddle webhook: mirrors subscription state onto the `subscriptions` table
 * (the Paddle counterpart of the Stripe webhook). Handles every
 * `subscription.*` event by upserting the subscription's current state.
 * The org is resolved from checkout custom_data (org_id), falling back to a
 * previously stored paddle_subscription_id.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const valid = verifyPaddleWebhook(
    rawBody,
    request.headers.get("paddle-signature"),
    process.env.PADDLE_WEBHOOK_SECRET
  );
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let event: { event_type?: string; data?: PaddleSubscriptionData };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  if (!event.event_type?.startsWith("subscription.") || !event.data?.id) {
    // Not a subscription event — acknowledge so Paddle stops retrying.
    return NextResponse.json({ received: true });
  }

  const sub = event.data;
  const update = {
    paddle_customer_id: sub.customer_id ?? null,
    paddle_subscription_id: sub.id,
    status: mapPaddleStatus(sub.status),
    current_period_end: sub.current_billing_period?.ends_at ?? null,
    updated_at: new Date().toISOString(),
  };

  const admin = createAdminClient();
  const orgId = sub.custom_data?.org_id;

  if (orgId) {
    const { error } = await admin.from("subscriptions").update(update).eq("org_id", orgId);
    if (error) {
      console.error("paddle webhook update by org failed", error);
      return NextResponse.json({ error: "Update failed." }, { status: 500 });
    }
  } else {
    // No custom_data (e.g. renewal events) — match the stored subscription id.
    const { error } = await admin
      .from("subscriptions")
      .update(update)
      .eq("paddle_subscription_id", sub.id);
    if (error) {
      console.error("paddle webhook update by sub id failed", error);
      return NextResponse.json({ error: "Update failed." }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
