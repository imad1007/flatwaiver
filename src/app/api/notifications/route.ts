import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
  return NextResponse.json({ notifications: data.map((item) => ({
    id: item.id, title: item.title, description: item.message,
  })) }, { headers: { "Cache-Control": "private, no-store" } });
}
