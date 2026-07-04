-- Row Level Security (spec §5, verbatim).
-- anon gets ZERO policies: anonymous visitors never talk to Supabase directly.

alter table organizations   enable row level security;
alter table profiles        enable row level security;
alter table waiver_templates enable row level security;
alter table template_versions enable row level security;
alter table signed_waivers  enable row level security;
alter table subscriptions   enable row level security;

create or replace function auth_org_id() returns uuid
language sql stable as $$
  select org_id from profiles where id = auth.uid()
$$;

create policy org_select on organizations for select
  using (id = auth_org_id());
create policy profile_self on profiles for select
  using (id = auth.uid());

create policy tpl_all on waiver_templates for all
  using (org_id = auth_org_id()) with check (org_id = auth_org_id());

create policy ver_select on template_versions for select
  using (template_id in (select id from waiver_templates where org_id = auth_org_id()));
create policy ver_insert on template_versions for insert
  with check (template_id in (select id from waiver_templates where org_id = auth_org_id()));

create policy sig_select on signed_waivers for select
  using (org_id = auth_org_id());
-- note: NO insert policy for signed_waivers — inserts happen only via service role on the server

create policy sub_select on subscriptions for select
  using (org_id = auth_org_id());
