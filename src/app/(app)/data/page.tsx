import { requireOrgRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DataManagement } from "@/components/data-management";

export default async function DataPage() {
  await requireOrgRole("owner");
  const db = await createClient();
  const templates: { id: string; name: string }[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db
      .from("waiver_templates")
      .select("id,name")
      .order("id")
      .range(offset, offset + 499);
    if (error) throw new Error("Couldn't load waiver filters.");
    templates.push(...data);
    if (data.length < 500) break;
  }
  return <DataManagement templates={templates} />;
}
