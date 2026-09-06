import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgCaller } from "@/lib/auth";
import { TeamManager } from "@/components/team-manager";
import { AuditLog } from "@/components/audit-log";
import { DataLoadError } from "@/components/data-load-error";
import { canManageTeam, normalizeRole } from "@/lib/permissions";
import type { AuditLogEntry } from "@/lib/types";

export default async function TeamPage() {
  const caller = await getOrgCaller();
  if (!caller) redirect("/login");

  const admin = createAdminClient();
  const [membersResult, invitesResult, logResult] = await Promise.all([
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
  const loadFailed = Boolean(
    membersResult.error ||
      invitesResult.error ||
      (canManageTeam(caller.role) && logResult.error)
  );

  if (loadFailed) {
    return (
      <DataLoadError
        title="We couldn't load your team"
        description="No team information was changed. Try loading this page again."
        retryHref="/settings/team"
      />
    );
  }

  const members = membersResult.data;
  const invites = invitesResult.data;
  const log = logResult.data;

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
