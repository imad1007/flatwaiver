import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { APP } from "@/lib/config";
import type { User } from "@supabase/supabase-js";

/**
 * Idempotent org bootstrap: ensures the authenticated user has an
 * organization, profile, and trial subscription. Business name and waiver
 * volume band come from signup user_metadata. Runs with the service role
 * because profiles/organizations have no insert policies.
 */
export async function ensureBootstrapped(user: User): Promise<void> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (existing) return;

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
