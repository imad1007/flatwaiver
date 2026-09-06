import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findRenewalsDue } from "@/lib/renewals";
import { deliverRenewalReminder } from "@/lib/renewal-delivery";
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

  let items;
  try {
    items = await findRenewalsDue(null);
  } catch (error) {
    console.error("Cron renewal scan failed", error);
    return NextResponse.json(
      { error: "Renewal candidates couldn't be loaded." },
      { status: 503 }
    );
  }
  const due = items.filter((i) => i.signerEmail && !i.remindedAt);

  const admin = createAdminClient();
  const base = APP.url?.replace(/\/$/, "") ?? "";
  const orgNames = new Map<string, string>();
  async function orgName(orgId: string): Promise<string> {
    const cached = orgNames.get(orgId);
    if (cached) return cached;
    const { data, error } = await admin
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .single();
    if (error) throw new Error(`Couldn't load reminder organization: ${error.message}`);
    const name = data?.name ?? APP.name;
    orgNames.set(orgId, name);
    return name;
  }

  let sent = 0;
  for (const item of due) {
    try {
      const delivery = await deliverRenewalReminder({
        orgId: item.orgId,
        signedWaiverId: item.signedWaiverId,
        signerEmail: item.signerEmail!,
        signerName: item.signerName,
        waiverName: item.templateName,
        orgName: await orgName(item.orgId),
        signingUrl: `${base}/w/${item.templateSlug}`,
        expired: item.state === "expired",
      });
      if (delivery.sent) sent += 1;
    } catch (err) {
      console.error("cron reminder failed", item.signedWaiverId, err);
    }
  }

  return NextResponse.json({ ok: true, candidates: due.length, sent });
}
