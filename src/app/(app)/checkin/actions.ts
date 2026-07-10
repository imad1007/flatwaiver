"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Record a front-desk check-in against a signed waiver (RLS-scoped). */
export async function checkIn(signedWaiverId: string) {
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

  const { error } = await supabase.from("checkins").insert({
    org_id: profile.org_id,
    signed_waiver_id: signedWaiverId,
    checked_in_by: user.id,
  });
  if (error) throw new Error("Couldn't record the check-in.");
  revalidatePath("/checkin");
}

/** Undo a mistaken check-in. Operational data only — never touches signed records. */
export async function undoCheckIn(checkinId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("checkins").delete().eq("id", checkinId);
  if (error) throw new Error("Couldn't undo the check-in.");
  revalidatePath("/checkin");
}
