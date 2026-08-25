import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findRenewalsDue } from "@/lib/renewals";
import { sendResignReminderEmail } from "@/lib/email";
import { APP } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Daily automated re-sign reminders. Triggered by Vercel Cron (see vercel.json),
 * which sends `Authorization: Bearer ${CRON_SECRET}`. Emails every signer whose
 * latest signature is expiring/expired and who hasn't already been reminded, and
 * records each send so it never repeats.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Cron not configured." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const items = await findRenewalsDue(null);
  const due = items.filter((i) => i.signerEmail && !i.remindedAt);

  const admin = createAdminClient();
  const base = APP.url?.replace(/\/$/, "") ?? "";
  const orgNames = new Map<string, string>();
  async function orgName(orgId: string): Promise<string> {
    const cached = orgNames.get(orgId);
    if (cached) return cached;
    const { data } = await admin
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .single();
    const name = data?.name ?? APP.name;
    orgNames.set(orgId, name);
    return name;
  }

  let sent = 0;
  for (const item of due) {
    try {
      await sendResignReminderEmail({
        to: item.signerEmail!,
        signerName: item.signerName,
        waiverName: item.templateName,
        orgName: await orgName(item.orgId),
        signingUrl: `${base}/w/${item.templateSlug}`,
        expired: item.state === "expired",
      });
      await admin.from("signature_reminders").upsert(
        {
          org_id: item.orgId,
          signed_waiver_id: item.signedWaiverId,
          kind: "resign",
          sent_at: new Date().toISOString(),
        },
        { onConflict: "signed_waiver_id,kind" }
      );
      sent += 1;
    } catch (err) {
      console.error("cron reminder failed", item.signedWaiverId, err);
    }
  }

  return NextResponse.json({ ok: true, candidates: due.length, sent });
}
