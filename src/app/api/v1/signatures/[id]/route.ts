import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-keys";
import { createAdminClient } from "@/lib/supabase/admin";
import { shapeSignature } from "@/lib/public-api";

export const runtime = "nodejs";

/**
 * Public read API: fetch one signed waiver by id (scoped to the key's org),
 * including a short-lived signed URL to the signed PDF.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiKey(request);
  if (!auth) {
    return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 });
  }
  const { id } = await params;

  const admin = createAdminClient();
  const { data } = await admin
    .from("signed_waivers")
    .select(
      "id, template_id, signer_name, signer_email, is_minor, flagged, tag, signing_channel, signed_at, pdf_path, pdf_sha256"
    )
    .eq("id", id)
    .eq("org_id", auth.orgId)
    .maybeSingle();
  if (!data) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let pdfUrl: string | null = null;
  const { data: signed } = await admin.storage
    .from("signed-pdfs")
    .createSignedUrl(data.pdf_path, 10 * 60);
  pdfUrl = signed?.signedUrl ?? null;

  return NextResponse.json({
    data: { ...shapeSignature(data), pdf_sha256: data.pdf_sha256, pdf_url: pdfUrl },
  });
}
