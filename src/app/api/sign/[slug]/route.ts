import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublishedWaiverBySlug, PublicWaiverLoadError } from "@/lib/public-waiver";
import { verifyTurnstile } from "@/lib/turnstile";
import { renderSignedPdf } from "@/lib/pdf/waiver-pdf";
import {
  sendFlaggedSignatureEmail,
  sendOwnerNotificationEmail,
  sendSignerCopyEmail,
} from "@/lib/email";
import { dispatchWebhooks } from "@/lib/webhooks";
import { APP } from "@/lib/config";
import { isRealIsoDate } from "@/lib/signing-validation";
import {
  evaluateFlags,
  medicalAnswerIsYes,
  MEDICAL_CONDITION_DETAIL_KEY,
  MEDICAL_CONDITION_KEY,
  type WaiverField,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const RATE_LIMIT_PER_MINUTE = 5;
const MAX_SIGNATURE_BYTES = 1024 * 1024; // 1 MB per signature PNG
const MAX_SIGNATURE_DATA_URL_LENGTH =
  "data:image/png;base64,".length + Math.ceil(MAX_SIGNATURE_BYTES / 3) * 4;

const basePayloadSchema = z.object({
  submissionId: z.string().uuid().optional(),
  turnstileToken: z.string().min(1),
  signerName: z.string().trim().min(1).max(200),
  isMinor: z.boolean(),
  guardianName: z.string().trim().min(1).max(200).optional(),
  guardianRelationship: z.string().trim().min(2).max(100).optional(),
  fieldValues: z.record(z.string(), z.union([z.string().max(2000), z.boolean()])),
  signatureDataUrl: z
    .string()
    .startsWith("data:image/png;base64,")
    .max(MAX_SIGNATURE_DATA_URL_LENGTH),
  guardianSignatureDataUrl: z
    .string()
    .startsWith("data:image/png;base64,")
    .max(MAX_SIGNATURE_DATA_URL_LENGTH)
    .optional(),
  consentGiven: z.literal(true),
  channel: z.enum(["link", "kiosk", "qr"]),
  /** Optional auto-tag from ?tag= on the signing link (e.g. a reservation id). */
  tag: z.string().trim().max(200).optional(),
  /** Optional captured photo/ID, a downscaled JPEG data URL from the client. */
  photoDataUrl: z.string().startsWith("data:image/").max(8_000_000).optional(),
});

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

function decodeJpegDataUrl(dataUrl: string): Buffer | null {
  const match = /^data:image\/jpeg;base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  try {
    const buf = Buffer.from(match[1], "base64");
    if (buf.length === 0 || buf.length > MAX_PHOTO_BYTES) return null;
    if (buf[0] !== 0xff || buf[1] !== 0xd8) return null; // JPEG magic bytes
    return buf;
  } catch {
    return null;
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const clientIp = getClientIp(request);
  const userAgent = request.headers.get("user-agent");

  // Parse body
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }
  const parsed = basePayloadSchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonError("Invalid submission. Check your entries and try again.", 400);
  }
  const payload = parsed.data;

  // 1. Turnstile
  const turnstileOk = await verifyTurnstile(payload.turnstileToken, clientIp);
  if (!turnstileOk) {
    return jsonError("Verification failed. Please retry the challenge.", 403);
  }

  const admin = createAdminClient();

  // A client keeps one UUID across retries. If the first request committed but
  // its response was lost, return that success instead of creating a second
  // immutable record. Older clients remain supported through the optional ID.
  if (payload.submissionId) {
    const { data: existing, error: existingError } = await admin
      .from("signed_waivers")
      .select("template_id")
      .eq("id", payload.submissionId)
      .maybeSingle();
    if (existingError) {
      return jsonError("Couldn't verify submission status. Please try again.", 503);
    }
    if (existing) {
      const { data: existingTemplate, error: templateLookupError } = await admin
        .from("waiver_templates")
        .select("slug")
        .eq("id", existing.template_id)
        .maybeSingle();
      if (templateLookupError) {
        return jsonError("Couldn't verify submission status. Please try again.", 503);
      }
      if (existingTemplate?.slug === slug) {
        return NextResponse.json({ ok: true, duplicate: true });
      }
      return jsonError("Submission identifier conflict. Refresh and try again.", 409);
    }
  }

  // 2. Rate limit: max 5 submissions per IP per minute
  if (clientIp) {
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count, error: rateLimitError } = await admin
      .from("signed_waivers")
      .select("id", { count: "exact", head: true })
      .eq("ip", clientIp)
      .gte("signed_at", oneMinuteAgo);
    if (rateLimitError) {
      console.error("Signing rate-limit check failed", rateLimitError);
      return jsonError("Couldn't verify submission limits. Please retry.", 503);
    }
    if ((count ?? 0) >= RATE_LIMIT_PER_MINUTE) {
      return jsonError("Too many submissions. Please wait a minute.", 429);
    }
  }

  // 3. Resolve template — must be published; capture current version NOW.
  let waiver;
  try {
    waiver = await getPublishedWaiverBySlug(slug);
  } catch (error) {
    if (error instanceof PublicWaiverLoadError) {
      return jsonError("The waiver service is temporarily unavailable. Please try again.", 503);
    }
    throw error;
  }
  if (!waiver) {
    return jsonError("This waiver is no longer available.", 404);
  }
  const version = waiver.version;

  // Validate field values against this version's field definitions.
  const fieldError = validateFieldValues(version.fields, payload.fieldValues);
  if (fieldError) return jsonError(fieldError, 400);

  // Minor flow consistency
  if (payload.isMinor) {
    if (version.minor_mode !== "allowed") {
      return jsonError("This waiver does not accept signatures for minors.", 400);
    }
    if (
      !payload.guardianName ||
      !payload.guardianRelationship ||
      !payload.guardianSignatureDataUrl
    ) {
      return jsonError("Guardian name, relationship, and signature are required.", 400);
    }
  }

  // 4. Subscription gating
  if (!waiver.acceptingSignatures) {
    return jsonError("This business's waiver collection is paused.", 403);
  }

  // Photo capture: enforce the template's policy.
  if (waiver.photoMode === "required" && !payload.photoDataUrl) {
    return jsonError("A photo is required to sign this waiver.", 400);
  }
  if (waiver.photoMode === "off" && payload.photoDataUrl) {
    return jsonError("This waiver does not accept photo uploads.", 400);
  }

  // Decode signature PNGs
  const signaturePng = decodePngDataUrl(payload.signatureDataUrl);
  if (!signaturePng) return jsonError("Invalid signature image.", 400);
  const guardianPng = payload.guardianSignatureDataUrl
    ? decodePngDataUrl(payload.guardianSignatureDataUrl)
    : null;
  if (payload.guardianSignatureDataUrl && !guardianPng) {
    return jsonError("Invalid guardian signature image.", 400);
  }
  const photoBuf = payload.photoDataUrl
    ? decodeJpegDataUrl(payload.photoDataUrl)
    : null;
  if (payload.photoDataUrl && !photoBuf) {
    return jsonError("Invalid photo image.", 400);
  }

  const signedAt = new Date();
  const signedAtIso = signedAt.toISOString();
  const recordId = payload.submissionId ?? crypto.randomUUID();
  const basePath = `${waiver.orgId}/${recordId}`;

  // 5. Upload signature PNG(s)
  const signaturePath = `${basePath}/signature.png`;
  const uncommittedSignaturePaths: string[] = [];
  const { error: sigUploadError } = await admin.storage
    .from("signatures")
    .upload(signaturePath, signaturePng, { contentType: "image/png" });
  if (sigUploadError) return jsonError("Failed to store signature.", 500);
  uncommittedSignaturePaths.push(signaturePath);

  let guardianSignaturePath: string | null = null;
  if (guardianPng) {
    guardianSignaturePath = `${basePath}/guardian-signature.png`;
    const { error } = await admin.storage
      .from("signatures")
      .upload(guardianSignaturePath, guardianPng, { contentType: "image/png" });
    if (error) {
      await cleanupUncommittedFiles(admin, uncommittedSignaturePaths);
      return jsonError("Failed to store guardian signature.", 500);
    }
    uncommittedSignaturePaths.push(guardianSignaturePath);
  }

  // Optional captured photo/ID (private, org-prefixed, alongside the signature).
  let photoPath: string | null = null;
  if (photoBuf) {
    photoPath = `${basePath}/photo.jpg`;
    const { error } = await admin.storage
      .from("signatures")
      .upload(photoPath, photoBuf, { contentType: "image/jpeg" });
    if (error) {
      await cleanupUncommittedFiles(admin, uncommittedSignaturePaths);
      return jsonError("Failed to store photo.", 500);
    }
    uncommittedSignaturePaths.push(photoPath);
  }

  // Derive email / DOB from field values by type
  const emailField = version.fields.find((f) => f.type === "email");
  const dobField = version.fields.find((f) => f.type === "date_of_birth");
  const signerEmail = emailField
    ? nonEmptyString(payload.fieldValues[emailField.key])
    : null;
  const signerDob = dobField
    ? nonEmptyString(payload.fieldValues[dobField.key])
    : null;

  // Org logo for the PDF header (best-effort — never blocks signing)
  let logoDataUrl: string | null = null;
  if (waiver.branding.logoPath) {
    try {
      const { data: logoBlob } = await admin.storage
        .from("uploads")
        .download(waiver.branding.logoPath);
      if (logoBlob) {
        const mime = logoBlob.type || "image/png";
        // @react-pdf supports PNG/JPEG; skip webp logos in the PDF
        if (mime === "image/png" || mime === "image/jpeg") {
          const buf = Buffer.from(await logoBlob.arrayBuffer());
          logoDataUrl = `data:${mime};base64,${buf.toString("base64")}`;
        }
      }
    } catch {
      logoDataUrl = null;
    }
  }

  // 6. Render final PDF with Evidence page (double-render hash scheme)
  let pdf: Buffer;
  let pdfSha256: string;
  try {
    ({ pdf, pdfSha256 } = await renderSignedPdf({
      orgName: waiver.orgName,
      logoDataUrl,
      brandColor: waiver.branding.color,
      waiverName: waiver.name,
      versionNumber: version.version_number,
      contentSha256: version.content_sha256,
      blocks: version.body,
      fields: version.fields,
      fieldValues: payload.fieldValues,
      signerName: payload.signerName,
      signerEmail,
      isMinor: payload.isMinor,
      guardianName: payload.guardianName ?? null,
      guardianRelationship: payload.guardianRelationship ?? null,
      signatureDataUrl: payload.signatureDataUrl,
      guardianSignatureDataUrl: payload.guardianSignatureDataUrl ?? null,
      consentText: version.consent_text,
      signedAtIso,
      ip: clientIp,
      userAgent,
      channel: payload.channel,
    }));
  } catch (err) {
    console.error("PDF render failed", err);
    await cleanupUncommittedFiles(admin, uncommittedSignaturePaths);
    return jsonError("Failed to generate the signed document.", 500);
  }

  // 7. Upload PDF; insert the append-only signed_waivers row
  const pdfPath = `${basePath}/signed.pdf`;
  const { error: pdfUploadError } = await admin.storage
    .from("signed-pdfs")
    .upload(pdfPath, pdf, { contentType: "application/pdf" });
  if (pdfUploadError) {
    await cleanupUncommittedFiles(admin, uncommittedSignaturePaths);
    return jsonError("Failed to store signed document.", 500);
  }

  const flagged = evaluateFlags(version.fields, payload.fieldValues);

  const { error: insertError } = await admin.from("signed_waivers").insert({
    id: recordId,
    org_id: waiver.orgId,
    template_id: waiver.templateId,
    template_version_id: version.id,
    signer_name: payload.signerName,
    signer_email: signerEmail,
    signer_dob: signerDob,
    is_minor: payload.isMinor,
    guardian_name: payload.isMinor ? payload.guardianName : null,
    guardian_relationship: payload.isMinor ? payload.guardianRelationship : null,
    field_values: payload.fieldValues,
    signature_path: signaturePath,
    guardian_signature_path: guardianSignaturePath,
    photo_path: photoPath,
    pdf_path: pdfPath,
    pdf_sha256: pdfSha256,
    consent_given: true,
    consent_text_snapshot: version.consent_text,
    flagged,
    tag: payload.tag && payload.tag.length > 0 ? payload.tag : null,
    signed_at: signedAtIso,
    ip: clientIp,
    user_agent: userAgent,
    signing_channel: payload.channel,
  });
  if (insertError) {
    console.error("signed_waivers insert failed", insertError);

    // The database may have committed even when the client reports an error
    // (for example, if the response was lost). Reconcile by the idempotency ID
    // before deciding these files are safe to remove.
    const { data: reconciled, error: reconcileError } = await admin
      .from("signed_waivers")
      .select("org_id, template_id")
      .eq("id", recordId)
      .maybeSingle();

    if (reconcileError) {
      console.error("signed_waivers reconciliation failed", reconcileError);
      return jsonError(
        "Couldn't confirm whether the signature was recorded. Please retry.",
        503
      );
    }
    if (reconciled) {
      if (
        reconciled.org_id !== waiver.orgId ||
        reconciled.template_id !== waiver.templateId
      ) {
        return jsonError("Submission identifier conflict. Refresh and try again.", 409);
      }
      // The append-only record exists, so its evidence must remain untouched.
      // Continue with best-effort notifications and return success.
    } else {
      await cleanupUncommittedFiles(admin, uncommittedSignaturePaths, [pdfPath]);
      return jsonError("Failed to record the signature.", 500);
    }
  }

  // Outbound webhooks (best-effort; never fails the signature).
  await dispatchWebhooks(waiver.orgId, {
    event: "signature.created",
    id: recordId,
    waiver: { id: waiver.templateId, name: waiver.name },
    signer_name: payload.signerName,
    signer_email: signerEmail,
    is_minor: payload.isMinor,
    flagged,
    tag: payload.tag && payload.tag.length > 0 ? payload.tag : null,
    channel: payload.channel,
    signed_at: signedAtIso,
  });

  // 8. Emails (best-effort; never fail the signature over email problems)
  await sendEmails({
    admin,
    orgId: waiver.orgId,
    recordId,
    pdfPath,
    pdf,
    signerEmail,
    signerName: payload.signerName,
    waiverName: waiver.name,
    orgName: waiver.orgName,
    signedAtIso,
    flagged,
  });

  return NextResponse.json({ ok: true });
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip");
}

function decodePngDataUrl(dataUrl: string): Buffer | null {
  const base64 = dataUrl.slice("data:image/png;base64,".length);
  try {
    const buf = Buffer.from(base64, "base64");
    if (buf.length === 0 || buf.length > MAX_SIGNATURE_BYTES) return null;
    // PNG magic bytes
    if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) {
      return null;
    }
    return buf;
  } catch {
    return null;
  }
}

function nonEmptyString(v: string | boolean | undefined): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/**
 * Remove only artifacts created by the current request after proving its
 * database row does not exist. Committed or uncertain evidence is never
 * regenerated or cleaned up here.
 */
async function cleanupUncommittedFiles(
  admin: ReturnType<typeof createAdminClient>,
  signaturePaths: string[],
  pdfPaths: string[] = []
) {
  const removals: PromiseLike<{ error: unknown }>[] = [];
  if (signaturePaths.length > 0) {
    removals.push(admin.storage.from("signatures").remove(signaturePaths));
  }
  if (pdfPaths.length > 0) {
    removals.push(admin.storage.from("signed-pdfs").remove(pdfPaths));
  }

  const results = await Promise.allSettled(removals);
  for (const result of results) {
    if (result.status === "rejected" || result.value.error) {
      console.error(
        "Failed to clean up uncommitted signing artifacts",
        result.status === "rejected" ? result.reason : result.value.error
      );
    }
  }
}

/** Validate submitted values against the version's field definitions. */
function validateFieldValues(
  fields: WaiverField[],
  values: Record<string, string | boolean>
): string | null {
  const knownKeys = new Set(fields.map((f) => f.key));
  for (const key of Object.keys(values)) {
    if (!knownKeys.has(key)) return "Unexpected field submitted.";
  }
  for (const field of fields) {
    const value = values[field.key];
    if (field.required) {
      if (field.type === "checkbox") {
        if (value !== true) return `"${field.label}" must be checked.`;
      } else if (typeof value !== "string" || value.trim() === "") {
        return `"${field.label}" is required.`;
      }
    }
    if (value === undefined || value === "") continue;

    switch (field.type) {
      case "checkbox":
        if (typeof value !== "boolean") return `"${field.label}" is invalid.`;
        break;
      case "email":
        if (
          typeof value !== "string" ||
          !z.string().email().safeParse(value).success
        )
          return `"${field.label}" must be a valid email.`;
        break;
      case "date":
      case "date_of_birth":
        if (typeof value !== "string" || !isRealIsoDate(value))
          return `"${field.label}" must be a valid date.`;
        break;
      case "select":
        if (typeof value !== "string" || !(field.options ?? []).includes(value))
          return `"${field.label}" has an invalid choice.`;
        break;
      case "initials":
        if (typeof value !== "string" || value.length > 5)
          return `"${field.label}" is too long.`;
        break;
      default:
        if (typeof value !== "string") return `"${field.label}" is invalid.`;
    }
  }

  // Medical-condition conditional: when this version pairs the condition field
  // with a detail field, a "yes" answer requires a non-empty detail. "No" (or
  // an absent answer) leaves the detail optional.
  const medical = fields.find((f) => f.key === MEDICAL_CONDITION_KEY);
  const medicalDetail = fields.find((f) => f.key === MEDICAL_CONDITION_DETAIL_KEY);
  if (medical && medicalDetail && medicalAnswerIsYes(values[medical.key])) {
    const detail = values[medicalDetail.key];
    if (typeof detail !== "string" || detail.trim() === "") {
      return `"${medicalDetail.label}" is required when "${medical.label}" is answered yes.`;
    }
  }

  return null;
}

async function sendEmails(opts: {
  admin: ReturnType<typeof createAdminClient>;
  orgId: string;
  recordId: string;
  pdfPath: string;
  pdf: Buffer;
  signerEmail: string | null;
  signerName: string;
  waiverName: string;
  orgName: string;
  signedAtIso: string;
  flagged: boolean;
}) {
  try {
    // Signer copy via 7-day signed URL
    if (opts.signerEmail) {
      const { data: signedUrl } = await opts.admin.storage
        .from("signed-pdfs")
        .createSignedUrl(opts.pdfPath, 7 * 24 * 60 * 60);
      if (signedUrl?.signedUrl) {
        await sendSignerCopyEmail({
          to: opts.signerEmail,
          signerName: opts.signerName,
          waiverName: opts.waiverName,
          orgName: opts.orgName,
          pdfUrl: signedUrl.signedUrl,
        });
      }
    }

    const detailUrl = `${APP.url?.replace(/\/$/, "")}/signatures/${opts.recordId}`;

    if (opts.flagged) {
      // Flagged: alert every owner + admin so a screening hit isn't missed.
      const { data: staff, error: staffError } = await opts.admin
        .from("profiles")
        .select("email")
        .eq("org_id", opts.orgId)
        .in("role", ["owner", "admin"]);
      if (staffError) throw staffError;
      for (const person of staff ?? []) {
        if (person.email) {
          await sendFlaggedSignatureEmail({
            to: person.email,
            signerName: opts.signerName,
            waiverName: opts.waiverName,
            signedAtIso: opts.signedAtIso,
            detailUrl,
            pdf: opts.pdf,
            recordId: opts.recordId,
          });
        }
      }
    } else {
      // Normal: notify every owner in the signing organization.
      const { data: owners, error: ownersError } = await opts.admin
        .from("profiles")
        .select("email")
        .eq("org_id", opts.orgId)
        .eq("role", "owner");
      if (ownersError) throw ownersError;
      for (const owner of owners ?? []) {
        if (!owner.email) continue;
        await sendOwnerNotificationEmail({
          to: owner.email,
          signerName: opts.signerName,
          waiverName: opts.waiverName,
          signedAtIso: opts.signedAtIso,
          detailUrl,
          pdf: opts.pdf,
          recordId: opts.recordId,
        });
      }
    }
  } catch (err) {
    console.error("post-sign emails failed", err);
  }
}
