-- Operational QR passes only. Immutable signing evidence and PDFs are untouched.
create table public.waiver_pass_receipts (
  signed_waiver_id uuid primary key references public.signed_waivers(id) on delete cascade,
  receipt_hash text not null unique check (receipt_hash ~ '^[a-f0-9]{64}$')
);
create table public.waiver_passes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  signed_waiver_id uuid not null references public.signed_waivers(id) on delete cascade,
  participant_index integer not null check (participant_index between 0 and 9),
  nonce uuid not null,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (signed_waiver_id, participant_index)
);
create index waiver_pass_org on public.waiver_passes(org_id, signed_waiver_id);
create table public.waiver_pass_deliveries (
  signed_waiver_id uuid primary key references public.signed_waivers(id) on delete cascade,
  state text not null default 'pending' check (state in ('pending','sending','sent','attention')),
  first_attempt_at timestamptz,
  lease_until timestamptz,
  next_attempt_at timestamptz not null default now(),
  provider_id text,
  attempts integer not null default 0
);
create table public.qr_rate_limits (
  key_hash text primary key,
  window_start timestamptz not null default now(),
  attempts integer not null default 1
);
create index qr_rate_limits_age on public.qr_rate_limits(window_start);
create index waiver_pass_deliveries_due on public.waiver_pass_deliveries(state,next_attempt_at);
alter table public.waiver_pass_receipts enable row level security;
alter table public.waiver_passes enable row level security;
alter table public.waiver_pass_deliveries enable row level security;
alter table public.qr_rate_limits enable row level security;
revoke all on public.waiver_pass_receipts, public.waiver_passes, public.waiver_pass_deliveries, public.qr_rate_limits from public, anon, authenticated;
grant all on public.waiver_pass_receipts, public.waiver_passes, public.waiver_pass_deliveries, public.qr_rate_limits to service_role;
-- Members never receive hashes/nonces through the Data API. Staff read safe metadata only.
grant select (id, org_id, signed_waiver_id, participant_index, revoked_at, created_at) on public.waiver_passes to authenticated;
create policy pass_staff_read on public.waiver_passes for select to authenticated using (
  org_id = public.auth_org_id() and exists(select 1 from public.profiles where id = auth.uid() and role in ('owner','admin','staff'))
);

alter table public.checkins add column participant_index integer check (participant_index between 0 and 9);
alter table public.checkins add column visit_key text check (length(visit_key) between 1 and 100);
create unique index checkins_participant_visit on public.checkins(org_id, signed_waiver_id, participant_index, visit_key)
  where participant_index is not null and visit_key is not null;
-- All new writes use the checked atomic functions below, including manual lookup.
drop policy if exists checkin_insert on public.checkins;
drop policy if exists checkin_delete on public.checkins;
revoke insert, update, delete on public.checkins from anon, authenticated;
grant all on public.checkins to service_role;

create function public.qr_consume_limit(p_key text, p_limit integer) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare n integer;
begin
  delete from public.qr_rate_limits where window_start < now() - interval '10 minutes';
  insert into public.qr_rate_limits(key_hash) values(p_key)
  on conflict(key_hash) do update set
    attempts = case when qr_rate_limits.window_start < now()-interval '1 minute' then 1 else qr_rate_limits.attempts+1 end,
    window_start = case when qr_rate_limits.window_start < now()-interval '1 minute' then now() else qr_rate_limits.window_start end
  returning attempts into n;
  return n <= least(greatest(p_limit, 1),120);
end $$;

-- Signature and receipt are committed together; possession of an ID alone can never claim a receipt.
create function public.commit_waiver_with_receipt(p_record jsonb, p_receipt_hash text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.signed_waivers(id,org_id,template_id,template_version_id,signer_name,signer_email,signer_dob,is_minor,
    guardian_name,guardian_relationship,field_values,signature_path,guardian_signature_path,photo_path,pdf_path,pdf_sha256,
    consent_given,consent_text_snapshot,flagged,tag,signed_at,ip,user_agent,signing_channel,participants)
  select r.id,r.org_id,r.template_id,r.template_version_id,r.signer_name,r.signer_email,r.signer_dob,r.is_minor,
    r.guardian_name,r.guardian_relationship,r.field_values,r.signature_path,r.guardian_signature_path,r.photo_path,r.pdf_path,r.pdf_sha256,
    r.consent_given,r.consent_text_snapshot,r.flagged,r.tag,r.signed_at,r.ip,r.user_agent,r.signing_channel,r.participants
  from jsonb_populate_record(null::public.signed_waivers,p_record) r;
  insert into public.waiver_pass_receipts(signed_waiver_id,receipt_hash) values((p_record->>'id')::uuid,p_receipt_hash);
  if nullif(p_record->>'signer_email','') is not null then
    insert into public.waiver_pass_deliveries(signed_waiver_id) values((p_record->>'id')::uuid);
  end if;
end $$;

-- Service role only, with a second independent membership/receipt check.
create function public.ensure_waiver_passes(p_signature uuid, p_candidates jsonb, p_actor uuid default null, p_receipt text default null)
returns setof public.waiver_passes language plpgsql security invoker set search_path = '' as $$
declare s public.signed_waivers; n integer; c jsonb;
begin
  select * into s from public.signed_waivers where id = p_signature;
  if not found then raise exception 'record unavailable' using errcode='P0002'; end if;
  if p_actor is not null then
    if not exists(select 1 from public.profiles where id=p_actor and org_id=s.org_id and role in ('owner','admin','staff')) then
      raise exception 'not authorized' using errcode='42501'; end if;
  elsif not exists(select 1 from public.waiver_pass_receipts where signed_waiver_id=s.id and receipt_hash=p_receipt) then
    raise exception 'receipt unavailable' using errcode='42501';
  end if;
  n := case when jsonb_typeof(s.participants)='array' then jsonb_array_length(s.participants) else 1 end;
  if jsonb_typeof(p_candidates) <> 'array' or jsonb_array_length(p_candidates) <> n then raise exception 'invalid participants'; end if;
  if (select count(distinct (value->>'index')::integer) from jsonb_array_elements(p_candidates)) <> n then raise exception 'invalid participants'; end if;
  for c in select value from jsonb_array_elements(p_candidates) loop
    if (c->>'index')::integer not between 0 and n-1 then raise exception 'invalid participant'; end if;
    insert into public.waiver_passes(org_id,signed_waiver_id,participant_index,nonce,token_hash)
    values(s.org_id,s.id,(c->>'index')::integer,(c->>'nonce')::uuid,c->>'hash') on conflict(signed_waiver_id,participant_index) do nothing;
  end loop;
  if p_actor is null and s.signer_email is not null then
    insert into public.waiver_pass_deliveries(signed_waiver_id) values(s.id) on conflict do nothing;
  end if;
  return query select * from public.waiver_passes where signed_waiver_id=s.id order by participant_index;
end $$;

-- Match existing renewal math: JavaScript setMonth carries days into the next month.
create function public.waiver_pass_status(p_signature uuid, p_index integer) returns text
language plpgsql stable security invoker set search_path = '' as $$
declare s public.signed_waivers; participant jsonb; months integer; expiry timestamp; d timestamp;
begin
  select * into s from public.signed_waivers where id=p_signature;
  if not found then return 'invalid'; end if;
  participant := case when s.participants is not null then s.participants->p_index else
    jsonb_build_object('full_name',s.signer_name,'signature_path',s.signature_path,'is_minor',s.is_minor,
      'guardian_name',s.guardian_name,'guardian_relationship',s.guardian_relationship,'guardian_signature_path',s.guardian_signature_path) end;
  if participant is null then return 'invalid'; end if;
  if not s.consent_given or nullif(btrim(s.consent_text_snapshot),'') is null or nullif(s.pdf_path,'') is null
    or s.pdf_sha256 !~ '^[a-f0-9]{64}$' or nullif(participant->>'signature_path','') is null
    or ((participant->>'is_minor')::boolean and (nullif(participant->>'guardian_signature_path','') is null
      or nullif(btrim(participant->>'guardian_name'),'') is null or nullif(btrim(participant->>'guardian_relationship'),'') is null)) then return 'attention'; end if;
  select expiry_months into months from public.waiver_templates where id=s.template_id and org_id=s.org_id;
  if months is not null then
    d := s.signed_at at time zone 'UTC';
    expiry := date_trunc('month',d) + make_interval(months=>months) + (d-date_trunc('month',d));
    if expiry <= now() at time zone 'UTC' then return 'expired'; end if;
  end if;
  return 'verified';
end $$;

create function public.record_waiver_checkin(p_signature uuid,p_actor uuid,p_index integer default null,p_visit text default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare s public.signed_waivers; visit text; n integer; i integer; v_id uuid; added integer:=0; status text;
begin
  select * into s from public.signed_waivers where id=p_signature;
  if not found or not exists(select 1 from public.profiles where id=p_actor and org_id=s.org_id and role in ('owner','admin','staff')) then
    raise exception 'record unavailable' using errcode='42501'; end if;
  visit := coalesce(nullif(p_visit,''),'day:'||to_char(now() at time zone 'UTC','YYYY-MM-DD'));
  if visit !~ '^(day:[0-9]{4}-[0-9]{2}-[0-9]{2}|session:[A-Za-z0-9 _.-]{1,80})$' then raise exception 'invalid visit'; end if;
  -- A scan and manual group check-in serialize on the SAME record, as do revocations.
  perform pg_advisory_xact_lock(hashtextextended(s.id::text,0));
  n := case when s.participants is not null then jsonb_array_length(s.participants) else 1 end;
  if p_index is not null and p_index not between 0 and n-1 then raise exception 'invalid participant'; end if;
  for i in coalesce(p_index,0)..coalesce(p_index,n-1) loop
    status := public.waiver_pass_status(s.id,i);
    if exists(select 1 from public.waiver_passes where signed_waiver_id=s.id and participant_index=i and revoked_at is not null) then status:='revoked'; end if;
    if status <> 'verified' then return jsonb_build_object('status',status,'duplicate',false); end if;
  end loop;
  for i in coalesce(p_index,0)..coalesce(p_index,n-1) loop
    select id into v_id from public.checkins where signed_waiver_id=s.id and org_id=s.org_id and
      ((visit_key=visit and participant_index=i) or
       (participant_index is null and visit like 'day:%' and to_char(checked_in_at at time zone 'UTC','YYYY-MM-DD')=substring(visit from 5))) limit 1;
    if v_id is null then
      insert into public.checkins(org_id,signed_waiver_id,checked_in_by,participant_index,visit_key)
      values(s.org_id,s.id,p_actor,i,visit) on conflict do nothing returning id into v_id;
      if v_id is not null then added:=added+1; end if;
    end if;
  end loop;
  insert into public.audit_log(org_id,actor_id,action,target,metadata)
    values(s.org_id,p_actor,'waiver.checked_in',s.id::text,jsonb_build_object('participant_index',p_index,'visit',visit,'added',added));
  return jsonb_build_object('status','checked_in','duplicate',added=0,'visit',visit);
end $$;

create function public.verify_waiver_pass(p_hash text,p_actor uuid,p_visit text default null,p_checkin boolean default false)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare pass public.waiver_passes; s public.signed_waivers; who jsonb; staff public.profiles; status text; visit text; checked timestamptz; tpl text; result jsonb;
begin
  select * into staff from public.profiles where id=p_actor and role in ('owner','admin','staff');
  if not found then raise exception 'not authorized' using errcode='42501'; end if;
  select * into pass from public.waiver_passes where token_hash=p_hash and org_id=staff.org_id;
  if not found then
    insert into public.audit_log(org_id,actor_id,action) values(staff.org_id,p_actor,'waiver.qr_invalid');
    return jsonb_build_object('status','invalid');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(pass.signed_waiver_id::text,0));
  select * into pass from public.waiver_passes where id=pass.id;
  select * into s from public.signed_waivers where id=pass.signed_waiver_id and org_id=staff.org_id;
  if not found then return jsonb_build_object('status','invalid'); end if;
  select name into tpl from public.waiver_templates where id=s.template_id and org_id=staff.org_id;
  who:=case when s.participants is not null then s.participants->pass.participant_index else jsonb_build_object('full_name',s.signer_name,'is_minor',s.is_minor,'guardian_name',s.guardian_name) end;
  visit:=coalesce(nullif(p_visit,''),'day:'||to_char(now() at time zone 'UTC','YYYY-MM-DD'));
  if visit !~ '^(day:[0-9]{4}-[0-9]{2}-[0-9]{2}|session:[A-Za-z0-9 _.-]{1,80})$' then raise exception 'invalid visit'; end if;
  status:=case when pass.revoked_at is not null then 'revoked' else public.waiver_pass_status(s.id,pass.participant_index) end;
  select max(checked_in_at) into checked from public.checkins where org_id=staff.org_id and signed_waiver_id=s.id and
    ((participant_index=pass.participant_index and visit_key=visit) or (participant_index is null and visit like 'day:%' and to_char(checked_in_at at time zone 'UTC','YYYY-MM-DD')=substring(visit from 5)));
  if status='verified' and checked is not null then status:='checked_in'; end if;
  if p_checkin and status='verified' then
    result:=public.record_waiver_checkin(s.id,p_actor,pass.participant_index,visit);
    status:=result->>'status';
    checked:=now();
  end if;
  insert into public.audit_log(org_id,actor_id,action,target,metadata) values(staff.org_id,p_actor,'waiver.qr_verified',pass.id::text,jsonb_build_object('status',status,'visit',visit));
  return jsonb_build_object('status',status,'passId',pass.id,'participantName',who->>'full_name','participantNumber',pass.participant_index+1,
    'isMinor',who->'is_minor','guardianName',who->>'guardian_name','waiverName',tpl,'signedAt',s.signed_at,'checkedInAt',checked,
    'visit',visit,'signatureId',s.id,'flagged',s.flagged,'canRevoke',staff.role in ('owner','admin'));
end $$;

create function public.revoke_waiver_pass(p_pass uuid,p_actor uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare pass public.waiver_passes;
begin
  select * into pass from public.waiver_passes where id=p_pass;
  if not found or not exists(select 1 from public.profiles where id=p_actor and org_id=pass.org_id and role in ('owner','admin')) then
    raise exception 'not authorized' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(pass.signed_waiver_id::text,0));
  update public.waiver_passes set revoked_at=coalesce(revoked_at,now()) where id=p_pass;
  insert into public.audit_log(org_id,actor_id,action,target) values(pass.org_id,p_actor,'waiver.pass_revoked',p_pass::text);
end $$;

create function public.undo_waiver_checkin(p_checkin uuid,p_actor uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare c public.checkins;
begin
  select * into c from public.checkins where id=p_checkin;
  if not found or not exists(select 1 from public.profiles where id=p_actor and org_id=c.org_id and role in ('owner','admin','staff')) then
    raise exception 'not authorized' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(c.signed_waiver_id::text,0));
  if c.visit_key is null then delete from public.checkins where id=c.id;
  else delete from public.checkins where org_id=c.org_id and signed_waiver_id=c.signed_waiver_id and visit_key=c.visit_key; end if;
  insert into public.audit_log(org_id,actor_id,action,target,metadata) values(c.org_id,p_actor,'waiver.checkin_undone',c.signed_waiver_id::text,jsonb_build_object('visit',c.visit_key));
end $$;

create function public.claim_waiver_pass_email(p_signature uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
  -- Do not automatically retry an ambiguous send beyond Resend's 24h dedupe window.
  update public.waiver_pass_deliveries set state='attention' where signed_waiver_id=p_signature and state in ('sending','pending') and first_attempt_at < now()-interval '23 hours';
  update public.waiver_pass_deliveries set state='sending',first_attempt_at=coalesce(first_attempt_at,now()),lease_until=now()+interval '5 minutes',attempts=attempts+1
    where signed_waiver_id=p_signature and state in ('pending','sending') and (lease_until is null or lease_until<now()) and next_attempt_at<=now();
  return found;
end $$;

-- Every privileged function is service-only; no public/user-controlled actor RPC.
revoke all on function public.qr_consume_limit(text,integer), public.commit_waiver_with_receipt(jsonb,text),
  public.ensure_waiver_passes(uuid,jsonb,uuid,text), public.waiver_pass_status(uuid,integer), public.record_waiver_checkin(uuid,uuid,integer,text),
  public.verify_waiver_pass(text,uuid,text,boolean), public.revoke_waiver_pass(uuid,uuid), public.undo_waiver_checkin(uuid,uuid), public.claim_waiver_pass_email(uuid)
from public,anon,authenticated;
grant execute on function public.qr_consume_limit(text,integer), public.commit_waiver_with_receipt(jsonb,text),
  public.ensure_waiver_passes(uuid,jsonb,uuid,text), public.waiver_pass_status(uuid,integer), public.record_waiver_checkin(uuid,uuid,integer,text),
  public.verify_waiver_pass(text,uuid,text,boolean), public.revoke_waiver_pass(uuid,uuid), public.undo_waiver_checkin(uuid,uuid), public.claim_waiver_pass_email(uuid)
to service_role;
