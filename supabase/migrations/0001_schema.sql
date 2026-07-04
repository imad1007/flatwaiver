-- FlatWaiver core schema (spec §5, verbatim)

create extension if not exists pg_trgm;

-- ── organizations ────────────────────────────────────────────
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  waiver_volume_band text,          -- from signup dropdown: '<100' | '100-300' | '300-1000' | '1000+'
  created_at timestamptz not null default now()
);

-- ── profiles (1:1 with auth.users) ───────────────────────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references organizations(id),
  email text not null,
  role text not null default 'owner',
  created_at timestamptz not null default now()
);

-- ── waiver_templates (mutable shell; content lives in versions)
create table waiver_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  slug text not null unique,                      -- public URL: /w/[slug]
  name text not null,
  status text not null default 'draft'
    check (status in ('draft','published','archived')),
  current_version_id uuid,                        -- FK added below
  source_pdf_path text,                           -- original uploaded PDF (storage)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── template_versions (IMMUTABLE, append-only) ───────────────
create table template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references waiver_templates(id) on delete restrict,
  version_number int not null,
  body jsonb not null,          -- ordered blocks: [{type:'heading'|'paragraph'|'list', ...}]
  fields jsonb not null,        -- signer inputs: [{key,type,label,required}]
  consent_text text not null,   -- exact e-sign consent string displayed to signer
  minor_mode text not null default 'allowed'
    check (minor_mode in ('allowed','disallowed')),
  content_sha256 text not null, -- sha256 of canonical JSON(body+fields+consent_text)
  created_at timestamptz not null default now(),
  unique (template_id, version_number)
);

alter table waiver_templates
  add constraint fk_current_version
  foreign key (current_version_id) references template_versions(id);

-- ── signed_waivers (IMMUTABLE, append-only) ──────────────────
create table signed_waivers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  template_id uuid not null references waiver_templates(id),
  template_version_id uuid not null references template_versions(id),
  signer_name text not null,                -- typed legal name
  signer_email text,
  signer_dob date,
  is_minor boolean not null default false,
  guardian_name text,
  guardian_relationship text,
  field_values jsonb not null default '{}'::jsonb,
  signature_path text not null,             -- storage: signature PNG
  guardian_signature_path text,
  pdf_path text not null,                   -- storage: final rendered PDF
  pdf_sha256 text not null,
  consent_given boolean not null,
  consent_text_snapshot text not null,      -- copied from version at sign time
  signed_at timestamptz not null default now(),
  ip inet,
  user_agent text,
  signing_channel text not null default 'link'
    check (signing_channel in ('link','kiosk','qr')),
  created_at timestamptz not null default now()
);

create index idx_signed_org_date on signed_waivers (org_id, signed_at desc);
create index idx_signed_name_trgm on signed_waivers using gin (signer_name gin_trgm_ops);

-- ── subscriptions (Stripe mirror) ────────────────────────────
create table subscriptions (
  org_id uuid primary key references organizations(id),
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'trialing',   -- trialing|active|past_due|canceled
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

-- ── immutability enforcement ─────────────────────────────────
create or replace function forbid_change() returns trigger
language plpgsql as $$
begin
  raise exception 'append-only table: % cannot be modified', tg_table_name;
end $$;

create trigger template_versions_immutable
  before update or delete on template_versions
  for each row execute function forbid_change();

create trigger signed_waivers_immutable
  before update or delete on signed_waivers
  for each row execute function forbid_change();
