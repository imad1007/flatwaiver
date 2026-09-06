import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WaiverEditor } from "@/components/waiver-editor";
import { WaiverRenewalSetting } from "@/components/waiver-renewal-setting";
import { WaiverPhotoSetting } from "@/components/waiver-photo-setting";
import { DataLoadError } from "@/components/data-load-error";
import type { TemplateVersion, WaiverTemplate } from "@/lib/types";

export default async function WaiverEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: template, error: templateError } = await supabase
    .from("waiver_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (templateError) {
    return (
      <DataLoadError
        retryHref={`/waivers/${id}`}
        title="We couldn't load this waiver"
        description="Your draft and published versions are still safe. Try loading the editor again."
      />
    );
  }
  if (!template) notFound();

  const { data: versions, error: versionsError } = await supabase
    .from("template_versions")
    .select("id, template_id, version_number, minor_mode, content_sha256, created_at")
    .eq("template_id", id)
    .order("version_number", { ascending: false });
  if (versionsError) {
    return (
      <DataLoadError
        retryHref={`/waivers/${id}`}
        title="We couldn't load this waiver's versions"
        description="Editing is paused so an incorrect next version cannot be published. Try again."
      />
    );
  }

  const typedTemplate = template as WaiverTemplate;

  return (
    <div className="space-y-6">
      <WaiverEditor
        template={typedTemplate}
        versions={(versions ?? []) as Pick<
          TemplateVersion,
          "id" | "template_id" | "version_number" | "minor_mode" | "content_sha256" | "created_at"
        >[]}
      />
      <WaiverRenewalSetting
        templateId={typedTemplate.id}
        expiryMonths={typedTemplate.expiry_months ?? null}
      />
      <WaiverPhotoSetting
        templateId={typedTemplate.id}
        photoMode={typedTemplate.photo_mode ?? "off"}
      />
    </div>
  );
}
