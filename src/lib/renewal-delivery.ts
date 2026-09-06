import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendResignReminderEmail } from "@/lib/email";
import { renewalEmailIdempotencyKey } from "@/lib/renewal-idempotency";

export type RenewalDelivery = {
  orgId: string;
  signedWaiverId: string;
  signerEmail: string;
  signerName: string;
  waiverName: string;
  orgName: string;
  signingUrl: string;
  expired: boolean;
};

/**
 * Send one renewal reminder. The provider key makes concurrent calls and
 * retries converge on one email; the local ledger avoids unnecessary calls.
 */
export async function deliverRenewalReminder(
  delivery: RenewalDelivery
): Promise<{ sent: boolean; duplicate: boolean }> {
  const admin = createAdminClient();
  const { data: existing, error: lookupError } = await admin
    .from("signature_reminders")
    .select("id")
    .eq("signed_waiver_id", delivery.signedWaiverId)
    .eq("kind", "resign")
    .maybeSingle();
  if (lookupError) {
    throw new Error(`Couldn't verify reminder status: ${lookupError.message}`);
  }
  if (existing) return { sent: false, duplicate: true };

  await sendResignReminderEmail({
    to: delivery.signerEmail,
    signerName: delivery.signerName,
    waiverName: delivery.waiverName,
    orgName: delivery.orgName,
    signingUrl: delivery.signingUrl,
    expired: delivery.expired,
    idempotencyKey: renewalEmailIdempotencyKey(delivery.signedWaiverId),
  });

  const { error: ledgerError } = await admin.from("signature_reminders").upsert(
    {
      org_id: delivery.orgId,
      signed_waiver_id: delivery.signedWaiverId,
      kind: "resign",
      sent_at: new Date().toISOString(),
    },
    { onConflict: "signed_waiver_id,kind" }
  );
  if (ledgerError) {
    throw new Error(
      `Reminder was accepted by the email provider, but tracking failed: ${ledgerError.message}`
    );
  }

  return { sent: true, duplicate: false };
}
