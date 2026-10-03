-- Independent delivery state; OpenAI claims cannot consume TikTok events.
-- No historical backfill. Only future new-business candidates create rows.
create table public.tiktok_measurements (
  event_id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('registration', 'payment')),
  source_id text not null,
  user_id uuid references auth.users(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  subscription_id text,
  created_at timestamptz not null default now(),
  first_reserved_at timestamptz,
  delivery_queued_at timestamptz,
  unique(kind, source_id),
  check ((kind = 'registration' and user_id is not null and org_id is not null and subscription_id is null)
    or (kind = 'payment' and user_id is null and org_id is null and subscription_id is not null))
);
alter table public.tiktok_measurements enable row level security;
revoke all on public.tiktok_measurements from public, anon, authenticated;
grant all on public.tiktok_measurements to service_role;

create function public.create_tiktok_registration_candidate() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.tiktok_measurements(event_id, kind, source_id, user_id, org_id)
  values(new.event_id, 'registration', new.event_id::text, new.user_id, new.org_id);
  return new;
end;
$$;
revoke all on function public.create_tiktok_registration_candidate() from public, anon, authenticated;
grant execute on function public.create_tiktok_registration_candidate() to service_role;
create trigger tiktok_new_registration after insert on public.registration_measurements
for each row execute function public.create_tiktok_registration_candidate();

-- Service-role-only: the HTTP handler supplies the authenticated user's ID,
-- never an ID from the browser. Recheck ownership and completed bootstrap.
-- The narrowly granted definer reads auth.users, which is not a public API table.
create function public.eligible_tiktok_measurements(p_user uuid)
returns setof public.tiktok_measurements
language sql stable security definer set search_path = '' as $$
  select m.* from public.tiktok_measurements m
  join public.profiles p on p.id = p_user and p.role = 'owner'
  join public.organizations o on o.id = p.org_id
  join public.subscriptions s on s.org_id = o.id
  join auth.users u on u.id = p.id
  where u.email_confirmed_at is not null
    and length(trim(o.name)) > 0
    and lower(trim(o.name)) <> lower(trim(coalesce(u.email, '')))
    and m.created_at > now() - interval '7 days'
    -- TikTok deduplicates same event+ID for 48h. Never retry beyond that window.
    and (m.first_reserved_at is null or m.first_reserved_at > now() - interval '47 hours')
    and ((m.kind = 'registration' and m.user_id = p.id and m.org_id = o.id)
      or (m.kind = 'payment' and m.subscription_id = s.creem_subscription_id));
$$;
revoke all on function public.eligible_tiktok_measurements(uuid) from public, anon, authenticated;
grant execute on function public.eligible_tiktok_measurements(uuid) to service_role;

create function public.reserve_tiktok_measurements(p_user uuid)
returns setof public.tiktok_measurements
language sql security invoker set search_path = '' as $$
  update public.tiktok_measurements m
  set first_reserved_at = coalesce(m.first_reserved_at, now())
  where m.delivery_queued_at is null and m.event_id in (
    select e.event_id from public.eligible_tiktok_measurements(p_user) e
    order by e.created_at limit 10
  ) returning m.*;
$$;
revoke all on function public.reserve_tiktok_measurements(uuid) from public, anon, authenticated;
grant execute on function public.reserve_tiktok_measurements(uuid) to service_role;

create function public.complete_tiktok_measurement(p_user uuid, p_event uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.tiktok_measurements m set delivery_queued_at = coalesce(m.delivery_queued_at, now())
  where m.event_id = p_event and m.first_reserved_at is not null
    and m.event_id in (select e.event_id from public.eligible_tiktok_measurements(p_user) e);
  return found;
end;
$$;
revoke all on function public.complete_tiktok_measurement(uuid, uuid) from public, anon, authenticated;
grant execute on function public.complete_tiktok_measurement(uuid, uuid) to service_role;
