import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { APP } from "@/lib/config";
import { getOrgCaller } from "@/lib/auth";
import { canManageBilling } from "@/lib/permissions";

export const runtime = "nodejs";

/** Creates a Stripe Customer Portal session for managing the subscription. */
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
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe billing isn't configured." }, { status: 503 });
  }

  const admin = createAdminClient();
  const { data: sub, error: subError } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("org_id", caller.orgId)
    .maybeSingle();
  if (subError) {
    return NextResponse.json(
      { error: "We couldn't verify your billing profile. Please try again." },
      { status: 503 }
    );
  }
  if (!sub?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No billing account yet. Subscribe first." },
      { status: 400 }
    );
  }

  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${APP.url?.replace(/\/$/, "")}/settings/billing`,
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe portal failed", error);
    return NextResponse.json(
      { error: "Couldn't open the billing portal. Try again shortly." },
      { status: 502 }
    );
  }
}
