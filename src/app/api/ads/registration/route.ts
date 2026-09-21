import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/admin";
import { pixelEnabled } from "@/lib/openai-pixel";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const empty = () => new NextResponse(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
  if (!pixelEnabled(process.env.VERCEL_ENV, process.env.OPENAI_ADS_PIXEL_ENABLED) ||
      request.cookies.get("fw-consent")?.value !== "granted" ||
      request.headers.get("origin") !== request.nextUrl.origin) return empty();
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user || isPlatformAdmin(user.email)) return empty();
    // No client-supplied account, organization or event IDs are accepted.
    const { data, error: claimError } = await createAdminClient().rpc("claim_registration_measurement", { p_user: user.id });
    if (claimError || !data) return empty();
    return NextResponse.json({ eventId: data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    // Measurement failure must not affect account creation or app access.
    return empty();
  }
}
