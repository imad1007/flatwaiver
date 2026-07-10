-- Front-desk check-ins: operational attendance records that reference signed
-- waivers. Deliberately a separate table — signed_waivers stays untouched,
-- append-only legal evidence. Check-ins are staff actions and may be deleted
-- (undo a misclick); they carry no evidentiary weight.

create table checkins (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  signed_waiver_id uuid not null references signed_waivers(id),
  checked_in_at timestamptz not null default now(),
  checked_in_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index idx_checkins_org_date on checkins (org_id, checked_in_at desc);
create index idx_checkins_waiver on checkins (signed_waiver_id);

alter table checkins enable row level security;

-- Org members manage their own org's check-ins. anon gets zero policies,
-- consistent with the rest of the schema.
create policy checkin_select on checkins for select
  using (org_id = auth_org_id());
create policy checkin_insert on checkins for insert
  with check (
    org_id = auth_org_id()
    and signed_waiver_id in (select id from signed_waivers where org_id = auth_org_id())
  );
create policy checkin_delete on checkins for delete
  using (org_id = auth_org_id());
