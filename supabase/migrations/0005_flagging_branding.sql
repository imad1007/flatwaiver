-- Phase 3 additive columns (approved 2026-07-04). Both are additive-only:
-- the immutability triggers, RLS policies, and evidence chain are untouched.

-- Flagged answers: evaluated server-side at sign time from the version's
-- field flag config. Set once at INSERT; the append-only trigger still
-- forbids any later UPDATE/DELETE, so evidence guarantees hold.
alter table signed_waivers
  add column flagged boolean not null default false;

create index idx_signed_flagged on signed_waivers (org_id, flagged)
  where flagged;

-- Org branding: logo (private storage path) + brand color, applied to the
-- public signing page and the generated PDF header.
-- Shape: { "logo_path": "<org_id>/branding/logo.png", "color": "#4F46E5" }
alter table organizations
  add column branding jsonb;
