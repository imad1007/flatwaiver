import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const SIGNED_URL_TTL_SECONDS = 10 * 60; // 10 minutes

const bodySchema = z.object({
  bucket: z.enum(["uploads", "signatures", "signed-pdfs"]),
  path: z.string().min(3).max(500),
});

/**
 * Returns a 10-minute signed URL for a private storage object, after
 * verifying the requester's org owns it. All storage paths are prefixed
 * with the owning org's id (`<org_id>/...`).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { bucket, path } = parsed.data;

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "No profile." }, { status: 403 });
  }

  // Org-membership check: every object path starts with the owning org's id.
  if (!path.startsWith(`${profile.org_id}/`) || path.includes("..")) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  return NextResponse.json({ url: data.signedUrl });
}
