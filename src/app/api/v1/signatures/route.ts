import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-keys";
import { createAdminClient } from "@/lib/supabase/admin";
import { shapeCursorPage, shapeSignature } from "@/lib/public-api";
import { z } from "zod";

export const runtime = "nodejs";

/**
 * Public read API: list signed waivers for the authenticated org.
 * Auth: `Authorization: Bearer fw_live_...`. Read-only.
 * Query: ?limit=50 (max 200) &cursor=<signature_id> &tag= &template_id= &since=<ISO>.
 */
export async function GET(request: Request) {
  const auth = await authenticateApiKey(request);
  if (!auth) {
    return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 });
  }

  const url = new URL(request.url);
  const filters = z
    .object({
      limit: z.coerce.number().int().min(1).max(200).default(50),
      cursor: z.string().uuid().optional(),
      tag: z.string().max(200).optional(),
      templateId: z.string().uuid().optional(),
      since: z.string().datetime({ offset: true }).optional(),
    })
    .safeParse({
      limit: url.searchParams.get("limit") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
      tag: url.searchParams.get("tag") ?? undefined,
      templateId: url.searchParams.get("template_id") ?? undefined,
      since: url.searchParams.get("since") ?? undefined,
    });
  if (!filters.success) {
    return NextResponse.json({ error: "Invalid query parameters." }, { status: 400 });
  }
  const { limit, cursor, tag, templateId, since } = filters.data;

  const admin = createAdminClient();
  let cursorRow: { id: string; signed_at: string } | null = null;
  if (cursor) {
    const { data, error } = await admin
      .from("signed_waivers")
      .select("id, signed_at")
      .eq("id", cursor)
      .eq("org_id", auth.orgId)
      .maybeSingle();
    if (error) {
      console.error("API signature cursor lookup failed", error);
      return NextResponse.json({ error: "Query failed." }, { status: 503 });
    }
    if (!data) {
      return NextResponse.json({ error: "Invalid cursor." }, { status: 400 });
    }
    cursorRow = data;
  }

  let q = admin
    .from("signed_waivers")
    .select(
      "id, template_id, signer_name, signer_email, is_minor, flagged, tag, signing_channel, signed_at"
    )
    .eq("org_id", auth.orgId)
    .order("signed_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);
  if (tag) q = q.eq("tag", tag);
  if (templateId) q = q.eq("template_id", templateId);
  if (since) q = q.gte("signed_at", since);
  if (cursorRow) {
    q = q.or(
      `signed_at.lt.${cursorRow.signed_at},and(signed_at.eq.${cursorRow.signed_at},id.lt.${cursorRow.id})`
    );
  }

  const { data, error } = await q;
  if (error) {
    console.error("API signature list query failed", error);
    return NextResponse.json({ error: "Query failed." }, { status: 503 });
  }

  const page = shapeCursorPage(data ?? [], limit);

  return NextResponse.json({
    object: "list",
    data: page.data.map(shapeSignature),
    has_more: page.hasMore,
    next_cursor: page.nextCursor,
  });
}
