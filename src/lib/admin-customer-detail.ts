import "server-only";
import { z } from "zod";
import { assertAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

/** Every query is scoped to one organization, after independent admin auth. */
export async function getAdminCustomerDetail(orgId: string) {
  await assertAdmin();
  if (!z.string().uuid().safeParse(orgId).success) return null;
  const admin = createAdminClient({ noStore: true });
  const { data: customer, error } = await admin.from("admin_org_overview")
    .select("*").eq("org_id", orgId).maybeSingle();
  if (error) throw error;
  if (!customer) return null;
  const [templates, signatures, members, owner] = await Promise.all([
    admin.from("waiver_templates").select("id,name,slug,status").eq("org_id", orgId)
      .order("created_at", { ascending: false }).limit(20),
    admin.from("signed_waivers").select("id,template_id,signed_at,flagged")
      .eq("org_id", orgId).order("signed_at", { ascending: false }).order("id").limit(20),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    customer.owner_user_id ? admin.auth.admin.getUserById(customer.owner_user_id) : Promise.resolve(null),
  ]);
  for (const result of [templates, signatures, members, owner]) {
    if (result?.error) throw result.error;
  }
  const waivers = await Promise.all((templates.data ?? []).map(async template => {
    const result = await admin.from("signed_waivers").select("id", { count: "exact", head: true })
      .eq("org_id", orgId).eq("template_id", template.id);
    if (result.error) throw result.error;
    return { ...template, signatureCount: result.count ?? 0 };
  }));
  return { customer, waivers, recent: signatures.data ?? [], memberCount: members.count ?? 0, owner: owner?.data.user ?? null, now: Date.now() };
}
