// Role + capability model for org members. PURE and client-safe — no server
// imports — so both server actions and client components share one source of
// truth. The server-side gate (requireOrgRole) lives in src/lib/auth.ts.

export type Role = "owner" | "admin" | "staff" | "viewer";

export const ROLES: Role[] = ["owner", "admin", "staff", "viewer"];

/** Roles you can assign to a teammate (you can never mint another owner). */
export const ASSIGNABLE_ROLES: Exclude<Role, "owner">[] = [
  "admin",
  "staff",
  "viewer",
];

const RANK: Record<Role, number> = { viewer: 0, staff: 1, admin: 2, owner: 3 };

export function normalizeRole(raw: string | null | undefined): Role {
  return raw === "owner" || raw === "admin" || raw === "staff" || raw === "viewer"
    ? raw
    : "viewer";
}

/** True when `role` is at least as privileged as `min`. */
export function roleAtLeast(role: Role, min: Role): boolean {
  return RANK[role] >= RANK[min];
}

// ── capabilities ──────────────────────────────────────────────
/** Invite/remove teammates and change their roles. */
export function canManageTeam(role: Role): boolean {
  return roleAtLeast(role, "admin");
}
/** Change the plan / open the billing portal. */
export function canManageBilling(role: Role): boolean {
  return roleAtLeast(role, "admin");
}
/** Change organization identity, logo, and signing-page colors. */
export function canManageBranding(role: Role): boolean {
  return roleAtLeast(role, "admin");
}
/** Create, edit, publish, and archive waiver templates. */
export function canManageTemplates(role: Role): boolean {
  return roleAtLeast(role, "staff");
}

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  staff: "Staff",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  owner: "Full access, including billing and removing teammates.",
  admin: "Manage waivers, team, and billing. Can't remove the owner.",
  staff: "Create and publish waivers, send signing links, view signatures.",
  viewer: "Read-only: view and export signed waivers. Can't edit anything.",
};
