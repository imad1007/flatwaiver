import "server-only";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const qrPassesEnabled = () => process.env.QR_CHECKIN_ENABLED === "true";
export const receiptPattern = /^[A-Za-z0-9_-]{43}$/;
export const passPattern = /^FWP1\.[A-Za-z0-9_-]{43}$/;
export const hashSecret = (secret: string) => createHash("sha256").update(secret).digest("hex");
function key() {
  const raw = process.env.QR_PASS_SECRET ?? "";
  if (!receiptPattern.test(raw) || Buffer.from(raw, "base64url").length !== 32) throw new Error("QR pass key is not configured.");
  return Buffer.from(raw, "base64url");
}
function token(nonce: string) { return `FWP1.${createHmac("sha256", key()).update(`flatwaiver-pass-v1:${nonce}`).digest("base64url")}`; }
type PassRow = { id: string; nonce: string; token_hash: string; participant_index: number; revoked_at: string | null };
export type VisitorPass = { number: number; code: string; revoked: boolean };

/** Never stores raw tokens. Existing rows win concurrent/repeated issuance. */
export async function ensurePasses(signatureId: string, access: { actor: string } | { receipt: string }): Promise<VisitorPass[]> {
  const admin = createAdminClient();
  const { data: signed, error } = await admin.from("signed_waivers").select("participants").eq("id", signatureId).single();
  if (error || !signed) throw new Error("Passes are temporarily unavailable.");
  const count = Array.isArray(signed.participants) ? signed.participants.length : 1;
  const candidates = Array.from({ length: count }, (_, index) => { const nonce = randomUUID(); return { index, nonce, hash: hashSecret(token(nonce)) }; });
  const { data, error: issueError } = await admin.rpc("ensure_waiver_passes", {
    p_signature: signatureId, p_candidates: candidates,
    p_actor: "actor" in access ? access.actor : null, p_receipt: "receipt" in access ? access.receipt : null,
  });
  if (issueError || !data || data.length !== count) throw new Error("Passes are temporarily unavailable.");
  return (data as PassRow[]).map(row => {
    const code = token(row.nonce);
    // Key rotation never silently presents a QR that cannot be verified.
    if (hashSecret(code) !== row.token_hash) throw new Error("Pass key changed. Contact the venue administrator.");
    return { number: row.participant_index + 1, code, revoked: Boolean(row.revoked_at) };
  });
}

export async function receiptPasses(secret: string) {
  const receipt = hashSecret(secret);
  const { data, error } = await createAdminClient().from("waiver_pass_receipts").select("signed_waiver_id").eq("receipt_hash", receipt).maybeSingle();
  if (error) throw new Error("Passes are temporarily unavailable.");
  if (!data) return null;
  return ensurePasses(data.signed_waiver_id, { receipt });
}

export async function qrRateLimit(identity: string, limit: number) {
  const digest = createHmac("sha256", key()).update(`rate:${identity}`).digest("hex");
  const { data, error } = await createAdminClient().rpc("qr_consume_limit", { p_key: digest, p_limit: limit });
  if (error) throw new Error("Verification is temporarily unavailable.");
  return data === true;
}
