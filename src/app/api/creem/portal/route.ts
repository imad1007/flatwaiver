import { NextResponse } from "next/server";
import { getOrgCaller } from "@/lib/auth";
import { canManageBilling } from "@/lib/permissions";
import { createCreemPortalUrl } from "@/lib/creem";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Creem customer portal (manage payment method, invoices, cancel). Same
 * response contract as the Stripe portal route: `{ url }` to redirect to.
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

  const { data: sub, error: subError } = await createAdminClient()
    .from("subscriptions")
    .select("creem_customer_id")
    .eq("org_id", caller.orgId)
    .maybeSingle();
  if (subError) {
    return NextResponse.json(
      { error: "We couldn't verify your billing profile. Please try again." },
      { status: 503 }
    );
  }
  if (!sub?.creem_customer_id) {
    return NextResponse.json(
      { error: "No billing profile yet — subscribe first." },
      { status: 400 }
    );
  }

  let url: string | null;
  try {
    url = await createCreemPortalUrl(sub.creem_customer_id);
  } catch (error) {
    console.error("Creem portal failed", error);
    return NextResponse.json(
      { error: "Couldn't open the billing portal. Try again shortly." },
      { status: 502 }
    );
  }
  if (!url) {
    return NextResponse.json(
      { error: "Couldn't open the billing portal. Try again shortly." },
      { status: 502 }
    );
  }
  return NextResponse.json({ url });
}
