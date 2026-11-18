import { redirect } from "next/navigation";
import { getOrgCaller } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { KioskSettingsForm } from "@/components/kiosk-settings-form";
import { DataLoadError } from "@/components/data-load-error";
import { readKioskSettings } from "@/lib/kiosk-settings";
import type { OrgBranding, WaiverField } from "@/lib/types";

export default async function KioskSettingsPage() {
  const caller = await getOrgCaller();
  if (!caller) redirect("/login");
  const db = await createClient();
  const [org, templates] = await Promise.all([
    db.from("organizations").select("branding").eq("id", caller.orgId).single(),
    db.from("waiver_templates").select("id, name, current_version_id").eq("status", "published").order("name"),
  ]);
  if (org.error || templates.error) return <DataLoadError retryHref="/settings/kiosk" />;
  const ids = (templates.data ?? []).map(template => template.current_version_id).filter(Boolean);
  const versions = ids.length ? await db.from("template_versions").select("id, fields").in("id", ids) : { data: [], error: null };
  if (versions.error) return <DataLoadError retryHref="/settings/kiosk" />;
  const fields = new Map((versions.data ?? []).map(version => [version.id, version.fields as WaiverField[]]));
  return <div>
    <h1 className="text-2xl font-bold">Kiosk experience</h1>
    <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Welcome visitors in English or French and simplify optional questions on shared devices. Required questions, signatures and legal acknowledgments always remain. Change field requirements in the waiver editor and publish a new version.</p>
    <KioskSettingsForm canEdit={caller.role === "owner"} initial={readKioskSettings((org.data?.branding as OrgBranding | null)?.kiosk)} templates={(templates.data ?? []).map(template => ({ id: template.id, name: template.name, fields: fields.get(template.current_version_id) ?? [] }))} />
  </div>;
}
