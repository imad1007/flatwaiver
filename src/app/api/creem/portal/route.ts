import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCreemPortalUrl } from "@/lib/creem";

export const runtime = "nodejs";

/**
 * Creem customer portal (manage payment method, invoices, cancel). Same
 * response contract as the Stripe portal route: `{ url }` to redirect to.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

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
