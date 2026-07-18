"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Customer lifecycle actions. Every one independently calls assertAdmin() — the
 * /admin layout gate is never the sole check. Suspension uses Supabase's native
 * auth ban (no schema of its own); hard delete is allowed only for accounts
 * that hold no legal evidence (append-only signed waivers / template versions
 * can't be deleted, so such an org can never be fully removed).
 */

// ~100 years — effectively permanent until explicitly restored.
const BAN_FOREVER = "876000h";

function revalidateAdmin() {
  revalidatePath("/admin");
  revalidatePath("/admin/customers");
}

export async function suspendCustomer(userId: string) {
  await assertAdmin();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: BAN_FOREVER,
  });
  if (error) return { ok: false, error: error.message };
  revalidateAdmin();
  return { ok: true };
}

export async function restoreCustomer(userId: string) {
  await assertAdmin();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: "none",
  });
  if (error) return { ok: false, error: error.message };
  revalidateAdmin();
  return { ok: true };
}

export async function deleteCustomer(orgId: string) {
  const me = await assertAdmin();
  const admin = createAdminClient();

  // Re-verify emptiness server-side — never trust the client's "deletable" flag.
  const { count: sigCount } = await admin
    .from("signed_waivers")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);
  if (sigCount && sigCount > 0) {
    return {
      ok: false,
      error:
        "This account has signed waivers (legal records that can't be deleted). Suspend it instead.",
    };
  }

  const { data: templates } = await admin
    .from("waiver_templates")
    .select("id")
    .eq("org_id", orgId);
  const templateIds = (templates ?? []).map((t) => t.id);
  if (templateIds.length > 0) {
    const { count: verCount } = await admin
      .from("template_versions")
      .select("id", { count: "exact", head: true })
      .in("template_id", templateIds);
    if (verCount && verCount > 0) {
      return {
        ok: false,
        error:
          "This account has published waiver versions (immutable records). Suspend it instead.",
      };
    }
  }

  // Never let an admin delete the org their own login belongs to from here.
  const { data: profiles } = await admin
    .from("profiles")
    .select("id")
    .eq("org_id", orgId);
  const memberIds = (profiles ?? []).map((p) => p.id);
  if (memberIds.includes(me.id)) {
    return { ok: false, error: "You can't delete your own account here." };
  }

  // Best-effort storage cleanup for the org's uploads (logo, source PDFs).
  try {
    const { data: files } = await admin.storage.from("uploads").list(orgId);
    if (files && files.length > 0) {
      await admin.storage
        .from("uploads")
        .remove(files.map((f) => `${orgId}/${f.name}`));
    }
  } catch {
    // non-fatal — an orphaned upload on an otherwise-deleted org is harmless
  }

  // Delete in FK-safe order. checkins reference signed_waivers, so an empty org
  // has none, but clear defensively first.
  await admin.from("checkins").delete().eq("org_id", orgId);
  await admin.from("waiver_templates").delete().eq("org_id", orgId);
  await admin.from("subscriptions").delete().eq("org_id", orgId);
  // Deleting the auth user cascades its profile row (profiles.id → auth.users).
  for (const id of memberIds) {
    await admin.auth.admin.deleteUser(id);
  }
  const { error: orgErr } = await admin
    .from("organizations")
    .delete()
    .eq("id", orgId);
  if (orgErr) return { ok: false, error: orgErr.message };

  revalidateAdmin();
  return { ok: true };
}
