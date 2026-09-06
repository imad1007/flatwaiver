import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { csvEscape } from "@/lib/csv";

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
  "flagged",
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
  const email = url.searchParams.get("email")?.trim() ?? "";
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const template = url.searchParams.get("template") ?? "";
  const flaggedOnly = url.searchParams.get("flagged") === "1";

  // Supabase projects commonly cap a response at 1,000 rows. Page both lookup
  // tables so older versions never lose their names/numbers in large exports.
  const templateNames = new Map<string, string>();
  for (let offset = 0; ; offset += BATCH_SIZE) {
    const { data, error } = await supabase
      .from("waiver_templates")
      .select("id, name")
      .order("id")
      .range(offset, offset + BATCH_SIZE - 1);
    if (error) {
      return NextResponse.json({ error: "Could not prepare the export." }, { status: 500 });
    }
    for (const templateRow of data ?? []) {
      templateNames.set(templateRow.id, templateRow.name);
    }
    if (!data || data.length < BATCH_SIZE) break;
  }

  const versionNumbers = new Map<string, number>();
  for (let offset = 0; ; offset += BATCH_SIZE) {
    const { data, error } = await supabase
      .from("template_versions")
      .select("id, version_number")
      .order("id")
      .range(offset, offset + BATCH_SIZE - 1);
    if (error) {
      return NextResponse.json({ error: "Could not prepare the export." }, { status: 500 });
    }
    for (const versionRow of data ?? []) {
      versionNumbers.set(versionRow.id, versionRow.version_number);
    }
    if (!data || data.length < BATCH_SIZE) break;
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(HEADER.join(",") + "\r\n"));

      let offset = 0;
      for (;;) {
        let query = supabase
          .from("signed_waivers")
          .select(
            "id, signer_name, signer_email, signer_dob, is_minor, guardian_name, guardian_relationship, template_id, template_version_id, signed_at, ip, user_agent, signing_channel, consent_given, flagged, pdf_sha256"
          )
          .order("signed_at", { ascending: false })
          .range(offset, offset + BATCH_SIZE - 1);

        if (q) query = query.ilike("signer_name", `%${q}%`);
        if (email) query = query.ilike("signer_email", `%${email}%`);
        if (from) query = query.gte("signed_at", `${from}T00:00:00Z`);
        if (to) query = query.lte("signed_at", `${to}T23:59:59Z`);
        if (template) query = query.eq("template_id", template);
        if (flaggedOnly) query = query.eq("flagged", true);

        const { data: rows, error } = await query;
        if (error) {
          console.error("CSV export query failed", error);
          controller.error(new Error("The CSV export could not be completed."));
          return;
        }
        if (!rows || rows.length === 0) break;

        for (const r of rows) {
          const templateName = templateNames.get(r.template_id);
          const versionNumber = versionNumbers.get(r.template_version_id);
          if (templateName === undefined || versionNumber === undefined) {
            console.error("CSV export lookup missing", {
              signedWaiverId: r.id,
              hasTemplate: templateName !== undefined,
              hasVersion: versionNumber !== undefined,
            });
            controller.error(new Error("The CSV export could not be completed."));
            return;
          }
          const line = [
            r.id,
            r.signer_name,
            r.signer_email ?? "",
            r.signer_dob ?? "",
            r.is_minor ? "true" : "false",
            r.guardian_name ?? "",
            r.guardian_relationship ?? "",
            templateName,
            String(versionNumber),
            new Date(r.signed_at).toISOString(),
            r.ip ?? "",
            r.user_agent ?? "",
            r.signing_channel,
            r.consent_given ? "true" : "false",
            r.flagged ? "true" : "false",
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
