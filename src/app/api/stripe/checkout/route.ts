import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { APP } from "@/lib/config";

export const runtime = "nodejs";

/** Creates a Stripe Checkout Session for the $39/mo subscription. */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, email")
    .eq("id", user.id)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "No profile." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("stripe_customer_id, status")
    .eq("org_id", profile.org_id)
    .maybeSingle();

  if (sub?.status === "active") {
    return NextResponse.json({ error: "Already subscribed." }, { status: 400 });
  }

  const stripe = getStripe();
  const base = APP.url?.replace(/\/$/, "");

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    client_reference_id: profile.org_id,
    ...(sub?.stripe_customer_id
      ? { customer: sub.stripe_customer_id }
      : { customer_email: user.email ?? profile.email }),
    success_url: `${base}/settings/billing?checkout=success`,
    cancel_url: `${base}/settings/billing?checkout=canceled`,
    subscription_data: {
      metadata: { org_id: profile.org_id },
    },
    metadata: { org_id: profile.org_id },
  });

  return NextResponse.json({ url: session.url });
}
