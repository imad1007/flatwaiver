"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OrgBranding } from "@/lib/types";

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB
const LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

async function requireOrgId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("No profile.");
  return profile.org_id;
}

async function getBranding(orgId: string): Promise<OrgBranding> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("organizations")
    .select("branding")
    .eq("id", orgId)
    .single();
  return (data?.branding as OrgBranding) ?? {};
}

async function saveBranding(orgId: string, branding: OrgBranding) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("organizations")
    .update({ branding })
    .eq("id", orgId);
  if (error) throw error;
  revalidatePath("/settings/branding");
}

/** Save brand color and/or upload a new logo (multipart form). */
export async function updateBranding(formData: FormData) {
  const orgId = await requireOrgId();
  const branding = await getBranding(orgId);

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
    const path = `${orgId}/branding/logo.${ext}`;

    // Replace any previous logo with a different extension.
    if (branding.logo_path && branding.logo_path !== path) {
      await admin.storage.from("uploads").remove([branding.logo_path]);
    }
    const { error } = await admin.storage
      .from("uploads")
      .upload(path, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type,
        upsert: true,
      });
    if (error) throw new Error("Logo upload failed.");
    branding.logo_path = path;
  }

  await saveBranding(orgId, branding);
}

/** Remove the uploaded logo. */
export async function removeLogo() {
  const orgId = await requireOrgId();
  const branding = await getBranding(orgId);
  if (branding.logo_path) {
    const admin = createAdminClient();
    await admin.storage.from("uploads").remove([branding.logo_path]);
    delete branding.logo_path;
    await saveBranding(orgId, branding);
  }
}
