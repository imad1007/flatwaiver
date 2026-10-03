import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOrgCaller } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTikTokPaymentProperties } from "@/lib/tiktok-payment";
import { TIKTOK_EVENTS, tiktokEnabled, type TikTokEvent } from "@/lib/tiktok-pixel";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
function allowed(request: NextRequest) {
  return tiktokEnabled(process.env.VERCEL_ENV, process.env.TIKTOK_PIXEL_ENABLED) &&
    request.cookies.get("fw-consent")?.value === "granted" &&
    request.headers.get("origin") === request.nextUrl.origin;
}
const empty = () => new NextResponse(null, { status: 204, headers });
async function owner() {
  const caller = await getOrgCaller();
  return caller?.role === "owner" && !isPlatformAdmin(caller.email) ? caller : null;
}

export async function POST(request: NextRequest) {
  if (!allowed(request)) return empty();
  try {
    const caller = await owner();
    if (!caller) return empty();
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("reserve_tiktok_measurements", { p_user: caller.userId });
    if (error) throw error;
    const events: TikTokEvent[] = [];
    for (const row of data ?? []) {
      if (row.kind === "registration") {
        events.push({ eventId: row.event_id, event: TIKTOK_EVENTS.registration, properties: {} });
      } else if (row.kind === "payment") {
        const properties = await getTikTokPaymentProperties(row.source_id, row.subscription_id);
        if (properties) events.push({ eventId: row.event_id, event: TIKTOK_EVENTS.payment, properties });
      }
    }
    return NextResponse.json({ events }, { headers });
  } catch {
    return NextResponse.json({ error: "Measurement temporarily unavailable" }, { status: 503, headers });
  }
}

export async function PATCH(request: NextRequest) {
  if (!allowed(request)) return empty();
  try {
    const caller = await owner();
    if (!caller) return empty();
    const parsed = z.object({ eventId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid event" }, { status: 400, headers });
    const { data, error } = await createAdminClient().rpc("complete_tiktok_measurement", {
      p_user: caller.userId, p_event: parsed.data.eventId,
    });
    if (error) throw error;
    return NextResponse.json({ acknowledged: data === true }, { status: data ? 200 : 404, headers });
  } catch {
    return NextResponse.json({ error: "Measurement temporarily unavailable" }, { status: 503, headers });
  }
}
