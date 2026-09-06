import { NextResponse } from "next/server";
import { getOrgCaller } from "@/lib/auth";
import { canManageBilling } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createCreemCheckoutUrl,
  CreemConfigurationError,
} from "@/lib/creem";

export const runtime = "nodejs";

/**
 * Start a Creem hosted checkout for the current org. Same response contract as
 * the (dormant) Stripe checkout route: `{ url }` to redirect to. Access is NOT
 * granted here — the webhook is the source of truth once payment completes.
 */
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

  const { data: subscription, error: subscriptionError } = await createAdminClient()
    .from("subscriptions")
    .select("status")
    .eq("org_id", caller.orgId)
    .maybeSingle();
  if (subscriptionError || !subscription) {
    return NextResponse.json(
      { error: "We couldn't verify your subscription. Please try again." },
      { status: 503 }
    );
  }
  if (subscription.status === "active") {
    return NextResponse.json(
      { error: "Your subscription is already active." },
      { status: 409 }
    );
  }

  let url: string | null;
  try {
    url = await createCreemCheckoutUrl({
      orgId: caller.orgId,
      email: caller.email ?? null,
    });
  } catch (error) {
    if (error instanceof CreemConfigurationError) {
      console.error("Creem checkout configuration mismatch", error.message);
      return NextResponse.json(
        {
          error:
            "Checkout is temporarily unavailable because billing configuration needs attention.",
        },
        { status: 503 }
      );
    }
    console.error("Creem checkout failed", error);
    return NextResponse.json(
      { error: "Checkout couldn't be started. Please try again." },
      { status: 502 }
    );
  }
  if (!url) {
    return NextResponse.json(
      { error: "Billing isn't configured yet. Your trial keeps working." },
      { status: 503 }
    );
  }
  return NextResponse.json({ url });
}
