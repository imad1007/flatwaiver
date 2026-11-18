"use server";

import { revalidatePath } from "next/cache";
import { requireOrgRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { kioskSettingsSchema } from "@/lib/kiosk-settings";
import type { OrgBranding } from "@/lib/types";

export async function updateKioskSettings(raw: unknown) {
  const caller = await requireOrgRole("owner");
  const kiosk = kioskSettingsSchema.parse(raw);
  const admin = createAdminClient();
  const { data: org, error } = await admin.from("organizations").select("branding").eq("id", caller.orgId).single();
  if (error || !org) throw new Error("Couldn't load kiosk settings. Please try again.");
  const { data, error: saveError } = await admin.from("organizations")
    .update({ branding: { ...((org.branding as OrgBranding | null) ?? {}), kiosk } })
    .eq("id", caller.orgId).select("id").maybeSingle();
  if (saveError || !data) throw new Error("Couldn't save kiosk settings. Please try again.");
  revalidatePath("/settings/kiosk");
}
