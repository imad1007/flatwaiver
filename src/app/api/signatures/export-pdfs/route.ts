import { NextResponse } from "next/server";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Hard cap per ZIP — narrow the date range for more. */
const MAX_FILES = 500;

/**
 * Bulk-download signed waiver PDFs as a single ZIP, honoring the same filters
 * as the CSV export. Auth required; RLS scopes rows to the requester's org.
 * Never gated on subscription status — legal documents are always exportable.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "No profile." }, { status: 403 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const template = url.searchParams.get("template") ?? "";
  const flaggedOnly = url.searchParams.get("flagged") === "1";

  let query = supabase
    .from("signed_waivers")
    .select("id, signer_name, signed_at, pdf_path", { count: "exact" })
    .order("signed_at", { ascending: false })
    .range(0, MAX_FILES); // one extra row to detect overflow

  if (q) query = query.ilike("signer_name", `%${q}%`);
  if (from) query = query.gte("signed_at", `${from}T00:00:00Z`);
  if (to) query = query.lte("signed_at", `${to}T23:59:59Z`);
  if (template) query = query.eq("template_id", template);
  if (flaggedOnly) query = query.eq("flagged", true);

  const { data: rows, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Query failed." }, { status: 500 });
  }
  if (!rows || rows.length === 0) {
    return NextResponse.json(
      { error: "No signatures match these filters." },
      { status: 404 }
    );
  }
  if (rows.length > MAX_FILES) {
    return NextResponse.json(
      {
        error: `More than ${MAX_FILES} signatures match. Narrow the date range and export in batches.`,
      },
      { status: 413 }
    );
  }

  // Rows came through RLS, but keep the storage boundary explicit: only ever
  // download paths under this org's prefix (see AGENTS.md storage rule).
  const admin = createAdminClient();
  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (const row of rows) {
    if (!row.pdf_path.startsWith(`${profile.org_id}/`)) continue;
    const { data: blob } = await admin.storage.from("signed-pdfs").download(row.pdf_path);
    if (!blob) continue; // skip unfetchable files rather than failing the batch

    const date = row.signed_at.slice(0, 10);
    const safeName = row.signer_name.replace(/[^\p{L}\p{N} _.-]/gu, "").slice(0, 60).trim() || "signer";
    let name = `${date} ${safeName}.pdf`;
    for (let n = 2; usedNames.has(name); n++) name = `${date} ${safeName} (${n}).pdf`;
    usedNames.add(name);

    zip.file(name, Buffer.from(await blob.arrayBuffer()));
  }

  const archive = await zip.generateAsync({ type: "nodebuffer", compression: "STORE" });
  const today = new Date().toISOString().slice(0, 10);

  return new Response(new Uint8Array(archive), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="signed-waivers-${today}.zip"`,
    },
  });
}
