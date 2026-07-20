import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCreemCheckoutUrl } from "@/lib/creem";

export const runtime = "nodejs";

/**
 * Start a Creem hosted checkout for the current org. Same response contract as
 * the (dormant) Stripe checkout route: `{ url }` to redirect to. Access is NOT
 * granted here — the webhook is the source of truth once payment completes.
 */
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
    .select("org_id")
    .maybeSingle();
  if (!profile?.org_id) {
    return NextResponse.json(
      { error: "No organization found for this account." },
      { status: 400 }
    );
  }

  const url = await createCreemCheckoutUrl({
    orgId: profile.org_id,
    email: user.email ?? null,
  });
  if (!url) {
    return NextResponse.json(
      { error: "Billing isn't configured yet. Your trial keeps working." },
      { status: 503 }
    );
  }
  return NextResponse.json({ url });
}
