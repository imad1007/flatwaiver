"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { contentSha256 } from "@/lib/canonical";
import { draftContentSchema } from "@/lib/waiver-schema";
import {
  DEFAULT_CONSENT_TEXT,
  subscriptionIsUsable,
  type DraftContent,
} from "@/lib/types";

async function requireUsableSubscription() {
  const supabase = await createClient();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status")
    .maybeSingle();
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

  redirect(`/waivers/${template.id}`);
}

/** Save the working draft (blocks, fields, consent, minor mode, name). */
export async function saveDraft(templateId: string, rawDraft: unknown, name: string) {
  const draft = draftContentSchema.parse(rawDraft);
  const supabase = await createClient();

  const { error } = await supabase
    .from("waiver_templates")
    .update({
      name: name.trim() || draft.title,
      draft_content: draft,
      updated_at: new Date().toISOString(),
    })
    .eq("id", templateId);
  if (error) throw error;

  revalidatePath(`/waivers/${templateId}`);
  return { ok: true };
}

/**
 * Publish: creates a NEW immutable row in template_versions and points
 * current_version_id at it. Never edits an existing version.
 */
export async function publishTemplate(templateId: string, rawDraft: unknown, name: string) {
  const draft = draftContentSchema.parse(rawDraft);
  await requireUsableSubscription();

  const supabase = await createClient();

  // Persist the draft first so what's published is exactly what's saved.
  await saveDraft(templateId, draft, name);

  const { data: latest } = await supabase
    .from("template_versions")
    .select("version_number")
    .eq("template_id", templateId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = (latest?.version_number ?? 0) + 1;

  const { data: version, error: verError } = await supabase
    .from("template_versions")
    .insert({
      template_id: templateId,
      version_number: nextVersion,
      body: draft.blocks,
      fields: draft.fields,
      consent_text: draft.consent_text,
      minor_mode: draft.minor_mode,
      content_sha256: contentSha256(draft.blocks, draft.fields, draft.consent_text),
    })
    .select("id, version_number")
    .single();
  if (verError) throw verError;

  const { error: tplError } = await supabase
    .from("waiver_templates")
    .update({
      current_version_id: version.id,
      status: "published",
      updated_at: new Date().toISOString(),
    })
    .eq("id", templateId);
  if (tplError) throw tplError;

  revalidatePath(`/waivers/${templateId}`);
  revalidatePath("/waivers");
  return { ok: true, versionNumber: version.version_number };
}

/** Archive: stops the public link from resolving. Versions are untouched. */
export async function archiveTemplate(templateId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("waiver_templates")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", templateId);
  if (error) throw error;
  revalidatePath("/waivers");
  revalidatePath(`/waivers/${templateId}`);
}

/** Re-publish an archived template that already has a current version. */
export async function unarchiveTemplate(templateId: string) {
  await requireUsableSubscription();
  const supabase = await createClient();
  const { data: tpl } = await supabase
    .from("waiver_templates")
    .select("current_version_id")
    .eq("id", templateId)
    .single();

  const { error } = await supabase
    .from("waiver_templates")
    .update({
      status: tpl?.current_version_id ? "published" : "draft",
      updated_at: new Date().toISOString(),
    })
    .eq("id", templateId);
  if (error) throw error;
  revalidatePath("/waivers");
  revalidatePath(`/waivers/${templateId}`);
}
