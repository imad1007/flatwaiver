"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrgRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { contentSha256 } from "@/lib/canonical";
import {
  draftContentSchema,
  draftHasMeaningfulContent,
} from "@/lib/waiver-schema";
import { sendSigningInviteEmail } from "@/lib/email";
import { deliverRenewalReminder } from "@/lib/renewal-delivery";
import { expiryState } from "@/lib/expiry";
import { APP } from "@/lib/config";
import {
  DEFAULT_CONSENT_TEXT,
  subscriptionIsUsable,
  type DraftContent,
} from "@/lib/types";

async function requireUsableSubscription() {
  const supabase = await createClient();
  const { data: sub, error } = await supabase
    .from("subscriptions")
    .select("status")
    .maybeSingle();
  if (error) {
    throw new Error(
      "We couldn't verify your subscription. Nothing was changed; try again.",
    );
  }
  if (!subscriptionIsUsable(sub?.status)) {
    throw new Error(
      "Your subscription is inactive. Subscribe to create or publish waivers — your existing signed waivers remain fully accessible."
    );
  }
}

function makeSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 8);
  return base ? `${base}-${suffix}` : suffix;
}

/** Create a draft template from pasted text. Redirects to the editor. */
export async function createTemplateFromText(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();
  if (!name || !text) throw new Error("Name and waiver text are required.");

  await requireOrgRole("staff");
  await requireUsableSubscription();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("org_id").single();
  if (!profile) throw new Error("No profile.");

  const paragraphs = text
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const draft: DraftContent = {
    title: name,
    blocks: paragraphs.map((p) => ({ type: "paragraph" as const, text: p })),
    fields: [
      { key: "signer_email", type: "email", label: "Email", required: true },
    ],
    consent_text: DEFAULT_CONSENT_TEXT,
    minor_mode: "allowed",
  };

  const { data: template, error } = await supabase
    .from("waiver_templates")
    .insert({
      org_id: profile.org_id,
      slug: makeSlug(name),
      name,
      status: "draft",
      draft_content: draft,
    })
    .select("id")
    .single();
  if (error) throw error;

  return { templateId: template.id };
}

/** Save the working draft (blocks, fields, consent, minor mode, name). */
export async function saveDraft(templateId: string, rawDraft: unknown, name: string) {
  await requireOrgRole("staff");
  const draft = draftContentSchema.parse(rawDraft);
  const supabase = await createClient();

  const { data: savedTemplate, error } = await supabase
    .from("waiver_templates")
    .update({
      name: name.trim() || draft.title,
      draft_content: draft,
      updated_at: new Date().toISOString(),
    })
    .eq("id", templateId)
    .select("id")
    .maybeSingle();
  if (error || !savedTemplate) throw new Error("Couldn't save the draft.");

  revalidatePath(`/waivers/${templateId}`);
  return { ok: true };
}

/**
 * Publish: creates a NEW immutable row in template_versions and points
 * current_version_id at it. Never edits an existing version.
 */
export async function publishTemplate(templateId: string, rawDraft: unknown, name: string) {
  await requireOrgRole("staff");
  const draft = draftContentSchema.parse(rawDraft);
  await requireUsableSubscription();
  if (!draftHasMeaningfulContent(draft)) {
    throw new Error("Add your waiver text before publishing.");
  }

  const supabase = await createClient();

  // Persist the draft first so what's published is exactly what's saved.
  await saveDraft(templateId, draft, name);

  const { data: versions, error: publishError } = await supabase.rpc(
    "publish_template_version",
    {
      p_template_id: templateId,
      p_body: draft.blocks,
      p_fields: draft.fields,
      p_consent_text: draft.consent_text,
      p_minor_mode: draft.minor_mode,
      p_content_sha256: contentSha256(
        draft.blocks,
        draft.fields,
        draft.consent_text,
      ),
    },
  );
  const version = Array.isArray(versions) ? versions[0] : null;
  if (publishError || !version) {
    throw new Error(
      "Your draft was saved, but publishing failed. Nothing partial went live; try again.",
    );
  }

  revalidatePath(`/waivers/${templateId}`);
  revalidatePath("/waivers");
  return { ok: true, versionNumber: version.version_number };
}

/**
 * Email a customer the signing link for a published waiver.
 * RLS scopes the template lookup to the caller's org.
 */
export async function sendSigningLink(templateId: string, rawEmail: string) {
  await requireOrgRole("staff");
  await requireUsableSubscription();
  const email = z.string().trim().email().max(320).parse(rawEmail);

  const supabase = await createClient();
  const { data: template } = await supabase
    .from("waiver_templates")
    .select("name, slug, status, org_id")
    .eq("id", templateId)
    .maybeSingle();
  if (!template) throw new Error("Waiver not found.");
  if (template.status !== "published") {
    throw new Error("Publish this waiver before sending it to signers.");
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", template.org_id)
    .single();

  const base = APP.url?.replace(/\/$/, "") ?? "";
  await sendSigningInviteEmail({
    to: email,
    waiverName: template.name,
    orgName: org?.name ?? APP.name,
    signingUrl: `${base}/w/${template.slug}`,
  });
  return { ok: true };
}

/** Archive: stops the public link from resolving. Versions are untouched. */
export async function archiveTemplate(templateId: string) {
  await requireOrgRole("staff");
  const supabase = await createClient();
  const { data: archivedTemplate, error } = await supabase
    .from("waiver_templates")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", templateId)
    .select("id")
    .maybeSingle();
  if (error || !archivedTemplate) throw new Error("Couldn't archive the waiver.");
  revalidatePath("/waivers");
  revalidatePath(`/waivers/${templateId}`);
}

/** Re-publish an archived template that already has a current version. */
export async function unarchiveTemplate(templateId: string) {
  await requireOrgRole("staff");
  await requireUsableSubscription();
  const supabase = await createClient();
  const { data: tpl, error: lookupError } = await supabase
    .from("waiver_templates")
    .select("current_version_id")
    .eq("id", templateId)
    .maybeSingle();
  if (lookupError || !tpl) throw new Error("Waiver not found.");

  const { data: restoredTemplate, error } = await supabase
    .from("waiver_templates")
    .update({
      status: tpl?.current_version_id ? "published" : "draft",
      updated_at: new Date().toISOString(),
    })
    .eq("id", templateId)
    .select("id")
    .maybeSingle();
  if (error || !restoredTemplate) throw new Error("Couldn't restore the waiver.");
  revalidatePath("/waivers");
  revalidatePath(`/waivers/${templateId}`);
}

/**
 * Set a template's renewal window (how long a signature stays valid before the
 * signer should re-sign). null = never expires. Operational policy, not
 * versioned content — so this updates the template shell without minting a
 * version.
 */
export async function setWaiverExpiry(templateId: string, rawMonths: number | null) {
  await requireOrgRole("staff");
  const months = z
    .union([z.null(), z.number().int().min(1).max(120)])
    .parse(rawMonths);

  const supabase = await createClient();
  const { data: updatedTemplate, error } = await supabase
    .from("waiver_templates")
    .update({ expiry_months: months, updated_at: new Date().toISOString() })
    .eq("id", templateId)
    .select("id")
    .maybeSingle();
  if (error || !updatedTemplate) throw new Error("Couldn't save the renewal setting.");

  revalidatePath(`/waivers/${templateId}`);
  revalidatePath("/signatures/renewals");
  return { ok: true };
}

/** Set a template's photo/ID capture policy (off / optional / required). */
export async function setPhotoMode(templateId: string, rawMode: string) {
  await requireOrgRole("staff");
  const mode = z.enum(["off", "optional", "required"]).parse(rawMode);

  const supabase = await createClient();
  const { data: updatedTemplate, error } = await supabase
    .from("waiver_templates")
    .update({ photo_mode: mode, updated_at: new Date().toISOString() })
    .eq("id", templateId)
    .select("id")
    .maybeSingle();
  if (error || !updatedTemplate) throw new Error("Couldn't save the photo setting.");

  revalidatePath(`/waivers/${templateId}`);
  return { ok: true };
}

/**
 * Email a signer a reminder to re-sign an expiring/expired waiver, then record
 * it so they're never reminded twice for the same signature. Scoped to the
 * caller's org; only fires when the signature is genuinely due.
 */
export async function sendResignReminder(signedWaiverId: string) {
  const caller = await requireOrgRole("staff");
  const admin = createAdminClient();

  const { data: sig, error: sigError } = await admin
    .from("signed_waivers")
    .select("id, org_id, template_id, signer_name, signer_email, signed_at")
    .eq("id", signedWaiverId)
    .maybeSingle();
  if (sigError) throw new Error("Couldn't load the signature. Please try again.");
  if (!sig || sig.org_id !== caller.orgId) throw new Error("Signature not found.");
  if (!sig.signer_email) throw new Error("That signer has no email on file.");

  const { data: tpl, error: templateError } = await admin
    .from("waiver_templates")
    .select("name, slug, expiry_months")
    .eq("id", sig.template_id)
    .single();
  if (templateError || !tpl) throw new Error("Couldn't load the waiver. Please try again.");
  const state = expiryState(sig.signed_at, tpl?.expiry_months);
  if (state !== "expiring" && state !== "expired") {
    throw new Error("This waiver isn't due for renewal yet.");
  }

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("name")
    .eq("id", caller.orgId)
    .single();
  if (orgError || !org) throw new Error("Couldn't load your organization. Please try again.");

  const base = APP.url?.replace(/\/$/, "") ?? "";
  const delivery = await deliverRenewalReminder({
    orgId: caller.orgId,
    signedWaiverId: sig.id,
    signerEmail: sig.signer_email,
    signerName: sig.signer_name,
    waiverName: tpl.name,
    orgName: org.name,
    signingUrl: `${base}/w/${tpl.slug}`,
    expired: state === "expired",
  });

  if (delivery.duplicate) {
    revalidatePath("/signatures/renewals");
    return { ok: true, duplicate: true };
  }

  await logAudit({
    orgId: caller.orgId,
    actorId: caller.userId,
    actorEmail: caller.email,
    action: "reminder.sent",
    target: sig.signer_email,
    metadata: { waiver: tpl?.name, state },
  });

  revalidatePath("/signatures/renewals");
  return { ok: true };
}
