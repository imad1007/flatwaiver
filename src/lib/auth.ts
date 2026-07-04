import { createClient } from "@/lib/supabase/server";
import type { Profile, Subscription } from "@/lib/types";

export interface SessionContext {
  userId: string;
  email: string;
  profile: Profile;
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
