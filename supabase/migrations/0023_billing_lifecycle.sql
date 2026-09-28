-- Trial grace/suspension is independent from template publication state.
-- Creem webhook status remains the authoritative paid-state source.
alter table public.subscriptions
  add column if not exists billing_grace_started_at timestamptz,
  add column if not exists public_signing_suspended_at timestamptz;

create index if not exists subscriptions_trial_lifecycle
  on public.subscriptions(trial_ends_at)
  where status = 'trialing' and trial_ends_at is not null;

-- Some production projects were bootstrapped before migration 0017 was
-- applied. Keep this migration self-contained for those projects while
-- preserving every existing delivery row when the table already exists.
create table if not exists public.billing_expiry_emails (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  episode text not null,
  recipient_email text not null,
  org_name text not null,
  status text not null default 'pending'
    check (status in ('pending','sending','sent','skipped','review')),
  first_attempt_at timestamptz,
  locked_until timestamptz,
  sent_at timestamptz,
  provider_id text,
  created_at timestamptz not null default now(),
  unique (org_id, recipient_id, kind, episode)
);
alter table public.billing_expiry_emails enable row level security;
revoke all on public.billing_expiry_emails from public, anon, authenticated;
grant all on public.billing_expiry_emails to service_role;

alter table public.billing_expiry_emails
  drop constraint if exists billing_expiry_emails_kind_check;
alter table public.billing_expiry_emails
  add constraint billing_expiry_emails_kind_check
  check (kind in ('trial-ended', 'suspension-warning', 'subscription-ended'));

-- Only currently relevant notices are candidates for delivery. If a scheduler
-- is late, stale grace-period emails are recorded as skipped by the processor.
create or replace view public.billing_expiry_candidates as
select s.org_id, p.id recipient_id, u.email recipient_email, o.name org_name,
  'trial-ended'::text kind, s.trial_ends_at::text episode
from public.subscriptions s
join public.organizations o on o.id = s.org_id
join public.profiles p on p.org_id = s.org_id and p.role = 'owner'
join auth.users u on u.id = p.id
where u.email is not null and s.status = 'trialing'
  and s.trial_ends_at <= now()
  and now() < s.trial_ends_at + interval '48 hours'
  and s.public_signing_suspended_at is null
union all
select s.org_id, p.id, u.email, o.name, 'suspension-warning'::text,
  s.trial_ends_at::text
from public.subscriptions s
join public.organizations o on o.id = s.org_id
join public.profiles p on p.org_id = s.org_id and p.role = 'owner'
join auth.users u on u.id = p.id
where u.email is not null and s.status = 'trialing'
  and now() >= s.trial_ends_at + interval '48 hours'
  and now() < s.trial_ends_at + interval '72 hours'
  and s.public_signing_suspended_at is null
union all
select s.org_id, p.id, u.email, o.name, 'subscription-ended'::text,
  coalesce(s.creem_subscription_id, s.stripe_subscription_id, 'manual') || '/' ||
    coalesce(s.current_period_end::text, 'unknown-period')
from public.subscriptions s
join public.organizations o on o.id = s.org_id
join public.profiles p on p.org_id = s.org_id and p.role = 'owner'
join auth.users u on u.id = p.id
where u.email is not null and s.status = 'canceled'
  and (s.current_period_end is null or s.current_period_end <= now());
revoke all on public.billing_expiry_candidates from public, anon, authenticated;
grant select on public.billing_expiry_candidates to service_role;

-- One transaction locks subscription rows, records lifecycle transitions and
-- claims email work. A simultaneous payment webhook waits on the same row and
-- then clears lifecycle state after setting status active.
create or replace function public.process_billing_lifecycle(p_limit integer default 20)
returns setof public.billing_expiry_emails
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.subscriptions
    where status in ('active', 'trialing', 'canceled')
    order by org_id for update;

  update public.subscriptions
    set billing_grace_started_at = null,
      public_signing_suspended_at = null
    where status = 'active'
      and (billing_grace_started_at is not null or public_signing_suspended_at is not null);

  update public.subscriptions
    set billing_grace_started_at = coalesce(billing_grace_started_at, trial_ends_at),
      public_signing_suspended_at = case
        when now() >= trial_ends_at + interval '72 hours'
          then coalesce(public_signing_suspended_at, now())
        else public_signing_suspended_at end
    where status = 'trialing' and trial_ends_at <= now();

  insert into public.billing_expiry_emails(
    org_id, recipient_id, kind, episode, recipient_email, org_name, status
  )
  select s.org_id, p.id, 'trial-ended', s.trial_ends_at::text, u.email, o.name,
    case when now() >= s.trial_ends_at + interval '48 hours' then 'skipped' else 'pending' end
  from public.subscriptions s
  join public.organizations o on o.id = s.org_id
  join public.profiles p on p.org_id = s.org_id and p.role = 'owner'
  join auth.users u on u.id = p.id
  where u.email is not null and s.status = 'trialing' and s.trial_ends_at <= now()
  on conflict (org_id, recipient_id, kind, episode) do nothing;

  insert into public.billing_expiry_emails(
    org_id, recipient_id, kind, episode, recipient_email, org_name, status
  )
  select s.org_id, p.id, 'suspension-warning', s.trial_ends_at::text, u.email, o.name,
    case when now() >= s.trial_ends_at + interval '72 hours' then 'skipped' else 'pending' end
  from public.subscriptions s
  join public.organizations o on o.id = s.org_id
  join public.profiles p on p.org_id = s.org_id and p.role = 'owner'
  join auth.users u on u.id = p.id
  where u.email is not null and s.status = 'trialing'
    and now() >= s.trial_ends_at + interval '48 hours'
  on conflict (org_id, recipient_id, kind, episode) do nothing;

  insert into public.billing_expiry_emails(
    org_id, recipient_id, kind, episode, recipient_email, org_name
  )
  select org_id, recipient_id, kind, episode, recipient_email, org_name
    from public.billing_expiry_candidates where kind = 'subscription-ended'
  on conflict (org_id, recipient_id, kind, episode) do nothing;

  update public.billing_expiry_emails e
    set recipient_email = c.recipient_email, org_name = c.org_name
    from public.billing_expiry_candidates c
    where e.org_id = c.org_id and e.recipient_id = c.recipient_id
      and e.kind = c.kind and e.episode = c.episode and e.first_attempt_at is null;

  update public.billing_expiry_emails set status = 'review'
    where status = 'sending' and first_attempt_at < now() - interval '23 hours';

  update public.billing_expiry_emails e set status = 'skipped'
    where e.status in ('pending', 'sending') and not exists (
      select 1 from public.billing_expiry_candidates c where c.org_id = e.org_id
      and c.recipient_id = e.recipient_id and c.kind = e.kind and c.episode = e.episode
    );

  return query
  with picked as (
    select e.id from public.billing_expiry_emails e
    where e.status = 'pending' or (e.status = 'sending' and e.locked_until < now()
      and e.first_attempt_at >= now() - interval '23 hours')
    order by e.created_at, e.id limit greatest(1, least(p_limit, 50))
    for update skip locked
  )
  update public.billing_expiry_emails e
    set status = 'sending', first_attempt_at = coalesce(e.first_attempt_at, now()),
      locked_until = now() + interval '5 minutes'
    from picked where e.id = picked.id returning e.*;
end;
$$;
revoke all on function public.process_billing_lifecycle(integer) from public, anon, authenticated;
grant execute on function public.process_billing_lifecycle(integer) to service_role;

-- Safe during a migration-first rollout while an older deployment is active.
create or replace function public.claim_billing_expiry_emails(p_limit integer default 20)
returns setof public.billing_expiry_emails
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.billing_expiry_emails(org_id, recipient_id, kind, episode, recipient_email, org_name)
    select org_id, recipient_id, kind, episode, recipient_email, org_name
    from public.billing_expiry_candidates where kind <> 'suspension-warning'
    on conflict (org_id, recipient_id, kind, episode) do nothing;

  update public.billing_expiry_emails set status = 'review'
    where kind <> 'suspension-warning' and status = 'sending'
      and first_attempt_at < now() - interval '23 hours';

  update public.billing_expiry_emails e set status = 'skipped'
    where e.kind <> 'suspension-warning' and e.status in ('pending', 'sending')
      and not exists (
        select 1 from public.billing_expiry_candidates c where c.org_id = e.org_id
        and c.recipient_id = e.recipient_id and c.kind = e.kind and c.episode = e.episode
      );

  return query
  with picked as (
    select e.id from public.billing_expiry_emails e
    where e.kind <> 'suspension-warning' and (
      e.status = 'pending' or (e.status = 'sending' and e.locked_until < now()
        and e.first_attempt_at >= now() - interval '23 hours'))
    order by e.created_at, e.id limit greatest(1, least(p_limit, 50))
    for update skip locked
  )
  update public.billing_expiry_emails e
    set status = 'sending', first_attempt_at = coalesce(e.first_attempt_at, now()),
      locked_until = now() + interval '5 minutes'
    from picked where e.id = picked.id returning e.*;
end;
$$;
revoke all on function public.claim_billing_expiry_emails(integer) from public, anon, authenticated;
grant execute on function public.claim_billing_expiry_emails(integer) to service_role;
