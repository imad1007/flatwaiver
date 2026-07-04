// Shared domain types. The DB is the source of truth (see supabase/migrations).

export type WaiverBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

export type FieldType =
  | "name"
  | "email"
  | "phone"
  | "date_of_birth"
  | "text"
  | "checkbox"
  | "initials";

export interface WaiverField {
  key: string;
  type: FieldType;
  label: string;
  required: boolean;
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

export interface Organization {
  id: string;
  name: string;
  waiver_volume_band: string | null;
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
  signed_at: string;
  ip: string | null;
  user_agent: string | null;
  signing_channel: SigningChannel;
  created_at: string;
}

export interface Subscription {
  org_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: SubscriptionStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
  updated_at: string;
}

/** Subscription states in which the org may create/publish templates and accept signatures. */
export function subscriptionIsUsable(status: string | null | undefined): boolean {
  return status === "trialing" || status === "active";
}
