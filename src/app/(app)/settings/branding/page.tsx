import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgCaller } from "@/lib/auth";
import { BrandingForm } from "@/components/branding-form";
import { DataLoadError } from "@/components/data-load-error";
import { canManageBranding } from "@/lib/permissions";
import type { OrgBranding } from "@/lib/types";

export default async function BrandingPage() {
  const caller = await getOrgCaller();
  if (!caller) redirect("/login");

  const admin = createAdminClient();
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("branding")
    .eq("id", caller.orgId)
    .single();
  if (orgError || !org) return <DataLoadError retryHref="/settings/branding" />;
  const branding = (org?.branding as OrgBranding) ?? {};

  let logoUrl: string | null = null;
  if (branding.logo_path) {
    const { data, error } = await admin.storage
      .from("uploads")
      .createSignedUrl(branding.logo_path, 10 * 60);
    if (error || !data?.signedUrl) return <DataLoadError retryHref="/settings/branding" />;
    logoUrl = data.signedUrl;
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground">
        Your logo and brand color appear on the public signing page and in the
        header of every signed PDF — so waivers look like <em>your</em> business,
        not ours.
      </p>
      <BrandingForm
        className="mt-6"
        initialColor={branding.color ?? ""}
        logoUrl={logoUrl}
        canEdit={canManageBranding(caller.role)}
      />
    </div>
  );
}
