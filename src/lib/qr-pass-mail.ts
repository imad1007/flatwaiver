import "server-only";
import QRCode from "qrcode";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWaiverPassEmail } from "@/lib/email";
import { ensurePasses, qrPassesEnabled } from "@/lib/qr-pass";

export async function deliverPassEmail(signatureId: string) {
  if (!qrPassesEnabled() || process.env.FLATWAIVER_ENV === "staging" || !process.env.RESEND_API_KEY) return;
  const admin = createAdminClient();
  const { data: claimed, error } = await admin.rpc("claim_waiver_pass_email", { p_signature: signatureId });
  if (error || !claimed) return;
  try {
    const { data: signed, error: lookupError } = await admin.from("signed_waivers").select("signer_email").eq("id", signatureId).single();
    if (lookupError || !signed?.signer_email) throw new Error("Recipient unavailable.");
    const { data: receipt, error: receiptError } = await admin.from("waiver_pass_receipts").select("receipt_hash").eq("signed_waiver_id", signatureId).single();
    if (receiptError || !receipt) throw new Error("Receipt unavailable.");
    const passes = await ensurePasses(signatureId, { receipt: receipt.receipt_hash });
    if (!passes.length || passes.some(p => p.revoked)) throw new Error("Passes require review.");
    const images = await Promise.all(passes.map(p => QRCode.toBuffer(p.code, { width: 640, margin: 4, errorCorrectionLevel: "M" })));
    const providerId = await sendWaiverPassEmail({ to: signed.signer_email, recordId: signatureId, images });
    const { error: updateError } = await admin.from("waiver_pass_deliveries").update({ state: "sent", provider_id: providerId, lease_until: null }).eq("signed_waiver_id", signatureId);
    if (updateError) throw new Error("Delivery state unavailable.");
  } catch {
    await admin.from("waiver_pass_deliveries").update({ state: "pending", lease_until: null, next_attempt_at: new Date(Date.now() + 300000).toISOString() }).eq("signed_waiver_id", signatureId);
  }
}
