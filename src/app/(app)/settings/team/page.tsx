import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgCaller } from "@/lib/auth";
import { TeamManager } from "@/components/team-manager";
import { AuditLog } from "@/components/audit-log";
import { canManageTeam, normalizeRole } from "@/lib/permissions";
import type { AuditLogEntry } from "@/lib/types";

export default async function TeamPage() {
  const caller = await getOrgCaller();
  if (!caller) redirect("/login");

  const admin = createAdminClient();
  const [{ data: members }, { data: invites }, { data: log }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, email, role, created_at")
      .eq("org_id", caller.orgId)
      .order("created_at", { ascending: true }),
    admin
      .from("invitations")
      .select("id, email, role, created_at, expires_at")
      .eq("org_id", caller.orgId)
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
    admin
      .from("audit_log")
      .select("*")
      .eq("org_id", caller.orgId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <div className="space-y-8">
      <TeamManager
        currentUserId={caller.userId}
        currentRole={caller.role}
        members={(members ?? []).map((m) => ({
          id: m.id,
          email: m.email,
          role: normalizeRole(m.role),
          createdAt: m.created_at,
        }))}
        invites={(invites ?? []).map((i) => ({
          id: i.id,
          email: i.email,
          role: normalizeRole(i.role),
          expiresAt: i.expires_at,
        }))}
      />

      {canManageTeam(caller.role) && (
        <AuditLog entries={(log ?? []) as AuditLogEntry[]} />
      )}
    </div>
  );
}
