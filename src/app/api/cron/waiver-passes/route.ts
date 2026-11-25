import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { qrPassesEnabled } from "@/lib/qr-pass";
import { deliverPassEmail } from "@/lib/qr-pass-mail";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!qrPassesEnabled()) return NextResponse.json({ enabled: false });
  const { data, error } = await createAdminClient().from("waiver_pass_deliveries").select("signed_waiver_id").in("state", ["pending", "sending"]).lte("next_attempt_at", new Date().toISOString()).order("next_attempt_at").limit(20);
  if (error) return NextResponse.json({ error: "Delivery queue unavailable." }, { status: 503 });
  for (const row of data ?? []) { await deliverPassEmail(row.signed_waiver_id); await new Promise(resolve => setTimeout(resolve, 600)); }
  return NextResponse.json({ processed: data?.length ?? 0 });
}
