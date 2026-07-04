import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { subscriptionIsUsable } from "@/lib/types";
import type { OrgBranding, TemplateVersion } from "@/lib/types";

export interface PublicBranding {
  /** Hex brand color, validated. */
  color: string | null;
  /** Short-lived signed URL for the logo (page display). */
  logoUrl: string | null;
  /** Storage path of the logo (server-side PDF embedding). */
  logoPath: string | null;
}

export interface PublicWaiver {
  templateId: string;
  orgId: string;
  orgName: string;
  name: string;
  slug: string;
  version: TemplateVersion;
  branding: PublicBranding;
  /** false when the org's subscription lapsed — signing is paused. */
  acceptingSignatures: boolean;
}

/**
 * Resolve a public signing page by slug via the service role.
 * Only published templates with a current version resolve.
 * (Anonymous visitors never talk to Supabase directly — this runs server-side.)
 */
export async function getPublishedWaiverBySlug(
  slug: string
): Promise<PublicWaiver | null> {
  const admin = createAdminClient();

  const { data: template } = await admin
    .from("waiver_templates")
    .select("id, org_id, name, slug, status, current_version_id")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!template || !template.current_version_id) return null;

  const [{ data: version }, { data: org }, { data: sub }] = await Promise.all([
    admin
      .from("template_versions")
      .select("*")
      .eq("id", template.current_version_id)
      .single(),
    admin
      .from("organizations")
      .select("name, branding")
      .eq("id", template.org_id)
      .single(),
    admin
      .from("subscriptions")
      .select("status")
      .eq("org_id", template.org_id)
      .maybeSingle(),
  ]);
  if (!version) return null;

  // Branding: validated color + signed logo URL (long enough for a slow read)
  const rawBranding = (org?.branding as OrgBranding | null) ?? {};
  const color =
    rawBranding.color && /^#[0-9a-fA-F]{6}$/.test(rawBranding.color)
      ? rawBranding.color
      : null;
  let logoUrl: string | null = null;
  if (rawBranding.logo_path) {
    const { data } = await admin.storage
      .from("uploads")
      .createSignedUrl(rawBranding.logo_path, 60 * 60);
    logoUrl = data?.signedUrl ?? null;
  }

  return {
    templateId: template.id,
    orgId: template.org_id,
    orgName: org?.name ?? "",
    name: template.name,
    slug: template.slug,
    version: version as TemplateVersion,
    branding: { color, logoUrl, logoPath: rawBranding.logo_path ?? null },
    acceptingSignatures: subscriptionIsUsable(sub?.status),
  };
}
