-- Privacy-safe, authoritative activation milestones.
-- These rows contain organization-level timing only: no signer identity,
-- waiver content, filenames, or other customer-submitted values.

create table activation_milestones (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  milestone text not null
    check (milestone in ('first_published_waiver', 'first_signature')),
  occurred_at timestamptz not null,
  source_id uuid not null,
  created_at timestamptz not null default now(),
  unique (org_id, milestone)
);
create index idx_activation_milestone on activation_milestones (milestone, occurred_at);

alter table activation_milestones enable row level security;
create policy activation_select on activation_milestones for select
  using (org_id = auth_org_id());

create trigger activation_milestones_immutable
  before update or delete on activation_milestones
  for each row execute function forbid_change();

-- Backfill only versions that are still the live pointer of a successfully
-- published (or subsequently archived) template. Historical versions that
-- were inserted by the legacy first half of a failed publish are deliberately
-- excluded because they were never made live.
insert into activation_milestones (org_id, milestone, occurred_at, source_id)
select distinct on (t.org_id)
  t.org_id, 'first_published_waiver', v.created_at, v.id
from waiver_templates t
join template_versions v
  on v.id = t.current_version_id
 and v.template_id = t.id
where t.status in ('published', 'archived')
order by t.org_id, v.created_at, v.id
on conflict (org_id, milestone) do nothing;

insert into activation_milestones (org_id, milestone, occurred_at, source_id)
select distinct on (s.org_id)
  s.org_id, 'first_signature', s.signed_at, s.id
from signed_waivers s
order by s.org_id, s.signed_at, s.id
on conflict (org_id, milestone) do nothing;

create or replace function record_first_published_waiver()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published' and new.current_version_id is not null then
    insert into activation_milestones (org_id, milestone, occurred_at, source_id)
    values (new.org_id, 'first_published_waiver', now(), new.current_version_id)
    on conflict (org_id, milestone) do nothing;
  end if;
  return new;
end
$$;

create trigger record_first_published_waiver_trigger
  after update of status, current_version_id on waiver_templates
  for each row execute function record_first_published_waiver();

create or replace function record_first_signature()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into activation_milestones (org_id, milestone, occurred_at, source_id)
  values (new.org_id, 'first_signature', new.signed_at, new.id)
  on conflict (org_id, milestone) do nothing;
  return new;
end
$$;

create trigger record_first_signature_trigger
  after insert on signed_waivers
  for each row execute function record_first_signature();

create view admin_activation_funnel
with (security_invoker = true)
as
select
  count(*)::bigint as total_orgs,
  count(p.org_id)::bigint as published_orgs,
  count(s.org_id)::bigint as signed_orgs,
  percentile_cont(0.5) within group (
    order by extract(epoch from (p.occurred_at - o.created_at)) / 3600
  ) filter (where p.org_id is not null) as median_hours_to_publish,
  percentile_cont(0.5) within group (
    order by extract(epoch from (s.occurred_at - o.created_at)) / 3600
  ) filter (where s.org_id is not null) as median_hours_to_signature
from organizations o
left join activation_milestones p
  on p.org_id = o.id and p.milestone = 'first_published_waiver'
left join activation_milestones s
  on s.org_id = o.id and s.milestone = 'first_signature';
