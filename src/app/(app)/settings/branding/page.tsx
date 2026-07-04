import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BrandingForm } from "@/components/branding-form";
import type { OrgBranding } from "@/lib/types";

export default async function BrandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("branding")
    .eq("id", profile.org_id)
    .single();
  const branding = (org?.branding as OrgBranding) ?? {};

  let logoUrl: string | null = null;
  if (branding.logo_path) {
    const { data } = await admin.storage
      .from("uploads")
      .createSignedUrl(branding.logo_path, 10 * 60);
    logoUrl = data?.signedUrl ?? null;
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
      />
    </div>
  );
}
