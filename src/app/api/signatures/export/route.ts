import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const BATCH_SIZE = 500;

const HEADER = [
  "id",
  "signer_name",
  "signer_email",
  "signer_dob",
  "is_minor",
  "guardian_name",
  "guardian_relationship",
  "waiver",
  "version_number",
  "signed_at_utc",
  "ip",
  "user_agent",
  "signing_channel",
  "consent_given",
  "pdf_sha256",
];

/**
 * Streams the org's signed waivers as CSV. Auth required; RLS scopes rows to
 * the requester's org. Never gated on subscription status — legal documents
 * are always exportable.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const template = url.searchParams.get("template") ?? "";

  const { data: templates } = await supabase
    .from("waiver_templates")
    .select("id, name");
  const templateNames = new Map((templates ?? []).map((t) => [t.id, t.name]));

  const { data: versions } = await supabase
    .from("template_versions")
    .select("id, version_number");
  const versionNumbers = new Map((versions ?? []).map((v) => [v.id, v.version_number]));

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(HEADER.join(",") + "\r\n"));

      let offset = 0;
      for (;;) {
        let query = supabase
          .from("signed_waivers")
          .select(
            "id, signer_name, signer_email, signer_dob, is_minor, guardian_name, guardian_relationship, template_id, template_version_id, signed_at, ip, user_agent, signing_channel, consent_given, pdf_sha256"
          )
          .order("signed_at", { ascending: false })
          .range(offset, offset + BATCH_SIZE - 1);

        if (q) query = query.ilike("signer_name", `%${q}%`);
        if (from) query = query.gte("signed_at", `${from}T00:00:00Z`);
        if (to) query = query.lte("signed_at", `${to}T23:59:59Z`);
        if (template) query = query.eq("template_id", template);

        const { data: rows, error } = await query;
        if (error || !rows || rows.length === 0) break;

        for (const r of rows) {
          const line = [
            r.id,
            r.signer_name,
            r.signer_email ?? "",
            r.signer_dob ?? "",
            r.is_minor ? "true" : "false",
            r.guardian_name ?? "",
            r.guardian_relationship ?? "",
            templateNames.get(r.template_id) ?? "",
            String(versionNumbers.get(r.template_version_id) ?? ""),
            new Date(r.signed_at).toISOString(),
            r.ip ?? "",
            r.user_agent ?? "",
            r.signing_channel,
            r.consent_given ? "true" : "false",
            r.pdf_sha256,
          ]
            .map(csvEscape)
            .join(",");
          controller.enqueue(encoder.encode(line + "\r\n"));
        }

        if (rows.length < BATCH_SIZE) break;
        offset += BATCH_SIZE;
      }

      controller.close();
    },
  });

  const date = new Date().toISOString().slice(0, 10);
  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="signed-waivers-${date}.csv"`,
    },
  });
}

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
