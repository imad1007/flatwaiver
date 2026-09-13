import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrgRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FileDownloadButton } from "@/components/file-download-button";
import { sourceLabel } from "@/lib/data-transfer-core.mjs";

export default async function ImportedRecord({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOrgRole("owner");
  const { id } = await params;
  const db = await createClient();
  const { data: r, error } = await db
    .from("imported_waivers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Couldn't load this imported record.");
  if (!r) notFound();
  const details = {
    Waiver: r.waiver_title,
    Email: r.participant_email,
    Phone: r.participant_phone,
    "Date of birth": r.date_of_birth,
    "Original signing date": r.original_signed_at,
    "Imported into FlatWaiver": r.imported_at,
    "Original filename": r.original_filename,
    "External ID": r.external_id,
    "Original PDF SHA-256": r.pdf_sha256,
  };
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/data/records" className="text-sm text-primary">
        ← Imported records
      </Link>
      <h1 className="mt-3 text-2xl font-bold">
        {r.participant_name || "Imported waiver"}
      </h1>
      <div className="my-5 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <p className="font-semibold">
          Imported from {sourceLabel(r.source_provider)}
        </p>
        <p className="mt-1 text-sm">
          This record was not signed through FlatWaiver. Dates, identities and
          signing evidence below come from the source supplied during import.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        {r.pdf_path && (
          <FileDownloadButton
            bucket="signed-pdfs"
            path={r.pdf_path}
            label="Download original PDF"
          />
        )}
        {r.signature_path && (
          <FileDownloadButton
            bucket="signatures"
            path={r.signature_path}
            label="Download imported signature image"
          />
        )}
      </div>
      <dl className="mt-6 space-y-4 rounded-xl border p-5">
        {Object.entries(details).map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="break-all text-sm">{String(v ?? "Not provided")}</dd>
          </div>
        ))}
      </dl>
      <section className="mt-6">
        <h2 className="font-semibold">Imported responses</h2>
        <pre className="mt-2 whitespace-pre-wrap break-all rounded-xl bg-muted p-4 text-xs">
          {JSON.stringify(r.field_values, null, 2)}
        </pre>
      </section>
      <section className="mt-6">
        <h2 className="font-semibold">Imported source evidence</h2>
        <p className="my-2 text-sm text-muted-foreground">
          Preserved as supplied. This is not a FlatWaiver signing audit trail.
        </p>
        <pre className="whitespace-pre-wrap break-all rounded-xl bg-muted p-4 text-xs">
          {JSON.stringify(r.source_evidence, null, 2)}
        </pre>
      </section>
    </div>
  );
}
