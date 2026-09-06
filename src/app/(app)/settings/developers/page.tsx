import { redirect } from "next/navigation";
import { getOrgCaller } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { DevelopersManager } from "@/components/developers-manager";
import { roleAtLeast } from "@/lib/permissions";
import { APP } from "@/lib/config";
import { DataLoadError } from "@/components/data-load-error";

export default async function DevelopersPage() {
  const caller = await getOrgCaller();
  if (!caller) redirect("/login");

  if (!roleAtLeast(caller.role, "admin")) {
    return (
      <div className="rounded-xl border border-border p-6">
        <h2 className="font-bold">Developers</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Only an owner or admin can manage API keys and webhooks.
        </p>
      </div>
    );
  }

  const admin = createAdminClient();
  const results = await Promise.all([
    admin
      .from("api_keys")
      .select("id, name, prefix, created_at, last_used_at, revoked_at")
      .eq("org_id", caller.orgId)
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
    admin
      .from("webhook_endpoints")
      .select("id, url, enabled, created_at")
      .eq("org_id", caller.orgId)
      .order("created_at", { ascending: false }),
    admin
      .from("webhook_deliveries")
      .select("id, endpoint_id, event, status_code, ok, error, created_at")
      .eq("org_id", caller.orgId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  if (results.some((result) => result.error)) {
    console.error(
      "Developer settings load failed",
      results.filter((result) => result.error).map((result) => result.error)
    );
    return (
      <div>
        <h1 className="text-2xl font-bold">Developers</h1>
        <DataLoadError
          className="mt-6"
          retryHref="/settings/developers"
          title="We couldn't load your integrations"
          description="Your API keys and webhook settings were not changed. Try loading them again."
        />
      </div>
    );
  }
  const [{ data: keys }, { data: webhooks }, { data: deliveries }] = results;

  return (
    <DevelopersManager
      apiBaseUrl={`${APP.url?.replace(/\/$/, "") ?? ""}/api/v1`}
      keys={(keys ?? []).map((k) => ({
        id: k.id,
        name: k.name,
        prefix: k.prefix,
        createdAt: k.created_at,
        lastUsedAt: k.last_used_at,
      }))}
      webhooks={(webhooks ?? []).map((w) => ({
        id: w.id,
        url: w.url,
        enabled: w.enabled,
        createdAt: w.created_at,
      }))}
      deliveries={(deliveries ?? []).map((d) => ({
        id: d.id,
        event: d.event,
        statusCode: d.status_code,
        ok: d.ok,
        error: d.error,
        createdAt: d.created_at,
      }))}
    />
  );
}
