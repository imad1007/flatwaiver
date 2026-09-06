import { redirect } from "next/navigation";
import { getOrgCaller } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canManageBranding } from "@/lib/permissions";
import { AccountForm } from "@/components/account-form";
import { DataLoadError } from "@/components/data-load-error";

export default async function AccountPage() {
  const caller = await getOrgCaller();
  if (!caller) redirect("/login");
  const supabase = await createClient();
  const { data: org, error } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", caller.orgId)
    .single();
  if (error || !org) return <DataLoadError retryHref="/settings/account" />;
  return <AccountForm email={caller.email} orgName={org.name} canEditBusiness={canManageBranding(caller.role)} />;
}
