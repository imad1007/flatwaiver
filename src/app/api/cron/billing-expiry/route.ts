import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendBillingExpiryEmail } from "@/lib/email";
import type { BillingExpiryKind } from "@/lib/billing-expiry-email";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !process.env.RESEND_API_KEY) return NextResponse.json({ error: "Billing email is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const admin = createAdminClient();
  const { data: jobs, error } = await admin.rpc("claim_billing_expiry_emails", { p_limit: 20 });
  if (error) {
    console.error("Billing expiry scan failed", { code: error.code });
    return NextResponse.json({ error: "Billing expiry scan failed." }, { status: 503 });
  }
  let sent = 0;
  let failed = 0;
  for (const job of jobs ?? []) {
    try {
      // Recheck immediately before delivery: the owner may have just renewed or changed email.
      const { data: candidate, error: recheckError } = await admin.from("billing_expiry_candidates")
        .select("recipient_email").eq("org_id", job.org_id).eq("recipient_id", job.recipient_id)
        .eq("kind", job.kind).eq("episode", job.episode).maybeSingle();
      if (recheckError) throw new Error("Could not recheck billing state.");
      if (!candidate || candidate.recipient_email !== job.recipient_email) {
        const { error: skipError } = await admin.from("billing_expiry_emails").update({ status: "skipped" }).eq("id", job.id);
        if (skipError) throw new Error("Could not record skipped notice.");
        continue;
      }
      // Stay below the provider's default two-requests-per-second limit.
      await new Promise((resolve) => setTimeout(resolve, 600));
      const providerId = await sendBillingExpiryEmail({
        to: job.recipient_email, orgName: job.org_name, kind: job.kind as BillingExpiryKind,
        idempotencyKey: `billing-expiry/${job.id}`,
      });
      const { error: sentError } = await admin.from("billing_expiry_emails")
        .update({ status: "sent", sent_at: new Date().toISOString(), provider_id: providerId }).eq("id", job.id);
      if (sentError) throw new Error("Email accepted but delivery tracking failed.");
      sent++;
    } catch (error) {
      failed++;
      console.error("Billing expiry email failed", { noticeId: job.id, error });
    }
  }
  return NextResponse.json({ sent, failed, candidates: jobs?.length ?? 0 }, { status: failed ? 503 : 200 });
}
