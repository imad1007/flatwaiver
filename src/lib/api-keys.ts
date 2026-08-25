import "server-only";

import { createHash, randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const PREFIX = "fw_live_";

/** Mint a new key. Returns the plaintext (shown once), its display prefix, and the stored hash. */
export function generateApiKey(): { full: string; prefix: string; hash: string } {
  const random = randomBytes(24).toString("base64url");
  const full = `${PREFIX}${random}`;
  return {
    full,
    prefix: full.slice(0, PREFIX.length + 6),
    hash: hashApiKey(full),
  };
}

export function hashApiKey(full: string): string {
  return createHash("sha256").update(full).digest("hex");
}

export interface ApiAuth {
  orgId: string;
  keyId: string;
}

/**
 * Authenticate an inbound request by its `Authorization: Bearer <key>` header.
 * Resolves the org via the key's sha256 hash (service role), rejects revoked
 * keys, and best-effort stamps last_used_at. Returns null on any failure.
 */
export async function authenticateApiKey(request: Request): Promise<ApiAuth | null> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return null;
  const token = match[1].trim();
  if (!token.startsWith(PREFIX)) return null;

  const admin = createAdminClient();
  const { data: key } = await admin
    .from("api_keys")
    .select("id, org_id, revoked_at")
    .eq("token_hash", hashApiKey(token))
    .maybeSingle();
  if (!key || key.revoked_at) return null;

  await admin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", key.id);

  return { orgId: key.org_id, keyId: key.id };
}
