import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableError } from "@/lib/blog-db";
import { APP } from "@/lib/config";
import type { SubscriptionStatus } from "@/lib/types";

/**
 * Cross-tenant read model for the admin panel. Data comes from the
 * admin_org_overview view (migration 0008) via the service role, joined with
 * each owner's auth ban state (suspend/restore uses Supabase's built-in ban, so
 * suspension needs no schema of its own).
 */

export interface CustomerRow {
  orgId: string;
  name: string;
  createdAt: string;
  ownerEmail: string | null;
  ownerUserId: string | null;
  status: SubscriptionStatus | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  templateCount: number;
  publishedCount: number;
  versionCount: number;
  signatureCount: number;
  signaturesThisMonth: number;
  lastSignedAt: string | null;
  suspended: boolean;
  /** Safe to hard-delete: no signatures and no published versions (see actions). */
  deletable: boolean;
}

export interface AdminOverview {
  /** False when migration 0008 hasn't been applied yet. */
  ready: boolean;
  rows: CustomerRow[];
  stats: {
    totalOrgs: number;
    active: number;
    trialing: number;
    pastDue: number;
    canceled: number;
    noSub: number;
    suspended: number;
    totalSignatures: number;
    signaturesThisMonth: number;
    estMrrUsd: number;
  };
}

interface OverviewRow {
  org_id: string;
  name: string;
  created_at: string;
  owner_user_id: string | null;
  owner_email: string | null;
  status: SubscriptionStatus | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  template_count: number;
  published_count: number;
  version_count: number;
  signature_count: number;
  signatures_this_month: number;
  last_signed_at: string | null;
}

/** Map of auth user id → true when currently banned (suspended). */
async function bannedUserIds(): Promise<Set<string>> {
  const admin = createAdminClient();
  const banned = new Set<string>();
  const perPage = 1000;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) break;
    const users = data?.users ?? [];
    for (const u of users) {
      const until = (u as { banned_until?: string | null }).banned_until;
      if (until && new Date(until).getTime() > Date.now()) banned.add(u.id);
    }
    if (users.length < perPage) break;
  }
  return banned;
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("admin_org_overview")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingTableError(error)) {
      return { ready: false, rows: [], stats: emptyStats() };
    }
    throw error;
  }

  const banned = await bannedUserIds();
  const rows: CustomerRow[] = (data as OverviewRow[]).map((r) => ({
    orgId: r.org_id,
    name: r.name,
    createdAt: r.created_at,
    ownerEmail: r.owner_email,
    ownerUserId: r.owner_user_id,
    status: r.status,
    trialEndsAt: r.trial_ends_at,
    currentPeriodEnd: r.current_period_end,
    templateCount: Number(r.template_count),
    publishedCount: Number(r.published_count),
    versionCount: Number(r.version_count),
    signatureCount: Number(r.signature_count),
    signaturesThisMonth: Number(r.signatures_this_month),
    lastSignedAt: r.last_signed_at,
    suspended: r.owner_user_id ? banned.has(r.owner_user_id) : false,
    deletable: Number(r.signature_count) === 0 && Number(r.version_count) === 0,
  }));

  const stats = {
    totalOrgs: rows.length,
    active: rows.filter((r) => r.status === "active").length,
    trialing: rows.filter((r) => r.status === "trialing").length,
    pastDue: rows.filter((r) => r.status === "past_due").length,
    canceled: rows.filter((r) => r.status === "canceled").length,
    noSub: rows.filter((r) => !r.status).length,
    suspended: rows.filter((r) => r.suspended).length,
    totalSignatures: rows.reduce((s, r) => s + r.signatureCount, 0),
    signaturesThisMonth: rows.reduce((s, r) => s + r.signaturesThisMonth, 0),
    estMrrUsd: 0,
  };
  stats.estMrrUsd = stats.active * APP.priceMonthlyUsd;

  return { ready: true, rows, stats };
}

function emptyStats(): AdminOverview["stats"] {
  return {
    totalOrgs: 0,
    active: 0,
    trialing: 0,
    pastDue: 0,
    canceled: 0,
    noSub: 0,
    suspended: 0,
    totalSignatures: 0,
    signaturesThisMonth: 0,
    estMrrUsd: 0,
  };
}
