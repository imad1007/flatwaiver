import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { expiresAt, expiryState, type ExpiryState } from "@/lib/expiry";

export interface RenewalItem {
  signedWaiverId: string;
  orgId: string;
  templateId: string;
  templateName: string;
  templateSlug: string;
  signerName: string;
  signerEmail: string | null;
  signedAt: string;
  expiresAtIso: string;
  state: Exclude<ExpiryState, "active">;
  remindedAt: string | null;
}

const PAGE_SIZE = 1000;
const IN_FILTER_CHUNK_SIZE = 100;

type RenewalTemplateRow = {
  id: string;
  org_id: string;
  name: string;
  slug: string;
  expiry_months: number | null;
};

type RenewalSignatureRow = {
  id: string;
  org_id: string;
  template_id: string;
  signer_name: string;
  signer_email: string | null;
  signed_at: string;
};

/**
 * Renewals due (expiring or expired) for one org — or every org when orgId is
 * null (the cron path). Dedupes to each signer's LATEST signature per template,
 * because a later re-sign supersedes an earlier one. Identity is the signer's
 * email when present, else their name.
 */
export async function findRenewalsDue(orgId: string | null): Promise<RenewalItem[]> {
  const admin = createAdminClient();

  const templates: RenewalTemplateRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = admin
      .from("waiver_templates")
      .select("id, org_id, name, slug, expiry_months")
      .not("expiry_months", "is", null)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (orgId) query = query.eq("org_id", orgId);
    const { data, error } = await query;
    if (error) throw new Error(`Couldn't load renewal-enabled waivers: ${error.message}`);
    const page = (data ?? []) as RenewalTemplateRow[];
    templates.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  if (templates.length === 0) return [];

  const tplById = new Map(templates.map((t) => [t.id, t]));
  const templateIds = templates.map((t) => t.id);

  const sigs: RenewalSignatureRow[] = [];
  for (let chunkStart = 0; chunkStart < templateIds.length; chunkStart += IN_FILTER_CHUNK_SIZE) {
    const ids = templateIds.slice(chunkStart, chunkStart + IN_FILTER_CHUNK_SIZE);
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await admin
        .from("signed_waivers")
        .select("id, org_id, template_id, signer_name, signer_email, signed_at")
        .in("template_id", ids)
        .order("signed_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(`Couldn't load signatures for renewals: ${error.message}`);
      const page = (data ?? []) as RenewalSignatureRow[];
      sigs.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
  }
  if (sigs.length === 0) return [];
  sigs.sort((a, b) => b.signed_at.localeCompare(a.signed_at));

  // Rows are newest-first, so the first time we see an identity is its latest.
  const seen = new Set<string>();
  const latest: typeof sigs = [];
  for (const s of sigs) {
    const identity = (s.signer_email ?? s.signer_name ?? s.id).trim().toLowerCase();
    const key = `${s.template_id}::${identity}`;
    if (seen.has(key)) continue;
    seen.add(key);
    latest.push(s);
  }

  const now = new Date();
  const due = latest.filter((s) => {
    const state = expiryState(s.signed_at, tplById.get(s.template_id)?.expiry_months, now);
    return state === "expiring" || state === "expired";
  });
  if (due.length === 0) return [];

  const reminders: { signed_waiver_id: string; sent_at: string }[] = [];
  const dueIds = due.map((s) => s.id);
  for (let start = 0; start < dueIds.length; start += IN_FILTER_CHUNK_SIZE) {
    const { data, error } = await admin
      .from("signature_reminders")
      .select("signed_waiver_id, sent_at")
      .eq("kind", "resign")
      .in("signed_waiver_id", dueIds.slice(start, start + IN_FILTER_CHUNK_SIZE));
    if (error) throw new Error(`Couldn't load renewal reminders: ${error.message}`);
    reminders.push(...((data ?? []) as typeof reminders));
  }
  const remindedById = new Map(
    reminders.map((r) => [r.signed_waiver_id, r.sent_at])
  );

  return due
    .map((s): RenewalItem => {
      const tpl = tplById.get(s.template_id)!;
      const state = expiryState(s.signed_at, tpl.expiry_months, now) as Exclude<
        ExpiryState,
        "active"
      >;
      return {
        signedWaiverId: s.id,
        orgId: s.org_id,
        templateId: s.template_id,
        templateName: tpl.name,
        templateSlug: tpl.slug,
        signerName: s.signer_name,
        signerEmail: s.signer_email,
        signedAt: s.signed_at,
        expiresAtIso: expiresAt(s.signed_at, tpl.expiry_months)!.toISOString(),
        state,
        remindedAt: remindedById.get(s.id) ?? null,
      };
    })
    .sort((a, b) => a.expiresAtIso.localeCompare(b.expiresAtIso));
}
