-- A registration ID stays available until the browser has queued a delivery
-- attempt. The old claimed_at value is deliberately not consulted: this lets
-- registrations lost by the previous eager-claim flow retry with the same ID.
alter table public.registration_measurements
  add column delivery_queued_at timestamptz;

create function public.reserve_registration_measurement(p_user uuid) returns uuid
language sql security definer set search_path = '' as $$
  select m.event_id
  from public.registration_measurements m
  where m.user_id = p_user
    and m.delivery_queued_at is null
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
    );
$$;
revoke all on function public.reserve_registration_measurement(uuid) from public, anon, authenticated;
grant execute on function public.reserve_registration_measurement(uuid) to service_role;

-- Keep the old RPC safe during a migration-first rollout. Older application
-- instances may still call it briefly; returning the stable reservation avoids
-- recreating the eager-consumption failure while OpenAI deduplicates retries.
create or replace function public.claim_registration_measurement(p_user uuid) returns uuid
language sql security definer set search_path = '' as $$
  select public.reserve_registration_measurement(p_user);
$$;
revoke all on function public.claim_registration_measurement(uuid) from public, anon, authenticated;
grant execute on function public.claim_registration_measurement(uuid) to service_role;

create function public.complete_registration_measurement(p_user uuid, p_event uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.registration_measurements
    set delivery_queued_at = coalesce(delivery_queued_at, now())
    where user_id = p_user and event_id = p_event
      and created_at > now() - interval '7 days';
  return found;
end;
$$;
revoke all on function public.complete_registration_measurement(uuid, uuid) from public, anon, authenticated;
grant execute on function public.complete_registration_measurement(uuid, uuid) to service_role;
