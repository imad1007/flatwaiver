import "server-only";

import type { User } from "@supabase/supabase-js";
import { logAudit } from "@/lib/audit";
import { APP } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;
type ProfileSummary = { id: string; org_id: string; role: string };

/**
 * Idempotently attach an authenticated user to an invited organization or
 * create their own organization and trial. All reads fail closed: a temporary
 * database error must never be mistaken for "no profile" or "no invitation".
 */
export async function ensureBootstrapped(user: User): Promise<void> {
  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("profiles")
    .select("id, org_id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing) {
    await repairExistingBootstrap(admin, user, existing);
    return;
  }

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
    .select("id, created_at")
    .single();
  if (orgError) throw orgError;

  const { error: profileError } = await admin.from("profiles").insert({
    id: user.id,
    org_id: org.id,
    email: user.email ?? "",
    role: "owner",
  });

  if (profileError) {
    const { data: winner, error: winnerError } = await admin
      .from("profiles")
      .select("id, org_id, role")
      .eq("id", user.id)
      .maybeSingle();

    // This organization was created by this invocation and never won the
    // profile race. Remove only that exact orphan; FK protection keeps this safe.
    await admin.from("organizations").delete().eq("id", org.id);

    if (winnerError) throw winnerError;
    if (!winner) throw profileError;
    await repairExistingBootstrap(admin, user, winner);
    return;
  }

  await ensureOwnerSubscription(admin, org.id, org.created_at);
}

async function repairExistingBootstrap(
  admin: AdminClient,
  user: User,
  profile: ProfileSummary
): Promise<void> {
  if (profile.role === "owner") {
    await ensureOwnerSubscription(admin, profile.org_id);
    return;
  }

  const email = (user.email ?? "").trim().toLowerCase();
  if (!email) return;
  const { data: invitations, error: readError } = await admin
    .from("invitations")
    .select("id, email")
    .eq("org_id", profile.org_id)
    .is("accepted_at", null)
    .ilike("email", email);
  if (readError) throw readError;
  const matchingIds = (invitations ?? [])
    .filter((invite) => invite.email.trim().toLowerCase() === email)
    .map((invite) => invite.id);
  if (matchingIds.length === 0) return;

  const acceptedAt = new Date().toISOString();
  const { error } = await admin
    .from("invitations")
    .update({ accepted_at: acceptedAt })
    .in("id", matchingIds);
  if (error) throw error;
}

async function ensureOwnerSubscription(
  admin: AdminClient,
  orgId: string,
  knownCreatedAt?: string
): Promise<void> {
  let createdAt = knownCreatedAt;
  if (!createdAt) {
    const { data: org, error } = await admin
      .from("organizations")
      .select("created_at")
      .eq("id", orgId)
      .single();
    if (error) throw error;
    createdAt = org.created_at;
  }
  if (!createdAt) throw new Error("Organization creation time is missing.");

  const trialEndsAt = new Date(
    new Date(createdAt).getTime() + APP.trialDays * 24 * 60 * 60 * 1000
  ).toISOString();
  const { error } = await admin.from("subscriptions").upsert(
    { org_id: orgId, status: "trialing", trial_ends_at: trialEndsAt },
    { onConflict: "org_id", ignoreDuplicates: true }
  );
  if (error) throw error;
}

/** Enroll a new user into the newest valid invitation for their exact email. */
async function joinPendingInvite(admin: AdminClient, user: User): Promise<boolean> {
  const email = (user.email ?? "").trim().toLowerCase();
  if (!email) return false;

  const { data: invites, error: invitesError } = await admin
    .from("invitations")
    .select("id, org_id, role, email, expires_at, created_at")
    .is("accepted_at", null)
    .ilike("email", email)
    .order("created_at", { ascending: false });
  if (invitesError) throw invitesError;

  const invite = (invites ?? []).find(
    (candidate) =>
      candidate.email.trim().toLowerCase() === email &&
      new Date(candidate.expires_at).getTime() > Date.now()
  );
  if (!invite) return false;

  const { error: profileError } = await admin.from("profiles").insert({
    id: user.id,
    org_id: invite.org_id,
    email: user.email ?? "",
    role: invite.role,
  });
  if (profileError) throw profileError;

  const { error: acceptError } = await admin
    .from("invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);
  if (acceptError) throw acceptError;

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
