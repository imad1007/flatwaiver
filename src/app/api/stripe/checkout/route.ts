import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { APP } from "@/lib/config";
import { getOrgCaller } from "@/lib/auth";
import { canManageBilling } from "@/lib/permissions";

export const runtime = "nodejs";

/** Creates a Stripe Checkout Session for the configured subscription price. */
export async function POST() {
  let caller: Awaited<ReturnType<typeof getOrgCaller>>;
  try {
    caller = await getOrgCaller();
  } catch {
    return NextResponse.json(
      { error: "We couldn't verify your account. Please try again." },
      { status: 503 }
    );
  }
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!canManageBilling(caller.role)) {
    return NextResponse.json(
      { error: "Only an owner or admin can manage billing." },
      { status: 403 }
    );
  }
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_ID) {
    return NextResponse.json({ error: "Stripe billing isn't configured." }, { status: 503 });
  }

  const admin = createAdminClient();
  const { data: sub, error: subError } = await admin
    .from("subscriptions")
    .select("stripe_customer_id, status")
    .eq("org_id", caller.orgId)
    .maybeSingle();
  if (subError || !sub) {
    return NextResponse.json(
      { error: "We couldn't verify your subscription. Please try again." },
      { status: 503 }
    );
  }

  if (sub?.status === "active") {
    return NextResponse.json({ error: "Already subscribed." }, { status: 400 });
  }

  const stripe = getStripe();
  const base = APP.url?.replace(/\/$/, "");

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      client_reference_id: caller.orgId,
      ...(sub.stripe_customer_id
        ? { customer: sub.stripe_customer_id }
        : { customer_email: caller.email }),
      success_url: `${base}/settings/billing?checkout=success`,
      cancel_url: `${base}/settings/billing?checkout=canceled`,
      subscription_data: { metadata: { org_id: caller.orgId } },
      metadata: { org_id: caller.orgId },
    });
    if (!session.url) throw new Error("Stripe returned no checkout URL.");
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout failed", error);
    return NextResponse.json(
      { error: "Checkout couldn't be started. Please try again." },
      { status: 502 }
    );
  }
}
