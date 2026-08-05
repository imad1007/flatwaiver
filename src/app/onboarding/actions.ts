"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_CONSENT_TEXT,
  subscriptionIsUsable,
  type DraftContent,
} from "@/lib/types";
import { STARTER_BY_ID } from "@/lib/starter-templates";

const nameSchema = z
  .string()
  .trim()
  .min(2, "Please enter your business name (at least 2 characters).")
  .max(120, "That business name is too long (120 characters max).");

/**
 * Persist the business name to organizations.name — the same place email-signup
 * users' business name is stored. Server-authoritative: validates non-empty +
 * trimmed + length, and rejects the account email as a name (which would fail
 * the "missing" gate and bounce the user back here in a loop).
 */
export async function saveBusinessName(rawName: string) {
  const parsed = nameSchema.safeParse(rawName);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  const name = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  if (user.email && name.toLowerCase() === user.email.trim().toLowerCase()) {
    throw new Error("Please enter your business's name, not your email address.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("No profile found for your account.");

  const admin = createAdminClient();
  const { error } = await admin
    .from("organizations")
    .update({ name })
    .eq("id", profile.org_id);
  if (error) throw new Error("Couldn't save your business name. Please try again.");

  // Refresh the (app) layout so the gate re-reads the new name and the
  // sidebar/PDF header pick it up immediately.
  revalidatePath("/", "layout");
  return { ok: true };
}

const HEX = /^#[0-9a-fA-F]{6}$/;

function makeSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 8);
  return base ? `${base}-${suffix}` : suffix;
}

/** Same draft shape as createTemplateFromText (paragraphs → blocks). */
function buildDraft(name: string, text: string): DraftContent {
  const paragraphs = text
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return {
    title: name,
    blocks: paragraphs.map((p) => ({ type: "paragraph" as const, text: p })),
    fields: [{ key: "signer_email", type: "email", label: "Email", required: true }],
    consent_text: DEFAULT_CONSENT_TEXT,
    minor_mode: "allowed",
  };
}

/**
 * Finish the first-run wizard: save the business name + brand color, then set up
 * the first waiver based on the Step-1 choice, and return where to send the user.
 * - a starter id  → seed a draft from that starter → editor
 * - "blank"       → seed a minimal draft → editor
 * - "upload"      → the AI-import flow (/waivers/new)
 * Failures degrade to the dashboard rather than trapping the user in onboarding.
 */
export async function completeOnboarding(input: {
  businessName: string;
  color: string;
  starterId: string;
}): Promise<{ ok: true; redirectTo: string } | { ok: false; error: string }> {
  const parsed = nameSchema.safeParse(input.businessName);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const name = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (user.email && name.toLowerCase() === user.email.trim().toLowerCase()) {
    return { ok: false, error: "Please enter your business's name, not your email address." };
  }

  const { data: profile } = await supabase.from("profiles").select("org_id").single();
  if (!profile) return { ok: false, error: "No profile found for your account." };

  const admin = createAdminClient();

  // Save the business name + brand color (merge color into the branding jsonb so
  // any existing logo_path is preserved).
  const { data: org } = await admin
    .from("organizations")
    .select("branding")
    .eq("id", profile.org_id)
    .single();
  const color = HEX.test(input.color) ? input.color : "#4F46E5";
  const branding = { ...((org?.branding as Record<string, unknown>) ?? {}), color };
  const { error: orgErr } = await admin
    .from("organizations")
    .update({ name, branding })
    .eq("id", profile.org_id);
  if (orgErr) return { ok: false, error: "Couldn't save your setup. Please try again." };

  revalidatePath("/", "layout");

  // Skip → straight to the dashboard (name + color are saved; no waiver seeded).
  if (input.starterId === "skip") {
    return { ok: true, redirectTo: "/dashboard" };
  }
  if (input.starterId === "upload") {
    return { ok: true, redirectTo: "/waivers/new" };
  }

  // Creating a template needs a usable (trialing/active) subscription — onboarding
  // users are trialing. If somehow not, drop them at the dashboard.
  const { data: sub } = await admin
    .from("subscriptions")
    .select("status")
    .eq("org_id", profile.org_id)
    .maybeSingle();
  if (!subscriptionIsUsable(sub?.status)) {
    return { ok: true, redirectTo: "/dashboard" };
  }

  const starter = STARTER_BY_ID.get(input.starterId);
  const draftName = starter?.name ?? "Adult Liability Waiver";
  const draft = buildDraft(draftName, starter?.text ?? "");

  const { data: template, error: tErr } = await admin
    .from("waiver_templates")
    .insert({
      org_id: profile.org_id,
      slug: makeSlug(draftName),
      name: draftName,
      status: "draft",
      draft_content: draft,
    })
    .select("id")
    .single();
  if (tErr || !template) {
    return { ok: true, redirectTo: "/dashboard" };
  }

  return { ok: true, redirectTo: `/waivers/${template.id}` };
}
