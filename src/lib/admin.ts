import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Platform-admin gate. Admins are a fixed allowlist of emails in the
 * ADMIN_EMAILS env var (comma-separated) — deliberately NOT a DB column, so a
 * compromised or mis-written `profiles` row can never escalate someone to
 * cross-tenant god-mode. Fail closed: no env var → nobody is an admin.
 *
 * ADMIN_EMAILS is server-only (never NEXT_PUBLIC) — it must not reach the client.
 */
export function isPlatformAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const target = email.trim().toLowerCase();
  return adminEmails().includes(target);
}

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Resolve the current user IFF they are a platform admin, else null.
 * Used by the /admin layout (which redirects on null). Every admin server
 * action must call `assertAdmin()` independently — never trust the layout alone.
 */
export async function getAdminUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isPlatformAdmin(user.email)) return null;
  return user;
}

/**
 * Defense-in-depth guard for admin server actions and route handlers. Throws if
 * the caller is not a platform admin. Returns the admin user on success.
 */
export async function assertAdmin() {
  const user = await getAdminUser();
  if (!user) throw new Error("Not authorized");
  return user;
}
