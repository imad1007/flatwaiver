import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgCaller } from "@/lib/auth";
import { canManageBilling } from "@/lib/permissions";
import { createCreemPortalUrl } from "@/lib/creem";

export const runtime = "nodejs";

/**
 * Creem customer portal (manage payment method, invoices, cancel). Same
 * response contract as the Stripe portal route: `{ url }` to redirect to.
 */
export async function POST() {
  const caller = await getOrgCaller();
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!canManageBilling(caller.role)) {
    return NextResponse.json(
      { error: "Only an owner or admin can manage billing." },
      { status: 403 }
    );
  }

  const supabase = await createClient();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("creem_customer_id")
    .maybeSingle();
  if (!sub?.creem_customer_id) {
    return NextResponse.json(
      { error: "No billing profile yet — subscribe first." },
      { status: 400 }
    );
  }

  const url = await createCreemPortalUrl(sub.creem_customer_id);
  if (!url) {
    return NextResponse.json(
      { error: "Couldn't open the billing portal. Try again shortly." },
      { status: 502 }
    );
  }
  return NextResponse.json({ url });
}
