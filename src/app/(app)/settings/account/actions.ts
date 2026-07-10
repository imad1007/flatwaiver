"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Rename the business (org). Shown in the sidebar, signing pages, and PDFs. */
export async function updateBusinessName(rawName: string) {
  const name = z.string().trim().min(2).max(120).parse(rawName);

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

  const admin = createAdminClient();
  const { error } = await admin
    .from("organizations")
    .update({ name })
    .eq("id", profile.org_id);
  if (error) throw new Error("Couldn't save the business name.");

  revalidatePath("/", "layout");
  return { ok: true };
}
