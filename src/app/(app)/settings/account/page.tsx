import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AccountForm } from "@/components/account-form";
import { DataLoadError } from "@/components/data-load-error";
import { canManageBranding, normalizeRole } from "@/lib/permissions";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Read account data through the service-role client after authenticating the
  // user. This avoids making the page depend on a second RLS-scoped profile
  // lookup during client navigation.
  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("org_id, role, email")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile) {
    return <DataLoadError retryHref="/settings/account" />;
  }

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("name")
    .eq("id", profile.org_id)
    .maybeSingle();
  if (orgError || !org) return <DataLoadError retryHref="/settings/account" />;

  return (
    <AccountForm
      email={user.email ?? profile.email}
      orgName={org.name}
      canEditBusiness={canManageBranding(normalizeRole(profile.role))}
    />
  );
}
