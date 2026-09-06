"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrgRole } from "@/lib/auth";

/** Rename the business (org). Shown in the sidebar, signing pages, and PDFs. */
export async function updateBusinessName(rawName: string) {
  const name = z.string().trim().min(2).max(120).parse(rawName);

  const caller = await requireOrgRole("admin");

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("organizations")
    .update({ name })
    .eq("id", caller.orgId)
    .select("id")
    .maybeSingle();
  if (error || !updated) throw new Error("Couldn't save the business name.");

  revalidatePath("/", "layout");
  return { ok: true };
}
