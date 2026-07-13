"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const nameSchema = z
  .string()
  .trim()
  .min(2, "Please enter your business name (at least 2 characters).")
  .max(120, "That business name is too long (120 characters max).");

/**
 * Persist the business name to organizations.name — the same place email-signup
 * users' business name is stored. Server-authoritative: validates non-empty +
 * trimmed + length, and rejects the account email as a name (which would fail
 * the "missing" gate and bounce the user back here in a loop).
 */
export async function saveBusinessName(rawName: string) {
  const parsed = nameSchema.safeParse(rawName);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  const name = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  if (user.email && name.toLowerCase() === user.email.trim().toLowerCase()) {
    throw new Error("Please enter your business's name, not your email address.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("No profile found for your account.");

  const admin = createAdminClient();
  const { error } = await admin
    .from("organizations")
    .update({ name })
    .eq("id", profile.org_id);
  if (error) throw new Error("Couldn't save your business name. Please try again.");

  // Refresh the (app) layout so the gate re-reads the new name and the
  // sidebar/PDF header pick it up immediately.
  revalidatePath("/", "layout");
  return { ok: true };
}
