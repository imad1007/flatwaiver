"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrgRole } from "@/lib/auth";
import type { OrgBranding } from "@/lib/types";

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB
const LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

async function requireOrgId(): Promise<string> {
  return (await requireOrgRole("admin")).orgId;
}

async function getBranding(orgId: string): Promise<OrgBranding> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organizations")
    .select("branding")
    .eq("id", orgId)
    .single();
  if (error || !data) throw new Error("Couldn't load your branding. Please try again.");
  return (data?.branding as OrgBranding) ?? {};
}

async function saveBranding(orgId: string, branding: OrgBranding) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organizations")
    .update({ branding })
    .eq("id", orgId)
    .select("id")
    .maybeSingle();
  if (error || !data) throw new Error("Couldn't save your branding. Please try again.");
  revalidatePath("/settings/branding");
}

/** Save brand color and/or upload a new logo (multipart form). */
export async function updateBranding(formData: FormData) {
  const orgId = await requireOrgId();
  const branding = await getBranding(orgId);
  const previousLogoPath = branding.logo_path;
  let uploadedLogoPath: string | null = null;

  // Color
  const rawColor = String(formData.get("color") ?? "").trim();
  if (rawColor) {
    if (!/^#[0-9a-fA-F]{6}$/.test(rawColor)) {
      throw new Error("Brand color must be a hex value like #4F46E5.");
    }
    branding.color = rawColor.toUpperCase();
  } else {
    delete branding.color;
  }

  // Logo (optional)
  const file = formData.get("logo");
  if (file instanceof File && file.size > 0) {
    const ext = LOGO_TYPES[file.type];
    if (!ext) throw new Error("Logo must be a PNG, JPEG, or WebP image.");
    if (file.size > MAX_LOGO_BYTES) throw new Error("Logo must be 2 MB or smaller.");

    const admin = createAdminClient();
    const path = `${orgId}/branding/${crypto.randomUUID()}.${ext}`;
    const { error } = await admin.storage
      .from("uploads")
      .upload(path, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type,
        upsert: true,
      });
    if (error) throw new Error("Logo upload failed.");
    branding.logo_path = path;
    uploadedLogoPath = path;
  }

  try {
    await saveBranding(orgId, branding);
  } catch (error) {
    if (uploadedLogoPath) {
      await createAdminClient().storage.from("uploads").remove([uploadedLogoPath]);
    }
    throw error;
  }

  // The organization now points to the new asset. Old-file cleanup is safe to
  // retry later and must not turn a successful branding update into failure.
  if (uploadedLogoPath && previousLogoPath) {
    const { error } = await createAdminClient().storage
      .from("uploads")
      .remove([previousLogoPath]);
    if (error) console.error("Old branding logo cleanup failed", error);
  }
}

/** Remove the uploaded logo. */
export async function removeLogo() {
  const orgId = await requireOrgId();
  const branding = await getBranding(orgId);
  if (branding.logo_path) {
    const oldLogoPath = branding.logo_path;
    delete branding.logo_path;
    await saveBranding(orgId, branding);
    const admin = createAdminClient();
    const { error } = await admin.storage.from("uploads").remove([oldLogoPath]);
    if (error) console.error("Removed branding logo cleanup failed", error);
  }
}
