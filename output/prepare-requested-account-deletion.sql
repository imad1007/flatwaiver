-- Run this file in the FlatWaiver Supabase SQL Editor as postgres.
-- INSTALLATION ONLY: this does not delete data.
-- Only service_role can execute this helper; it accepts no account IDs.
-- Remove the helper after the deletion has been verified:
-- drop function public.purge_requested_accounts_20260914(boolean);

create or replace function public.purge_requested_accounts_20260914(p_execute boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  users_to_remove uuid[] := array[
    '0cd23605-abf1-4f53-9650-b98eb30fcda1',
    'a990875c-d226-49bb-9c50-afacad82eaef',
    '9696e3f7-ed2f-47a2-92be-1cbc6f07742b'
  ]::uuid[];
  orgs_to_remove uuid[] := array[
    'fe1e2721-df27-4fe2-a466-cd2dbd0d9c29',
    'ba7091de-27df-4cde-9594-d5bea51c44d8',
    '74997ef3-b9eb-4b03-ad2b-1625ad32ba68'
  ]::uuid[];
  i integer;
  result jsonb;
begin
  if p_execute then
    -- Locks last only for this transaction. A failed statement rolls back
    -- both deletion and trigger changes. No other organization's rows change.
    lock table public.organizations, public.profiles, public.waiver_templates,
      public.template_versions, public.signed_waivers, public.activation_milestones,
      public.imported_waivers, public.data_jobs in access exclusive mode;
  end if;

  for i in 1..3 loop
    if not exists(select 1 from public.profiles where id=users_to_remove[i] and org_id=orgs_to_remove[i] and role='owner') then
      raise exception 'Account ownership changed or account is already removed: %', users_to_remove[i];
    end if;
  end loop;
  if exists(select 1 from public.profiles where org_id=any(orgs_to_remove) and not(id=any(users_to_remove))) then
    raise exception 'An organization now has another member; cleanup stopped';
  end if;
  if exists(select 1 from public.subscriptions s where org_id=any(orgs_to_remove) and
    (nullif(to_jsonb(s)->>'stripe_subscription_id','') is not null or
     nullif(to_jsonb(s)->>'creem_subscription_id','') is not null or
     nullif(to_jsonb(s)->>'paddle_subscription_id','') is not null)) then
    raise exception 'External billing subscription found; review it before deletion';
  end if;

  result := jsonb_build_object(
    'users',users_to_remove,'organizations',orgs_to_remove,
    'signed_waivers',(select count(*) from public.signed_waivers where org_id=any(orgs_to_remove)),
    'templates',(select count(*) from public.waiver_templates where org_id=any(orgs_to_remove)),
    'storage_objects',(select count(*) from storage.objects o where
      split_part(o.name,'/',1)=any(orgs_to_remove::text[]) or
      coalesce(to_jsonb(o)->>'owner_id',to_jsonb(o)->>'owner')=any(users_to_remove::text[])),
    'executed',false
  );
  if not p_execute then return result; end if;

  -- Physical files must be removed through Storage API, never by deleting
  -- storage.objects rows. Keep all database records if any files remain.
  if (result->>'storage_objects')::bigint <> 0 then
    raise exception 'Remove the scoped storage files through Storage API first';
  end if;
  if (select count(*) from auth.users where id=any(users_to_remove) and banned_until>now()) <> 3 then
    raise exception 'Disable the three accounts before final deletion';
  end if;
  if exists(select 1 from public.subscriptions where org_id=any(orgs_to_remove) and status in ('active','trialing')) then
    raise exception 'Pause signing for the three organizations before final deletion';
  end if;
  if exists(select 1 from public.data_jobs where org_id=any(orgs_to_remove) and leased_until>now()) then
    raise exception 'Wait for active transfer workers to stop';
  end if;

  alter table public.signed_waivers disable trigger signed_waivers_immutable;
  alter table public.template_versions disable trigger template_versions_immutable;
  alter table public.activation_milestones disable trigger activation_milestones_immutable;
  alter table public.imported_waivers disable trigger imported_waivers_immutable;

  delete from public.webhook_deliveries where org_id=any(orgs_to_remove);
  delete from public.webhook_endpoints where org_id=any(orgs_to_remove);
  delete from public.api_keys where org_id=any(orgs_to_remove);
  delete from public.checkins where org_id=any(orgs_to_remove);
  delete from public.signature_reminders where org_id=any(orgs_to_remove);
  delete from public.imported_waivers where org_id=any(orgs_to_remove);
  delete from public.data_jobs where org_id=any(orgs_to_remove);
  delete from public.signed_waivers where org_id=any(orgs_to_remove);
  delete from public.activation_milestones where org_id=any(orgs_to_remove);
  update public.waiver_templates set current_version_id=null where org_id=any(orgs_to_remove);
  delete from public.template_versions where template_id in
    (select id from public.waiver_templates where org_id=any(orgs_to_remove));
  delete from public.waiver_templates where org_id=any(orgs_to_remove);
  delete from public.invitations where org_id=any(orgs_to_remove);
  delete from public.audit_log where org_id=any(orgs_to_remove);
  delete from public.user_notifications where recipient_id=any(users_to_remove);
  if to_regclass('public.billing_expiry_emails') is not null then
    execute 'delete from public.billing_expiry_emails where org_id=any($1)' using orgs_to_remove;
  end if;
  delete from public.subscriptions where org_id=any(orgs_to_remove);
  -- Auth cascades remove identities/sessions and the target profile rows.
  -- Unexpected cross-organization references cause rollback, not cascading
  -- deletion of another organization's records.
  delete from auth.users where id=any(users_to_remove);
  delete from public.organizations where id=any(orgs_to_remove);

  alter table public.signed_waivers enable trigger signed_waivers_immutable;
  alter table public.template_versions enable trigger template_versions_immutable;
  alter table public.activation_milestones enable trigger activation_milestones_immutable;
  alter table public.imported_waivers enable trigger imported_waivers_immutable;
  return result || jsonb_build_object('executed',true);
end;
$$;
revoke all on function public.purge_requested_accounts_20260914(boolean) from public, anon, authenticated;
grant execute on function public.purge_requested_accounts_20260914(boolean) to service_role;
notify pgrst, 'reload schema';
