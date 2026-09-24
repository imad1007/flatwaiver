import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase.from("user_notifications")
    .select("id,title,message,created_at").eq("recipient_id", user.id)
    .order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: "Notifications unavailable" }, { status: 503 });
  const { data: reads, error: readError } = await supabase.from("notification_reads")
    .select("notification_id").eq("user_id", user.id);
  return NextResponse.json({ readIds: reads?.map(r => r.notification_id) ?? [], readStateAvailable: !readError, notifications: data.map((item) => ({
    id: item.id, title: item.title, description: item.message,
    createdAt: item.created_at,
  })) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = z.object({ ids: z.array(z.string().min(1).max(200)).min(1).max(100) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid notifications" }, { status: 400 });
  const { error: saveError } = await supabase.from("notification_reads").upsert(
    [...new Set(parsed.data.ids)].map(id => ({ user_id: user.id, notification_id: id })),
    { onConflict: "user_id,notification_id", ignoreDuplicates: true },
  );
  if (saveError) return NextResponse.json({ error: "Could not save read status. Please try again." }, { status: 503 });
  return NextResponse.json({ success: true });
}
