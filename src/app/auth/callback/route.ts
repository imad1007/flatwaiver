import { NextResponse } from "next/server";
import { safeInternalPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";
import { authDestination } from "@/lib/auth-destination";

export const runtime = "nodejs";

/** PKCE code exchange target for magic links, email confirmations, and OAuth. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const safeNext = safeInternalPath(url.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      return NextResponse.redirect(new URL(authDestination(data.user.email, safeNext), url.origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth", url.origin));
}
