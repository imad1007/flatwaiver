import { NextResponse } from "next/server";
import { sendSupportRequestEmail } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";
import { supportRequestSchema } from "@/lib/support-request";
import { verifyTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request.", 400);
  }
  const parsed = supportRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Check your email and include at least 20 characters.", 400);
  }
  if (parsed.data.website) return NextResponse.json({ ok: true });

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!(await verifyTurnstile(parsed.data.turnstileToken, forwarded))) {
    return jsonError("Verification failed. Please retry the challenge.", 403);
  }

  let accountEmail: string | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    accountEmail = data.user?.email ?? null;
  } catch {
    // Support remains available during an auth-session lookup failure.
  }

  try {
    const reference = await sendSupportRequestEmail({
      fromEmail: parsed.data.email,
      name: parsed.data.name,
      topic: parsed.data.topic,
      message: parsed.data.message,
      accountEmail,
    });
    return NextResponse.json({ ok: true, reference });
  } catch (error) {
    console.error("Support request delivery failed", error);
    return jsonError("We couldn't deliver your request. Please email support directly.", 502);
  }
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}
