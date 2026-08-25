"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrgRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { sendTeamInviteEmail } from "@/lib/email";
import { APP } from "@/lib/config";
import { ROLE_LABEL, normalizeRole, type Role } from "@/lib/permissions";

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.");
const assignableRole = z.enum(["admin", "staff", "viewer"]);

/** Invite a teammate by email. Admin+; only the owner may grant/lower 'admin'. */
export async function inviteMember(rawEmail: string, rawRole: string) {
  const caller = await requireOrgRole("admin");
  const email = emailSchema.parse(rawEmail);
  const role = assignableRole.parse(rawRole);

  if (role === "admin" && caller.role !== "owner") {
    throw new Error("Only the owner can invite an admin.");
  }
  if (email === caller.email.trim().toLowerCase()) {
    throw new Error("That's your own address — you're already on the team.");
  }

  const admin = createAdminClient();

  // Already a member of this org?
  const { data: members } = await admin
    .from("profiles")
    .select("email")
    .eq("org_id", caller.orgId);
  if ((members ?? []).some((m) => m.email.trim().toLowerCase() === email)) {
    throw new Error("That person is already on your team.");
  }

  const { data: invite, error } = await admin
    .from("invitations")
    .upsert(
      {
        org_id: caller.orgId,
        email,
        role,
        invited_by: caller.userId,
        // Re-issue a fresh token + window when re-inviting the same address.
        token: crypto.randomUUID(),
        expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        accepted_at: null,
      },
      { onConflict: "org_id,email" }
    )
    .select("token")
    .single();
  if (error || !invite) throw new Error("Couldn't create the invitation. Please try again.");

  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", caller.orgId)
    .single();

  await sendTeamInviteEmail({
    to: email,
    orgName: org?.name ?? APP.name,
    inviterEmail: caller.email,
    roleLabel: ROLE_LABEL[role],
    acceptUrl: `${APP.url}/invite/${invite.token}`,
  });

  await logAudit({
    orgId: caller.orgId,
    actorId: caller.userId,
    actorEmail: caller.email,
    action: "member.invited",
    target: email,
    metadata: { role },
  });

  revalidatePath("/settings/team");
  return { ok: true };
}

/** Revoke a pending (unaccepted) invitation. */
export async function revokeInvite(inviteId: string) {
  const caller = await requireOrgRole("admin");
  const admin = createAdminClient();

  const { data: invite } = await admin
    .from("invitations")
    .select("id, org_id, email")
    .eq("id", inviteId)
    .maybeSingle();
  if (!invite || invite.org_id !== caller.orgId) throw new Error("Invitation not found.");

  await admin.from("invitations").delete().eq("id", inviteId);
  await logAudit({
    orgId: caller.orgId,
    actorId: caller.userId,
    actorEmail: caller.email,
    action: "member.invite_revoked",
    target: invite.email,
  });

  revalidatePath("/settings/team");
  return { ok: true };
}

/** Change a member's role. Can't touch the owner; only the owner manages admins. */
export async function changeMemberRole(memberId: string, rawRole: string) {
  const caller = await requireOrgRole("admin");
  const role = assignableRole.parse(rawRole);
  const target = await loadOrgMember(memberId, caller.orgId);

  if (target.id === caller.userId) throw new Error("You can't change your own role.");
  if (target.role === "owner") throw new Error("The owner's role can't be changed.");
  if ((role === "admin" || target.role === "admin") && caller.role !== "owner") {
    throw new Error("Only the owner can manage admins.");
  }

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ role }).eq("id", memberId);
  if (error) throw new Error("Couldn't update the role. Please try again.");

  await logAudit({
    orgId: caller.orgId,
    actorId: caller.userId,
    actorEmail: caller.email,
    action: "member.role_changed",
    target: target.email,
    metadata: { from: target.role, to: role },
  });

  revalidatePath("/settings/team");
  return { ok: true };
}

/** Remove a member from the org (deletes their profile → revokes org access). */
export async function removeMember(memberId: string) {
  const caller = await requireOrgRole("admin");
  const target = await loadOrgMember(memberId, caller.orgId);

  if (target.id === caller.userId) throw new Error("You can't remove yourself.");
  if (target.role === "owner") throw new Error("The owner can't be removed.");
  if (target.role === "admin" && caller.role !== "owner") {
    throw new Error("Only the owner can remove an admin.");
  }

  const admin = createAdminClient();
  // Delete the profile only. The auth user survives; without a profile they get
  // a fresh org on next login, so removal cleanly severs access to THIS org.
  const { error } = await admin.from("profiles").delete().eq("id", memberId);
  if (error) throw new Error("Couldn't remove the member. Please try again.");

  await logAudit({
    orgId: caller.orgId,
    actorId: caller.userId,
    actorEmail: caller.email,
    action: "member.removed",
    target: target.email,
    metadata: { role: target.role },
  });

  revalidatePath("/settings/team");
  return { ok: true };
}

async function loadOrgMember(
  memberId: string,
  orgId: string
): Promise<{ id: string; email: string; role: Role }> {
  const admin = createAdminClient();
  const { data: member } = await admin
    .from("profiles")
    .select("id, email, role, org_id")
    .eq("id", memberId)
    .maybeSingle();
  if (!member || member.org_id !== orgId) throw new Error("Member not found.");
  return { id: member.id, email: member.email, role: normalizeRole(member.role) };
}
