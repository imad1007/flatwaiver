-- 0008 — Admin panel: blog CMS storage + a read-only cross-org overview view.
-- Forward-only (never edits 0001–0007). Apply in the Supabase SQL editor.

-- ── blog_posts (admin-authored posts) ────────────────────────
-- The 5 cornerstone posts stay as MDX files in git; these are posts created
-- from the admin panel and merged into the public blog at render time.
create table if not exists blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null,
  -- Sanitized HTML (pasted HTML is cleaned server-side before insert; plain
  -- paragraphs are converted to <p>…</p>). Body starts at <h2> — the page
  -- renders the <h1> from `title`, so there's exactly one h1 per post.
  body_html text not null default '',
  tags text[] not null default '{}',
  keywords text[] not null default '{}',
  author text not null default 'FlatWaiver Team',
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_blog_posts_pub
  on blog_posts (status, published_at desc);

alter table blog_posts enable row level security;

-- The public marketing site reads published posts. Drafts are never exposed to
-- anon/authenticated; all writes go through the service role (admin actions),
-- which bypasses RLS — so there is deliberately no insert/update/delete policy.
drop policy if exists blog_posts_public_read on blog_posts;
create policy blog_posts_public_read on blog_posts
  for select using (status = 'published');

-- ── admin_org_overview ───────────────────────────────────────
-- One row per organization with owner, subscription, and usage aggregates for
-- the admin Customers table. security_invoker = on so the querying role's RLS
-- applies: the service role (admin) sees every org; a normal authenticated user
-- would only ever see their own — this view can never leak cross-tenant data.
create or replace view admin_org_overview
with (security_invoker = on) as
select
  o.id                              as org_id,
  o.name,
  o.created_at,
  o.waiver_volume_band,
  owner.id                          as owner_user_id,
  owner.email                       as owner_email,
  s.status,
  s.trial_ends_at,
  s.current_period_end,
  coalesce(t.template_count, 0)     as template_count,
  coalesce(t.published_count, 0)    as published_count,
  coalesce(v.version_count, 0)      as version_count,
  coalesce(w.signature_count, 0)    as signature_count,
  coalesce(w.signatures_this_month, 0) as signatures_this_month,
  w.last_signed_at
from organizations o
left join lateral (
  select p.id, p.email
  from profiles p
  where p.org_id = o.id
  order by p.created_at asc
  limit 1
) owner on true
left join subscriptions s on s.org_id = o.id
left join (
  select org_id,
    count(*)                                    as template_count,
    count(*) filter (where status = 'published') as published_count
  from waiver_templates
  group by org_id
) t on t.org_id = o.id
left join (
  select wt.org_id, count(*) as version_count
  from template_versions tv
  join waiver_templates wt on wt.id = tv.template_id
  group by wt.org_id
) v on v.org_id = o.id
left join (
  select org_id,
    count(*)                                                      as signature_count,
    count(*) filter (where signed_at >= date_trunc('month', now())) as signatures_this_month,
    max(signed_at)                                                as last_signed_at
  from signed_waivers
  group by org_id
) w on w.org_id = o.id;

grant select on admin_org_overview to service_role;
