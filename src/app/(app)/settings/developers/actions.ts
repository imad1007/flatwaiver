"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrgRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { generateApiKey } from "@/lib/api-keys";

/** Create an API key. Returns the plaintext key ONCE — it can't be shown again. */
export async function createApiKey(rawName: string) {
  const caller = await requireOrgRole("admin");
  const name = z.string().trim().min(1, "Name your key.").max(60).parse(rawName);

  const { full, prefix, hash } = generateApiKey();
  const admin = createAdminClient();
  const { error } = await admin.from("api_keys").insert({
    org_id: caller.orgId,
    name,
    prefix,
    token_hash: hash,
    created_by: caller.userId,
  });
  if (error) throw new Error("Couldn't create the API key.");

  await logAudit({
    orgId: caller.orgId,
    actorId: caller.userId,
    actorEmail: caller.email,
    action: "apikey.created",
    target: name,
  });

  revalidatePath("/settings/developers");
  return { key: full, prefix };
}

/** Revoke an API key (irreversible; existing integrations using it stop working). */
export async function revokeApiKey(keyId: string) {
  const caller = await requireOrgRole("admin");
  const admin = createAdminClient();
  const { data: key } = await admin
    .from("api_keys")
    .select("id, org_id, name")
    .eq("id", keyId)
    .maybeSingle();
  if (!key || key.org_id !== caller.orgId) throw new Error("Key not found.");

  await admin
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId);
  await logAudit({
    orgId: caller.orgId,
    actorId: caller.userId,
    actorEmail: caller.email,
    action: "apikey.revoked",
    target: key.name,
  });

  revalidatePath("/settings/developers");
  return { ok: true };
}

/** Add a webhook endpoint. Returns the signing secret ONCE for the operator to store. */
export async function addWebhook(rawUrl: string) {
  const caller = await requireOrgRole("admin");
  const url = z
    .string()
    .trim()
    .url("Enter a valid URL.")
    .startsWith("https://", "Webhook URLs must be https.")
    .max(2048)
    .parse(rawUrl);

  const secret = `whsec_${randomBytes(24).toString("base64url")}`;
  const admin = createAdminClient();
  const { error } = await admin.from("webhook_endpoints").insert({
    org_id: caller.orgId,
    url,
    secret,
    created_by: caller.userId,
  });
  if (error) throw new Error("Couldn't add the webhook.");

  await logAudit({
    orgId: caller.orgId,
    actorId: caller.userId,
    actorEmail: caller.email,
    action: "webhook.added",
    target: url,
  });

  revalidatePath("/settings/developers");
  return { secret };
}

export async function deleteWebhook(webhookId: string) {
  const caller = await requireOrgRole("admin");
  const admin = createAdminClient();
  const { data: wh } = await admin
    .from("webhook_endpoints")
    .select("id, org_id, url")
    .eq("id", webhookId)
    .maybeSingle();
  if (!wh || wh.org_id !== caller.orgId) throw new Error("Webhook not found.");

  await admin.from("webhook_endpoints").delete().eq("id", webhookId);
  await logAudit({
    orgId: caller.orgId,
    actorId: caller.userId,
    actorEmail: caller.email,
    action: "webhook.deleted",
    target: wh.url,
  });

  revalidatePath("/settings/developers");
  return { ok: true };
}

export async function toggleWebhook(webhookId: string, enabled: boolean) {
  const caller = await requireOrgRole("admin");
  const admin = createAdminClient();
  const { data: wh } = await admin
    .from("webhook_endpoints")
    .select("id, org_id")
    .eq("id", webhookId)
    .maybeSingle();
  if (!wh || wh.org_id !== caller.orgId) throw new Error("Webhook not found.");

  await admin.from("webhook_endpoints").update({ enabled }).eq("id", webhookId);
  revalidatePath("/settings/developers");
  return { ok: true };
}
