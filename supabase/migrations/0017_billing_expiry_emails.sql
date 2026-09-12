-- Durable, owner-only billing notices. No signature records or access rules change.
create table public.billing_expiry_emails (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('trial-ended', 'subscription-ended')),
  episode text not null,
  recipient_email text not null,
  org_name text not null,
  status text not null default 'pending' check (status in ('pending','sending','sent','skipped','review')),
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

-- Active subscriptions (including scheduled cancellations) are never candidates.
-- Read the current Auth email, rather than a potentially stale profile email.
create view public.billing_expiry_candidates as
select s.org_id, p.id recipient_id, u.email recipient_email, o.name org_name,
  case when s.status = 'trialing' then 'trial-ended' else 'subscription-ended' end kind,
  case when s.status = 'trialing' then s.trial_ends_at::text
    else coalesce(s.creem_subscription_id, s.stripe_subscription_id, 'manual') || '/' || coalesce(s.current_period_end::text, 'unknown-period') end episode
from public.subscriptions s
join public.organizations o on o.id = s.org_id
join public.profiles p on p.org_id = s.org_id and p.role = 'owner'
join auth.users u on u.id = p.id
where u.email is not null and (
  (s.status = 'trialing' and s.trial_ends_at <= now()) or
  (s.status = 'canceled' and (s.current_period_end is null or s.current_period_end <= now()))
);
revoke all on public.billing_expiry_candidates from public, anon, authenticated;
grant select on public.billing_expiry_candidates to service_role;

create function public.claim_billing_expiry_emails(p_limit integer default 20)
returns setof public.billing_expiry_emails
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.billing_expiry_emails(org_id, recipient_id, kind, episode, recipient_email, org_name)
    select org_id, recipient_id, kind, episode, recipient_email, org_name
    from public.billing_expiry_candidates
    on conflict (org_id, recipient_id, kind, episode) do nothing;

  -- Refresh recipient details only before the first attempt, keeping retry payloads stable.
  update public.billing_expiry_emails e
    set recipient_email = c.recipient_email, org_name = c.org_name
    from public.billing_expiry_candidates c
    where e.org_id = c.org_id and e.recipient_id = c.recipient_id
      and e.kind = c.kind and e.episode = c.episode and e.first_attempt_at is null;

  -- Never automatically retry an uncertain send after Resend's 24h dedupe window.
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
revoke all on function public.claim_billing_expiry_emails(integer) from public, anon, authenticated;
grant execute on function public.claim_billing_expiry_emails(integer) to service_role;
