"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  inviteMember,
  revokeInvite,
  changeMemberRole,
  removeMember,
} from "@/app/(app)/settings/team/actions";
import {
  ASSIGNABLE_ROLES,
  ROLE_DESCRIPTION,
  ROLE_LABEL,
  canManageTeam,
  type Role,
} from "@/lib/permissions";

const inputClass =
  "rounded-md border border-input bg-card px-3 py-2 text-sm focus:border-ring focus:outline-none";

interface Member {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
}
interface Invite {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
}

export function TeamManager({
  currentUserId,
  currentRole,
  members,
  invites,
}: {
  currentUserId: string;
  currentRole: Role;
  members: Member[];
  invites: Invite[];
}) {
  const manage = canManageTeam(currentRole);
  // Only the owner can grant/manage admins; a plain admin can't.
  const invitableRoles = ASSIGNABLE_ROLES.filter(
    (r) => r !== "admin" || currentRole === "owner"
  );

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("staff");
  const [inviting, startInvite] = useTransition();

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    startInvite(async () => {
      try {
        await inviteMember(email, role);
        toast.success(`Invitation sent to ${email}`);
        setEmail("");
        setRole("staff");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't send the invite.");
      }
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-bold">Team</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Invite staff to your account and control what each person can do.
          Everyone signs in with their own email.
        </p>
      </div>

      {manage && (
        <section className="rounded-xl border border-border p-5">
          <h3 className="font-semibold">Invite a teammate</h3>
          <form onSubmit={handleInvite} className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@yourbusiness.com"
              aria-label="Teammate email"
              className={`${inputClass} min-w-56 flex-1`}
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              aria-label="Role"
              className={inputClass}
            >
              {invitableRoles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
            <Button type="submit" disabled={inviting || !email.trim()}>
              {inviting ? "Sending…" : "Send invite"}
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">{ROLE_DESCRIPTION[role]}</p>
        </section>
      )}

      <section className="rounded-xl border border-border">
        <div className="border-b border-border px-5 py-3">
          <h3 className="font-semibold">
            Members <span className="text-muted-foreground">({members.length})</span>
          </h3>
        </div>
        <ul className="divide-y divide-border">
          {members.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              isSelf={m.id === currentUserId}
              currentRole={currentRole}
            />
          ))}
        </ul>
      </section>

      {invites.length > 0 && (
        <section className="rounded-xl border border-border">
          <div className="border-b border-border px-5 py-3">
            <h3 className="font-semibold">
              Pending invitations{" "}
              <span className="text-muted-foreground">({invites.length})</span>
            </h3>
          </div>
          <ul className="divide-y divide-border">
            {invites.map((inv) => (
              <InviteRow key={inv.id} invite={inv} manage={manage} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function MemberRow({
  member,
  isSelf,
  currentRole,
}: {
  member: Member;
  isSelf: boolean;
  currentRole: Role;
}) {
  const [pending, start] = useTransition();
  const [selectedRole, setSelectedRole] = useState(member.role);
  const manage = canManageTeam(currentRole);
  // A row is editable only if the caller can manage the team, it isn't the
  // owner, it isn't the caller's own row, and (for admin targets) the caller is
  // the owner. The server re-checks all of this — this just hides dead controls.
  const editable =
    manage &&
    member.role !== "owner" &&
    !isSelf &&
    (member.role !== "admin" || currentRole === "owner");

  function onRole(next: string) {
    const nextRole = next as Role;
    const previousRole = selectedRole;
    setSelectedRole(nextRole);
    start(async () => {
      try {
        await changeMemberRole(member.id, nextRole);
        toast.success("Role updated");
      } catch (err) {
        setSelectedRole(previousRole);
        toast.error(err instanceof Error ? err.message : "Couldn't update the role.");
      }
    });
  }
  function onRemove() {
    if (!confirm(`Remove ${member.email} from the team?`)) return;
    start(async () => {
      try {
        await removeMember(member.id);
        toast.success(`Removed ${member.email}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't remove the member.");
      }
    });
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {member.email}
          {isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {editable ? (
          <select
            value={selectedRole}
            onChange={(e) => onRole(e.target.value)}
            disabled={pending}
            aria-label={`Role for ${member.email}`}
            className={inputClass}
          >
            {ASSIGNABLE_ROLES.filter(
              (r) => r !== "admin" || currentRole === "owner"
            ).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        ) : (
          <Badge variant={member.role === "owner" ? "default" : "secondary"}>
            {ROLE_LABEL[member.role]}
          </Badge>
        )}
        {editable && (
          <Button variant="ghost" size="sm" onClick={onRemove} disabled={pending}>
            Remove
          </Button>
        )}
      </div>
    </li>
  );
}

function InviteRow({ invite, manage }: { invite: Invite; manage: boolean }) {
  const [pending, start] = useTransition();
  function onRevoke() {
    start(async () => {
      try {
        await revokeInvite(invite.id);
        toast.success("Invitation revoked");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't revoke the invite.");
      }
    });
  }
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{invite.email}</p>
        <p className="text-xs text-muted-foreground">
          Invited as {ROLE_LABEL[invite.role]} · expires{" "}
          {new Date(invite.expiresAt).toLocaleDateString()}
        </p>
      </div>
      {manage && (
        <Button variant="ghost" size="sm" onClick={onRevoke} disabled={pending}>
          Revoke
        </Button>
      )}
    </li>
  );
}
