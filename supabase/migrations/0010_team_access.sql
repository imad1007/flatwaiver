-- Phase 1: Team & access — staff invitations, real roles, and an org audit log.
-- Additive only; does not touch 0001/0002. The profiles table already carries
-- (org_id, role), so multiple members per org needs no structural change —
-- only a role vocabulary, an invitations table, and an audit trail.

-- ── role vocabulary on profiles ──────────────────────────────
-- Previously free-text (only 'owner' was ever written). Lock it to the four
-- roles the permission layer understands (src/lib/permissions.ts).
alter table profiles
  add constraint profiles_role_check
  check (role in ('owner','admin','staff','viewer'));

-- ── invitations (pending teammates) ──────────────────────────
-- One pending invite per (org, email). Acceptance is driven by email match in
-- the auth bootstrap (src/lib/bootstrap.ts), so the token is a convenience for
-- the landing page, not the security boundary. You can never invite an 'owner'.
create table invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  role text not null default 'staff'
    check (role in ('admin','staff','viewer')),
  token uuid not null default gen_random_uuid(),
  invited_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  unique (org_id, email)
);
create index idx_invitations_token on invitations (token);
create index idx_invitations_email on invitations (lower(email));

-- ── audit_log (who did what, per org) ────────────────────────
-- Append-only in spirit; actor_id is null for system/automated events.
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  actor_id uuid,                 -- auth.users id; null = system
  actor_email text,
  action text not null,          -- e.g. 'member.invited', 'template.published'
  target text,                   -- human-readable label of the affected thing
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index idx_audit_org_date on audit_log (org_id, created_at desc);

-- ── RLS ──────────────────────────────────────────────────────
-- Reads are org-scoped for authenticated members; every write goes through the
-- service role after a server-side role check, so there are no insert/update/
-- delete policies here (anon keeps its zero-policy posture from 0002).
alter table invitations enable row level security;
alter table audit_log   enable row level security;

create policy inv_select on invitations for select
  using (org_id = auth_org_id());

create policy audit_select on audit_log for select
  using (org_id = auth_org_id());
