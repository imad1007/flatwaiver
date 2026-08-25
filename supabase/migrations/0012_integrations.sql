-- Phase 3: Integrations — API keys, outbound webhooks, and auto-tagging.
-- Additive only.

-- ── auto-tag ─────────────────────────────────────────────────
-- An opaque value passed via ?tag= on a signing link (e.g. a reservation or
-- customer id), stored on the signature at INSERT time. signed_waivers is
-- append-only, but this is DDL (ADD COLUMN) and does not trip the row-level
-- immutability trigger, and inserts are already allowed.
alter table signed_waivers add column tag text;
create index idx_signed_tag on signed_waivers (org_id, tag) where tag is not null;

-- ── API keys ─────────────────────────────────────────────────
-- Only a sha256 hash is stored; the plaintext key is shown exactly once at
-- creation. `prefix` is a short visible fragment for identifying a key later.
create table api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  prefix text not null,
  token_hash text not null unique,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index idx_api_keys_org on api_keys (org_id);

-- ── webhook endpoints ────────────────────────────────────────
-- POSTed on signature.created, HMAC-SHA256 signed with `secret`.
create table webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  url text not null,
  secret text not null,
  enabled boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_webhooks_org on webhook_endpoints (org_id);

-- ── webhook delivery log (recent attempts, for debugging) ────
create table webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  endpoint_id uuid not null references webhook_endpoints(id) on delete cascade,
  event text not null,
  status_code int,
  ok boolean not null default false,
  error text,
  created_at timestamptz not null default now()
);
create index idx_deliveries_endpoint on webhook_deliveries (endpoint_id, created_at desc);

-- ── RLS ──────────────────────────────────────────────────────
-- Org-scoped reads for authenticated members; all writes go through the service
-- role after a role check. API auth itself is by key hash (service role), never
-- via these policies. anon keeps zero policies.
alter table api_keys           enable row level security;
alter table webhook_endpoints  enable row level security;
alter table webhook_deliveries enable row level security;

create policy apikey_select on api_keys for select
  using (org_id = auth_org_id());
create policy webhook_select on webhook_endpoints for select
  using (org_id = auth_org_id());
create policy delivery_select on webhook_deliveries for select
  using (org_id = auth_org_id());
