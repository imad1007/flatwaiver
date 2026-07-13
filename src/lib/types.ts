// Shared domain types. The DB is the source of truth (see supabase/migrations).

export type WaiverBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

export type FieldType =
  | "name"
  | "email"
  | "phone"
  | "date"
  | "date_of_birth"
  | "text"
  | "multiline"
  | "select"
  | "checkbox"
  | "initials";

export interface WaiverField {
  key: string;
  type: FieldType;
  label: string;
  required: boolean;
  /** Choices for `select` fields. */
  options?: string[];
  /**
   * Answers that flag the signed waiver for staff attention (amber badge).
   * Compared against the normalized answer: checkboxes normalize to
   * "yes"/"no", everything else to the exact string value.
   */
  flag_values?: string[];
}

/** Normalize a submitted value for flag comparison. */
export function normalizeFieldValue(value: string | boolean | undefined): string {
  if (value === true) return "yes";
  if (value === false) return "no";
  return value ?? "";
}

/**
 * Medical-condition conditional (signer flow): when a version's fields define
 * BOTH keys below, a "yes" answer to the condition field makes the detail
 * field mandatory. Enforced client-side in SigningForm (inline error) and
 * server-side in the sign route's field validation (source of truth).
 */
export const MEDICAL_CONDITION_KEY = "medical_condition";
export const MEDICAL_CONDITION_DETAIL_KEY = "medical_condition_detail";

/** True when a medical-condition answer means "yes" (select "Yes" or a checked box). */
export function medicalAnswerIsYes(value: string | boolean | undefined): boolean {
  return normalizeFieldValue(value).trim().toLowerCase() === "yes";
}

/** Evaluate a version's flag config against submitted values. */
export function evaluateFlags(
  fields: WaiverField[],
  values: Record<string, string | boolean>
): boolean {
  return fields.some(
    (field) =>
      field.flag_values &&
      field.flag_values.length > 0 &&
      field.flag_values.includes(normalizeFieldValue(values[field.key]))
  );
}

export type MinorMode = "allowed" | "disallowed";

export interface DraftContent {
  title: string;
  blocks: WaiverBlock[];
  fields: WaiverField[];
  consent_text: string;
  minor_mode: MinorMode;
  warnings?: string[];
}

export const DEFAULT_CONSENT_TEXT =
  "I agree to sign this document electronically and I acknowledge that my electronic signature is legally binding, per the ESIGN Act and UETA.";

export type TemplateStatus = "draft" | "published" | "archived";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";
export type SigningChannel = "link" | "kiosk" | "qr";

export interface OrgBranding {
  /** Private storage path in the `uploads` bucket. */
  logo_path?: string;
  /** Hex brand color, e.g. "#4F46E5". */
  color?: string;
}

export interface Organization {
  id: string;
  name: string;
  waiver_volume_band: string | null;
  branding: OrgBranding | null;
  created_at: string;
}

export interface Profile {
  id: string;
  org_id: string;
  email: string;
  role: string;
  created_at: string;
}

export interface WaiverTemplate {
  id: string;
  org_id: string;
  slug: string;
  name: string;
  status: TemplateStatus;
  current_version_id: string | null;
  source_pdf_path: string | null;
  draft_content: DraftContent | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateVersion {
  id: string;
  template_id: string;
  version_number: number;
  body: WaiverBlock[];
  fields: WaiverField[];
  consent_text: string;
  minor_mode: MinorMode;
  content_sha256: string;
  created_at: string;
}

export interface SignedWaiver {
  id: string;
  org_id: string;
  template_id: string;
  template_version_id: string;
  signer_name: string;
  signer_email: string | null;
  signer_dob: string | null;
  is_minor: boolean;
  guardian_name: string | null;
  guardian_relationship: string | null;
  field_values: Record<string, string | boolean>;
  signature_path: string;
  guardian_signature_path: string | null;
  pdf_path: string;
  pdf_sha256: string;
  consent_given: boolean;
  consent_text_snapshot: string;
  flagged: boolean;
  signed_at: string;
  ip: string | null;
  user_agent: string | null;
  signing_channel: SigningChannel;
  created_at: string;
}

export interface Subscription {
  org_id: string;
  /** Stripe ids — dormant while Paddle is the active provider (see lib/stripe.ts). */
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  /** Paddle ids (migration 0007) — the active billing provider. */
  paddle_customer_id: string | null;
  paddle_subscription_id: string | null;
  status: SubscriptionStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
  updated_at: string;
}

/** Subscription states in which the org may create/publish templates and accept signatures. */
export function subscriptionIsUsable(status: string | null | undefined): boolean {
  return status === "trialing" || status === "active";
}

/**
 * "Business name missing" gate for post-signup profile completion.
 * Missing = null / empty / whitespace-only, OR equal to the user's email.
 * The email case matters because org bootstrap defaults an org's name to the
 * user's email when signup carried no business_name (Google OAuth gives us a
 * personal name + email but never a business name), so an email-as-name is a
 * placeholder, not a real answer. This is the exact inverse of that fallback.
 */
export function businessNameMissing(
  name: string | null | undefined,
  email: string | null | undefined
): boolean {
  const n = (name ?? "").trim();
  if (!n) return true;
  const e = (email ?? "").trim();
  return e.length > 0 && n.toLowerCase() === e.toLowerCase();
}
