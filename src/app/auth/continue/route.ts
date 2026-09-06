import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authDestination } from "@/lib/auth-destination";
import { safeInternalPath } from "@/lib/safe-redirect";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeInternalPath(url.searchParams.get("next"));
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  const destination = error || !user
    ? `/login?next=${encodeURIComponent(next)}`
    : authDestination(user.email, next);
  const response = NextResponse.redirect(new URL(destination, url.origin));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
