import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPaddlePortalUrl } from "@/lib/paddle";

export const runtime = "nodejs";

/**
 * Customer portal (manage payment method, invoices, cancel). Same response
 * contract as the Stripe portal route: `{ url }` to redirect to.
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
    .select("paddle_customer_id")
    .maybeSingle();
  if (!sub?.paddle_customer_id) {
    return NextResponse.json(
      { error: "No billing profile yet — subscribe first." },
      { status: 400 }
    );
  }

  const url = await createPaddlePortalUrl(sub.paddle_customer_id);
  if (!url) {
    return NextResponse.json(
      { error: "Couldn't open the billing portal. Try again shortly." },
      { status: 502 }
    );
  }
  return NextResponse.json({ url });
}
