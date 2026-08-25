-- Phase 2: Signer growth loop — waiver renewal windows + re-sign reminders.
-- Additive only.

-- ── waiver renewal window ────────────────────────────────────
-- How long a signature stays valid before the signer should re-sign. NULL =
-- never expires (the default, preserving today's behaviour). Lives on the
-- mutable template shell, not template_versions — it's operational policy, not
-- versioned legal content, so changing it must not mint a new version.
alter table waiver_templates
  add column expiry_months int
  check (expiry_months is null or (expiry_months >= 1 and expiry_months <= 120));

-- ── reminder ledger (dedupe) ─────────────────────────────────
-- signed_waivers is immutable, so we can't stamp "reminded" on it. This side
-- table records that a reminder was sent for a given signed waiver so the cron
-- and manual sends never email the same person twice for the same signature.
create table signature_reminders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  signed_waiver_id uuid not null references signed_waivers(id) on delete cascade,
  kind text not null default 'resign' check (kind in ('resign')),
  sent_at timestamptz not null default now(),
  unique (signed_waiver_id, kind)
);
create index idx_reminders_org on signature_reminders (org_id);

alter table signature_reminders enable row level security;
create policy reminder_select on signature_reminders for select
  using (org_id = auth_org_id());
