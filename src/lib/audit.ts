import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Append one row to an org's audit trail. Best-effort: an audit failure must
 * never break the operation it's recording, so this swallows and logs errors.
 * Writes via the service role (audit_log has no insert policy — see 0010).
 */
export async function logAudit(entry: {
  orgId: string;
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  target?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("audit_log").insert({
      org_id: entry.orgId,
      actor_id: entry.actorId ?? null,
      actor_email: entry.actorEmail ?? null,
      action: entry.action,
      target: entry.target ?? null,
      metadata: entry.metadata ?? {},
    });
  } catch (err) {
    console.error("logAudit failed", err);
  }
}
