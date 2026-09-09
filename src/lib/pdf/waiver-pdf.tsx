import "server-only";

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { sha256Hex } from "@/lib/canonical";
import type { SigningChannel, WaiverBlock, WaiverField } from "@/lib/types";

export interface SignedPdfInput {
  orgName: string;
  /** Org branding: optional logo (data URL) + hex accent color. */
  logoDataUrl: string | null;
  brandColor: string | null;
  waiverName: string;
  versionNumber: number;
  contentSha256: string;
  blocks: WaiverBlock[];
  fields: WaiverField[];
  fieldValues: Record<string, string | boolean>;
  signerName: string;
  signerEmail: string | null;
  isMinor: boolean;
  guardianName: string | null;
  guardianRelationship: string | null;
  signatureDataUrl: string;
  guardianSignatureDataUrl: string | null;
  consentText: string;
  signedAtIso: string;
  ip: string | null;
  userAgent: string | null;
  channel: SigningChannel;
}

/**
 * Render the final signed PDF with the Evidence page (spec §8):
 * 1. Render with a hash placeholder.
 * 2. SHA-256 the buffer, stamp that hash into the Evidence page footer.
 * 3. Re-render once; SHA-256 of the stored bytes is `pdfSha256`.
 * The second render is what gets stored; it is never regenerated later.
 */
export async function renderSignedPdf(
  input: SignedPdfInput
): Promise<{ pdf: Buffer; pdfSha256: string }> {
  const firstPass = await renderToBuffer(
    <WaiverPdf input={input} stampedHash={null} />
  );
  const firstHash = sha256Hex(firstPass);

  const finalPdf = await renderToBuffer(
    <WaiverPdf input={input} stampedHash={firstHash} />
  );
  const pdfSha256 = sha256Hex(finalPdf);

  return { pdf: Buffer.from(finalPdf), pdfSha256 };
}

const styles = StyleSheet.create({
  page: { paddingTop: 42, paddingHorizontal: 48, paddingBottom: 64, fontSize: 9, fontFamily: "Helvetica", lineHeight: 1.35, color: "#243044" },
  orgName: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#475569", marginBottom: 8 },
  title: { fontSize: 20, lineHeight: 1.2, fontFamily: "Helvetica-Bold", marginBottom: 12, color: "#172033" },
  heading: { fontSize: 10.5, fontFamily: "Helvetica-Bold", marginTop: 9, marginBottom: 4, color: "#172033" },
  paragraph: { marginBottom: 5 },
  listItem: { marginBottom: 2, marginLeft: 12 },
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 12, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: "#dce2eb", paddingBottom: 6, color: "#172033" },
  row: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: "#edf0f5" },
  label: { width: 150, paddingRight: 14, color: "#64748b", fontSize: 9 },
  value: { flex: 1, fontSize: 9 },
  signatureImage: { width: 220, height: 60, objectFit: "contain", objectPosition: "left", marginTop: 8 },
  signatureCard: { marginTop: 14, padding: 12, backgroundColor: "#f7f9fc", borderWidth: 1, borderColor: "#e1e7ef", borderRadius: 6 },
  evidenceFooter: { marginTop: 14, padding: 12, backgroundColor: "#f7f9fc", borderWidth: 1, borderColor: "#e1e7ef", borderRadius: 6, fontSize: 8, color: "#536176" },
  mono: { fontFamily: "Courier", fontSize: 8, lineHeight: 1.6 },
  meta: { fontSize: 8, color: "#64748b", marginBottom: 12, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: "#4f46e5" },
  footer: { position: "absolute", top: 744, height: 24, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between", paddingTop: 8, borderTopWidth: 0.5, borderTopColor: "#dce2eb", fontSize: 8, color: "#64748b" },
});

function WaiverPdf({
  input,
  stampedHash,
}: {
  input: SignedPdfInput;
  stampedHash: string | null;
}) {
  const filledFields = input.fields.filter(
    (f) => input.fieldValues[f.key] !== undefined && input.fieldValues[f.key] !== ""
  );

  return (
    <Document
      title={`${input.waiverName} — signed by ${input.signerName}`}
      author={input.orgName}
    >
      {/* Waiver text + signature */}
      <Page size="LETTER" style={styles.page}>
        {input.logoDataUrl && (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image
            src={input.logoDataUrl}
            style={{ width: 120, height: 36, objectFit: "contain", objectPosition: "left", marginBottom: 6 }}
          />
        )}
        <Text style={styles.orgName}>{input.orgName}</Text>
        <Text
          style={
            input.brandColor
              ? { ...styles.title, color: input.brandColor }
              : styles.title
          }
        >
          {input.waiverName}
        </Text>

        <Text style={styles.meta}>SIGNED WAIVER  |  Version {input.versionNumber}  |  {displayDate(input.signedAtIso)}</Text>

        {input.blocks.map((block, i) => {
          if (block.type === "heading") {
            return (
              <Text key={i} style={styles.heading} minPresenceAhead={36}>
                {block.text}
              </Text>
            );
          }
          if (block.type === "paragraph") {
            return (
              <Text key={i} style={styles.paragraph}>
                {block.text}
              </Text>
            );
          }
          return (
            <View key={i} style={{ marginBottom: 6 }}>
              {block.items.map((item, j) => (
                <Text key={j} style={styles.listItem}>
                  • {item}
                </Text>
              ))}
            </View>
          );
        })}

        {filledFields.length > 0 && (
          <>
            <Text style={styles.sectionTitle} minPresenceAhead={48}>Signer information</Text>
            {filledFields.map((f) => (
              <View key={f.key} style={styles.row}>
                <Text style={styles.label}>{f.label}</Text>
                <Text style={styles.value}>
                  {formatValue(input.fieldValues[f.key])}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* wrap={false} keeps the whole signature block together: the heading,
            the name/email/timestamp rows, and the signature image never split
            across a page break. If it doesn't fit in the space left on the
            current page, the entire block moves to the next page intact. */}
        <View wrap={false} style={styles.signatureCard}>
          <Text style={{ ...styles.heading, marginTop: 0 }}>Participant signature</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Full legal name</Text>
            <Text style={styles.value}>{input.signerName}</Text>
          </View>
          {input.signerEmail && (
            <View style={styles.row}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.value}>{input.signerEmail}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Signed at (UTC)</Text>
            <Text style={styles.value}>{displayDate(input.signedAtIso)}</Text>
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={input.signatureDataUrl} style={styles.signatureImage} />
        </View>

        {input.isMinor && (
          <View wrap={false} style={styles.signatureCard}>
            <Text style={{ ...styles.heading, marginTop: 0 }}>Parent / guardian signature</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Guardian name</Text>
              <Text style={styles.value}>{input.guardianName ?? ""}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Relationship</Text>
              <Text style={styles.value}>{input.guardianRelationship ?? ""}</Text>
            </View>
            {input.guardianSignatureDataUrl && (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image
                src={input.guardianSignatureDataUrl}
                style={styles.signatureImage}
              />
            )}
          </View>
        )}
        <View style={styles.footer} fixed><Text>Signed waiver / Electronic signature record</Text></View>
    <Text fixed style={{ position: "absolute", top: 750, left: 470, fontSize: 8, color: "#64748b", lineHeight: 1 }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </Page>

      {/* Evidence page */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.orgName}>{input.orgName}</Text>
        <Text style={styles.title}>Signature evidence record</Text>
        <Text style={styles.meta}>AUDIT RECORD  |  Version {input.versionNumber}</Text>

        <EvidenceRow label="Signer name" value={input.signerName} />
        <EvidenceRow label="Signer email" value={input.signerEmail ?? "—"} />
        <EvidenceRow label="Signed at (UTC)" value={input.signedAtIso} />
        <EvidenceRow label="IP address" value={input.ip ?? "—"} />
        <EvidenceRow label="User agent" value={input.userAgent ?? "—"} />
        <EvidenceRow label="Signing channel" value={input.channel} />
        <EvidenceRow
          label="Waiver version"
          value={`v${input.versionNumber} of "${input.waiverName}"`}
        />
        <EvidenceRow label="Version content SHA-256" value={input.contentSha256} mono />
        {input.isMinor && (
          <>
            <EvidenceRow label="Minor participant" value="Yes" />
            <EvidenceRow label="Guardian name" value={input.guardianName ?? "—"} />
            <EvidenceRow
              label="Guardian relationship"
              value={input.guardianRelationship ?? "—"}
            />
          </>
        )}

        <Text style={styles.sectionTitle}>Electronic signature consent</Text>
        <Text style={styles.paragraph}>
          The signer affirmatively checked a consent box presented with the
          following exact text before signing:
        </Text>
        <Text style={{ ...styles.paragraph, fontFamily: "Helvetica-Oblique" }}>
          &ldquo;{input.consentText}&rdquo;
        </Text>

        <View style={styles.evidenceFooter} wrap={false}>
          <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 5 }}>Document integrity / SHA-256</Text>
          <Text>Pre-stamp document hash:</Text>
          <Text style={styles.mono}>
            {wrapHash(stampedHash ?? "________________________________________________________________")}
          </Text>
          <Text style={{ marginTop: 6 }}>
            This SHA-256 hash was computed over the rendered document and stamped
            into this footer; the hash of the final stored file is recorded in the
            signing system&apos;s database at signing time. Recompute the SHA-256 of
            this file and compare it with the database record to verify integrity.
          </Text>
        </View>
        <View style={styles.footer} fixed><Text>Signed waiver / Electronic signature record</Text></View>
    <Text fixed style={{ position: "absolute", top: 750, left: 470, fontSize: 8, color: "#64748b", lineHeight: 1 }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </Page>
    </Document>
  );
}

function EvidenceRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={{ ...styles.row, paddingVertical: 3 }}>
      <Text style={styles.label}>{label}</Text>
      <Text style={mono ? { ...styles.value, ...styles.mono } : { ...styles.value, fontSize: 9 }}>
        {mono ? wrapHash(value) : value}
      </Text>
    </View>
  );
}

function formatValue(v: string | boolean | undefined): string {
  if (v === true) return "Yes";
  if (v === false) return "No";
  return v ?? "";
}

function wrapHash(value: string): string {
  return value.match(/.{1,32}/g)?.join("\n") ?? value;
}

function displayDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date) + " UTC";
}
