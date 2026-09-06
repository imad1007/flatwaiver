import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FileDownloadButton } from "@/components/file-download-button";
import { DataLoadError } from "@/components/data-load-error";
import type { SignedWaiver } from "@/lib/types";

export default async function SignatureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error: signatureError } = await supabase
    .from("signed_waivers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (signatureError) {
    console.error("Signature detail load failed", signatureError);
    return (
      <div className="mx-auto max-w-3xl">
        <Link href="/signatures" className="text-sm text-muted-foreground hover:underline">
          â† Signatures
        </Link>
        <DataLoadError
          className="mt-4"
          retryHref={`/signatures/${id}`}
          title="We couldn't load this signed waiver"
          description="The record is still safe. Try loading it again before assuming it is missing."
        />
      </div>
    );
  }
  if (!data) notFound();
  const sig = data as SignedWaiver;

  const [templateResult, versionResult] = await Promise.all([
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
  const template = templateResult.data;
  const version = versionResult.data;
  const evidenceMetadataError = Boolean(templateResult.error || versionResult.error);
  if (evidenceMetadataError) {
    console.error("Signature evidence metadata load failed", {
      template: templateResult.error,
      version: versionResult.error,
    });
  }

  const fieldEntries = Object.entries(sig.field_values ?? {});

  // Captured photo (if any) via a short-lived signed URL from the private bucket.
  let photoUrl: string | null = null;
  let photoLoadFailed = false;
  if (sig.photo_path) {
    const admin = createAdminClient();
    const { data: signed, error } = await admin.storage
      .from("signatures")
      .createSignedUrl(sig.photo_path, 10 * 60);
    photoUrl = signed?.signedUrl ?? null;
    photoLoadFailed = Boolean(error || !photoUrl);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/signatures" className="text-sm text-muted-foreground hover:underline">
        ← Signatures
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold">
            {sig.signer_name}
            {sig.flagged && (
              <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                Flagged
              </span>
            )}
          </h1>
          <p className="text-muted-foreground">
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

      {evidenceMetadataError && (
        <DataLoadError
          className="mt-4"
          retryHref={`/signatures/${id}`}
          title="Some waiver evidence details couldn't be loaded"
          description="The signed PDF and record remain available. Reload before relying on the version details shown below."
        />
      )}

      {sig.flagged && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          One of this signer&apos;s answers matched a flag you configured — review
          the responses below before admitting the participant.
        </div>
      )}

      {/* Signer details */}
      <section className="mt-8 rounded-xl border border-border p-6">
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

      {/* Captured photo */}
      {photoUrl && (
        <section className="mt-6 rounded-xl border border-border p-6">
          <h2 className="font-bold">Captured photo</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Captured at signing time as identity evidence.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt="Signer photo captured at signing"
            className="mt-4 max-h-80 rounded-lg border border-border object-contain"
          />
        </section>
      )}
      {sig.photo_path && photoLoadFailed && (
        <DataLoadError
          className="mt-6"
          retryHref={`/signatures/${id}`}
          title="The captured photo couldn't be loaded"
          description="The stored photo was not changed. Try requesting it again."
        />
      )}

      {/* Audit block */}
      <section className="mt-6 rounded-xl border border-border p-6">
        <h2 className="font-bold">Audit record</h2>
        <p className="mt-1 text-sm text-muted-foreground">
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

        <div className="mt-4 rounded-md bg-muted/50 p-4">
          <p className="text-xs font-medium text-muted-foreground">
            Consent text shown to signer (exact snapshot):
          </p>
          <p className="mt-1 text-sm italic text-foreground/90">
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
      <dt className="w-52 shrink-0 text-muted-foreground">{label}</dt>
      <dd className={`flex-1 break-all ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
