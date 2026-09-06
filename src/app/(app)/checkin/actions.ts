"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrgRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const idSchema = z.string().uuid("Invalid check-in record.");

/** Record a front-desk check-in. Viewers remain read-only. */
export async function checkIn(rawSignedWaiverId: string) {
  const signedWaiverId = idSchema.parse(rawSignedWaiverId);
  const caller = await requireOrgRole("staff");
  const admin = createAdminClient();

  const { data: signature, error: signatureError } = await admin
    .from("signed_waivers")
    .select("id")
    .eq("id", signedWaiverId)
    .eq("org_id", caller.orgId)
    .maybeSingle();
  if (signatureError) throw new Error("Couldn't verify the signature. Please try again.");
  if (!signature) throw new Error("Signature not found.");

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const { data: existing, error: existingError } = await admin
    .from("checkins")
    .select("id")
    .eq("org_id", caller.orgId)
    .eq("signed_waiver_id", signedWaiverId)
    .gte("checked_in_at", todayStart.toISOString())
    .limit(1)
    .maybeSingle();
  if (existingError) throw new Error("Couldn't verify check-in status. Please try again.");
  if (existing) return { ok: true, duplicate: true };

  const { data: created, error } = await admin
    .from("checkins")
    .insert({
      org_id: caller.orgId,
      signed_waiver_id: signedWaiverId,
      checked_in_by: caller.userId,
    })
    .select("id")
    .single();
  if (error || !created) throw new Error("Couldn't record the check-in.");
  revalidatePath("/checkin");
  return { ok: true, duplicate: false };
}

/** Undo operational attendance data; immutable signed evidence is untouched. */
export async function undoCheckIn(rawCheckinId: string) {
  const checkinId = idSchema.parse(rawCheckinId);
  const caller = await requireOrgRole("staff");
  const { data: deleted, error } = await createAdminClient()
    .from("checkins")
    .delete()
    .eq("id", checkinId)
    .eq("org_id", caller.orgId)
    .select("id")
    .maybeSingle();
  if (error || !deleted) throw new Error("Couldn't undo the check-in. Refresh and try again.");
  revalidatePath("/checkin");
  return { ok: true };
}
