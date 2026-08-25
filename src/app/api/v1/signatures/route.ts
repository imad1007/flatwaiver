import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-keys";
import { createAdminClient } from "@/lib/supabase/admin";
import { shapeSignature } from "@/lib/public-api";

export const runtime = "nodejs";

/**
 * Public read API: list signed waivers for the authenticated org.
 * Auth: `Authorization: Bearer fw_live_...`. Read-only.
 * Query: ?limit=50 (max 200) &tag= &template_id= &since=<ISO>.
 */
export async function GET(request: Request) {
  const auth = await authenticateApiKey(request);
  if (!auth) {
    return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 1),
    200
  );
  const tag = url.searchParams.get("tag");
  const templateId = url.searchParams.get("template_id");
  const since = url.searchParams.get("since");

  const admin = createAdminClient();
  let q = admin
    .from("signed_waivers")
    .select(
      "id, template_id, signer_name, signer_email, is_minor, flagged, tag, signing_channel, signed_at"
    )
    .eq("org_id", auth.orgId)
    .order("signed_at", { ascending: false })
    .limit(limit);
  if (tag) q = q.eq("tag", tag);
  if (templateId) q = q.eq("template_id", templateId);
  if (since) q = q.gte("signed_at", since);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: "Query failed." }, { status: 500 });
  }

  return NextResponse.json({
    object: "list",
    data: (data ?? []).map(shapeSignature),
  });
}
