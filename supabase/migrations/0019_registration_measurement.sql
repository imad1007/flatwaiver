-- Only new business bootstraps create candidates. No historical backfill.
create table public.registration_measurements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null unique references public.organizations(id) on delete cascade,
  event_id uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);
alter table public.registration_measurements enable row level security;
revoke all on public.registration_measurements from public, anon, authenticated;
grant all on public.registration_measurements to service_role;

-- An atomic, single-use claim prevents duplicate browser events across tabs/devices.
create function public.claim_registration_measurement(p_user uuid) returns uuid
language sql security definer set search_path = '' as $$
  update public.registration_measurements m set claimed_at = now()
  where m.user_id = p_user and m.claimed_at is null
    and m.created_at > now() - interval '7 days'
    and exists (
      select 1 from public.profiles p
      join public.organizations o on o.id = p.org_id
      join public.subscriptions s on s.org_id = o.id
      join auth.users u on u.id = p.id
      where p.id = p_user and p.org_id = m.org_id and p.role = 'owner'
        and u.email_confirmed_at is not null
        and length(trim(o.name)) > 0
        and lower(trim(o.name)) <> lower(trim(coalesce(u.email, '')))
    )
  returning m.event_id;
$$;
revoke all on function public.claim_registration_measurement(uuid) from public, anon, authenticated;
grant execute on function public.claim_registration_measurement(uuid) to service_role;
