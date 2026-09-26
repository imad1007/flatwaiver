import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/admin";
import { pixelEnabled } from "@/lib/openai-pixel";
import { z } from "zod";

export const runtime = "nodejs";

const noContent = () => new NextResponse(null, {
  status: 204,
  headers: { "Cache-Control": "private, no-store" },
});

function measurementAllowed(request: NextRequest) {
  return pixelEnabled(process.env.VERCEL_ENV, process.env.OPENAI_ADS_PIXEL_ENABLED) &&
    request.cookies.get("fw-consent")?.value === "granted" &&
    request.headers.get("origin") === request.nextUrl.origin;
}

async function authenticatedUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return !error && user && !isPlatformAdmin(user.email) ? user : null;
}

export async function POST(request: NextRequest) {
  if (!measurementAllowed(request)) return noContent();
  try {
    const user = await authenticatedUser();
    if (!user) return noContent();
    // The stable ID is not consumed here. React retries and parallel tabs can
    // receive the same ID, which the Pixel deduplicates as one logical event.
    const { data, error } = await createAdminClient().rpc("reserve_registration_measurement", { p_user: user.id });
    if (error) {
      console.warn("[openai-registration] reserve_rpc_error", { code: error.code ?? "unknown" });
      return noContent();
    }
    if (!data) {
      console.info("[openai-registration] candidate_unavailable");
      return noContent();
    }
    console.info("[openai-registration] candidate_returned");
    return NextResponse.json({ eventId: data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    // Measurement failure must not affect account creation or app access.
    console.warn("[openai-registration] reserve_failed");
    return noContent();
  }
}

export async function PATCH(request: NextRequest) {
  if (!measurementAllowed(request)) return noContent();
  try {
    const user = await authenticatedUser();
    if (!user) return noContent();
    const parsed = z.object({ eventId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid event ID" }, { status: 400 });
    const { data, error } = await createAdminClient().rpc("complete_registration_measurement", {
      p_user: user.id,
      p_event: parsed.data.eventId,
    });
    if (error) {
      console.warn("[openai-registration] completion_rpc_error", { code: error.code ?? "unknown" });
      return NextResponse.json({ error: "Delivery status unavailable" }, { status: 503 });
    }
    if (!data) return noContent();
    console.info("[openai-registration] delivery_queued");
    return NextResponse.json({ acknowledged: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    console.warn("[openai-registration] completion_failed");
    return NextResponse.json({ error: "Delivery status unavailable" }, { status: 503 });
  }
}
