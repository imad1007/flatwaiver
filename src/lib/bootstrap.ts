import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { APP } from "@/lib/config";
import type { User } from "@supabase/supabase-js";

/**
 * Idempotent org bootstrap: ensures the authenticated user has an
 * organization, profile, and trial subscription. Business name and waiver
 * volume band come from signup user_metadata. Runs with the service role
 * because profiles/organizations have no insert policies.
 *
 * Invited teammates (an email with a pending invitation) JOIN the inviting org
 * as their invited role instead of getting a fresh org — this email match, not
 * the invite token, is what actually enrolls them (see 0010).
 */
export async function ensureBootstrapped(user: User): Promise<void> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (existing) return;

  if (await joinPendingInvite(admin, user)) return;

  const meta = (user.user_metadata ?? {}) as {
    business_name?: string;
    waiver_volume_band?: string;
  };

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({
      name: meta.business_name || user.email || "My Business",
      waiver_volume_band: meta.waiver_volume_band ?? null,
    })
    .select("id")
    .single();
  if (orgError) throw orgError;

  const { error: profileError } = await admin.from("profiles").insert({
    id: user.id,
    org_id: org.id,
    email: user.email ?? "",
    role: "owner",
  });
  if (profileError) throw profileError;

  const trialEnds = new Date(
    Date.now() + APP.trialDays * 24 * 60 * 60 * 1000
  ).toISOString();
  const { error: subError } = await admin.from("subscriptions").insert({
    org_id: org.id,
    status: "trialing",
    trial_ends_at: trialEnds,
  });
  if (subError) throw subError;
}

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * If this user's email has a valid pending invitation, enroll them in that org
 * as the invited role (no new org, no new trial) and mark the invite accepted.
 * Returns true when the user was enrolled this way. Uses lower(email) matching
 * and re-checks the address in JS because ILIKE treats %/_ as wildcards.
 */
async function joinPendingInvite(admin: AdminClient, user: User): Promise<boolean> {
  const email = (user.email ?? "").trim().toLowerCase();
  if (!email) return false;

  const { data: invites } = await admin
    .from("invitations")
    .select("id, org_id, role, email, expires_at")
    .is("accepted_at", null)
    .ilike("email", email);

  const invite = (invites ?? []).find(
    (i) =>
      i.email.toLowerCase() === email &&
      new Date(i.expires_at).getTime() > Date.now()
  );
  if (!invite) return false;

  const { error: profileError } = await admin.from("profiles").insert({
    id: user.id,
    org_id: invite.org_id,
    email: user.email ?? "",
    role: invite.role,
  });
  if (profileError) throw profileError;

  await admin
    .from("invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  await logAudit({
    orgId: invite.org_id,
    actorId: user.id,
    actorEmail: user.email,
    action: "member.joined",
    target: user.email,
    metadata: { role: invite.role },
  });
  return true;
}
