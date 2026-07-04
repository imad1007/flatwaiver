import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WaiverEditor } from "@/components/waiver-editor";
import type { TemplateVersion, WaiverTemplate } from "@/lib/types";

export default async function WaiverEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: template } = await supabase
    .from("waiver_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!template) notFound();

  const { data: versions } = await supabase
    .from("template_versions")
    .select("id, template_id, version_number, minor_mode, content_sha256, created_at")
    .eq("template_id", id)
    .order("version_number", { ascending: false });

  return (
    <WaiverEditor
      template={template as WaiverTemplate}
      versions={(versions ?? []) as Pick<
        TemplateVersion,
        "id" | "template_id" | "version_number" | "minor_mode" | "content_sha256" | "created_at"
      >[]}
    />
  );
}
