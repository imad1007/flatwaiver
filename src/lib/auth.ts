import { createClient } from "@/lib/supabase/server";
import { normalizeRole, roleAtLeast, type Role } from "@/lib/permissions";
import type { Profile, Subscription } from "@/lib/types";

export interface SessionContext {
  userId: string;
  email: string;
  profile: Profile;
}

export interface OrgCaller {
  userId: string;
  email: string;
  orgId: string;
  role: Role;
}

/** Resolve the authenticated caller with their org + normalized role, or null. */
export async function getOrgCaller(): Promise<OrgCaller | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role, email")
    .eq("id", user.id)
    .single();
  if (!profile) return null;

  return {
    userId: user.id,
    email: user.email ?? profile.email,
    orgId: profile.org_id,
    role: normalizeRole(profile.role),
  };
}

/**
 * Gate for server actions / route handlers: resolve the caller and throw unless
 * their role is at least `min`. Returns the caller on success. Every privileged
 * action must call this itself — never trust a layout or the UI alone.
 */
export async function requireOrgRole(min: Role): Promise<OrgCaller> {
  const caller = await getOrgCaller();
  if (!caller) throw new Error("Not authenticated.");
  if (!roleAtLeast(caller.role, min)) {
    throw new Error("You don't have permission to do that.");
  }
  return caller;
}

/**
 * Resolve the authenticated user and their profile (org membership).
 * Returns null when not signed in or not yet bootstrapped.
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!profile) return null;

  return { userId: user.id, email: user.email ?? profile.email, profile };
}

export async function getOrgSubscription(): Promise<Subscription | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("subscriptions").select("*").single();
  return data ?? null;
}
