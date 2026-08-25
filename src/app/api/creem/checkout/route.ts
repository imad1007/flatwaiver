import { NextResponse } from "next/server";
import { getOrgCaller } from "@/lib/auth";
import { canManageBilling } from "@/lib/permissions";
import { createCreemCheckoutUrl } from "@/lib/creem";

export const runtime = "nodejs";

/**
 * Start a Creem hosted checkout for the current org. Same response contract as
 * the (dormant) Stripe checkout route: `{ url }` to redirect to. Access is NOT
 * granted here — the webhook is the source of truth once payment completes.
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

  const url = await createCreemCheckoutUrl({
    orgId: caller.orgId,
    email: caller.email ?? null,
  });
  if (!url) {
    return NextResponse.json(
      { error: "Billing isn't configured yet. Your trial keeps working." },
      { status: 503 }
    );
  }
  return NextResponse.json({ url });
}
