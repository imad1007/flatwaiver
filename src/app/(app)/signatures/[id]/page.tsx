import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FileDownloadButton } from "@/components/file-download-button";
import type { SignedWaiver } from "@/lib/types";

export default async function SignatureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("signed_waivers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const sig = data as SignedWaiver;

  const [{ data: template }, { data: version }] = await Promise.all([
    supabase
      .from("waiver_templates")
      .select("name")
      .eq("id", sig.template_id)
      .maybeSingle(),
    supabase
      .from("template_versions")
      .select("version_number, content_sha256, consent_text")
      .eq("id", sig.template_version_id)
      .maybeSingle(),
  ]);

  const fieldEntries = Object.entries(sig.field_values ?? {});

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/signatures" className="text-sm text-neutral-500 hover:underline">
        ← Signatures
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{sig.signer_name}</h1>
          <p className="text-neutral-500">
            {template?.name ?? "Waiver"} · signed{" "}
            {new Date(sig.signed_at).toLocaleString()}
          </p>
        </div>
        <FileDownloadButton
          bucket="signed-pdfs"
          path={sig.pdf_path}
          label="Download signed PDF"
        />
      </div>

      {/* Signer details */}
      <section className="mt-8 rounded-xl border border-neutral-200 p-6">
        <h2 className="font-bold">Signer</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <DetailRow label="Full legal name" value={sig.signer_name} />
          <DetailRow label="Email" value={sig.signer_email ?? "—"} />
          <DetailRow label="Date of birth" value={sig.signer_dob ?? "—"} />
          {sig.is_minor && (
            <>
              <DetailRow label="Minor participant" value="Yes" />
              <DetailRow label="Guardian" value={sig.guardian_name ?? "—"} />
              <DetailRow
                label="Guardian relationship"
                value={sig.guardian_relationship ?? "—"}
              />
            </>
          )}
          {fieldEntries.map(([key, value]) => (
            <DetailRow
              key={key}
              label={key.replace(/_/g, " ")}
              value={value === true ? "Yes" : value === false ? "No" : String(value)}
            />
          ))}
        </dl>
      </section>

      {/* Audit block */}
      <section className="mt-6 rounded-xl border border-neutral-200 p-6">
        <h2 className="font-bold">Audit record</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Evidence captured at signing time. This record is append-only and cannot
          be modified.
        </p>
        <dl className="mt-4 space-y-2 text-sm">
          <DetailRow
            label="Signed at (UTC)"
            value={new Date(sig.signed_at).toISOString()}
          />
          <DetailRow label="IP address" value={sig.ip ?? "—"} />
          <DetailRow label="User agent" value={sig.user_agent ?? "—"} mono />
          <DetailRow label="Signing channel" value={sig.signing_channel} />
          <DetailRow
            label="Waiver version"
            value={version ? `v${version.version_number}` : "—"}
          />
          <DetailRow
            label="Version content SHA-256"
            value={version?.content_sha256 ?? "—"}
            mono
          />
          <DetailRow label="Signed PDF SHA-256" value={sig.pdf_sha256} mono />
          <DetailRow label="Consent given" value={sig.consent_given ? "Yes" : "No"} />
        </dl>

        <div className="mt-4 rounded-md bg-neutral-50 p-4">
          <p className="text-xs font-medium text-neutral-500">
            Consent text shown to signer (exact snapshot):
          </p>
          <p className="mt-1 text-sm italic text-neutral-700">
            &ldquo;{sig.consent_text_snapshot}&rdquo;
          </p>
        </div>
      </section>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <dt className="w-52 shrink-0 text-neutral-500">{label}</dt>
      <dd className={`flex-1 break-all ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
