-- Portable records without changing native signed waivers or template versions.
create table public.data_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  user_id uuid not null references public.profiles(id),
  direction text not null check (direction in ('import','export')),
  format text not null check (format in ('csv','pdfs','backup','templates','template','historical','restore')),
  status text not null default 'uploading' check (status in ('uploading','queued','preview','ready','processing','completed','failed','expired')),
  options jsonb not null default '{}',
  summary jsonb not null default '{}',
  progress integer not null default 0,
  total integer not null default 0,
  output_path text,
  error text,
  lease_token uuid,
  leased_until timestamptz,
  attempts integer not null default 0,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days')
);
create index data_jobs_org_date on public.data_jobs(org_id, created_at desc);
create index data_jobs_queue on public.data_jobs(status, leased_until);
create function public.guard_data_job() returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists(select 1 from public.profiles where id=new.user_id and org_id=new.org_id and role='owner') then
    raise exception 'Owner access required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.org_id::text,0));
  if (select count(*) from public.data_jobs where org_id=new.org_id and expires_at>now()
      and status in ('uploading','queued','preview','ready','processing')) >= 5 then
    raise exception 'Finish or cancel an existing transfer before starting another'; end if;
  return new;
end;
$$;
create trigger data_job_guard before insert on public.data_jobs for each row execute function public.guard_data_job();
create table public.data_job_files (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.data_jobs(id) on delete cascade,
  filename text not null,
  path text not null unique,
  size bigint not null check (size between 1 and 5368709120),
  unique(job_id,filename)
);
create function public.guard_data_file() returns trigger language plpgsql set search_path = '' as $$
declare j public.data_jobs; existing_count bigint; existing_bytes bigint; max_size bigint;
begin
  select * into j from public.data_jobs where id=new.job_id for update;
  if not found or j.status <> 'uploading' or j.direction <> 'import' or j.expires_at <= now() then
    raise exception 'Uploads are closed for this transfer'; end if;
  if new.path not like j.org_id::text || '/transfers/' || j.id::text || '/input/%' or new.path like '%..%' then
    raise exception 'Invalid upload path'; end if;
  max_size := case when lower(new.filename) like '%.zip' then 5368709120
    when lower(new.filename) ~ '\.(csv|json)$' then 20971520 else 52428800 end;
  select count(*),coalesce(sum(size),0) into existing_count,existing_bytes from public.data_job_files where job_id=j.id;
  if existing_count >= 50000 or existing_bytes + new.size > 5368709120 or new.size > max_size then
    raise exception 'Transfer input size or file count limit exceeded'; end if;
  return new;
end;
$$;
create trigger data_file_guard before insert on public.data_job_files for each row execute function public.guard_data_file();
create table public.data_import_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.data_jobs(id) on delete cascade,
  row_number integer not null,
  kind text not null check (kind in ('record','template')),
  status text not null check (status in ('valid','invalid','skipped','imported')),
  data jsonb not null,
  error text,
  warnings text[] not null default '{}',
  unique(job_id,row_number)
);
create index data_import_items_page on public.data_import_items(job_id,status,row_number);

create table public.imported_waivers (
  id uuid primary key,
  org_id uuid not null references public.organizations(id),
  import_job_id uuid not null references public.data_jobs(id),
  imported_by uuid not null references public.profiles(id),
  imported_at timestamptz not null default now(),
  record_origin text not null default 'imported' check (record_origin = 'imported'),
  source_provider text not null,
  external_id text,
  dedupe_key text not null,
  template_id uuid references public.waiver_templates(id),
  waiver_title text,
  participant_name text,
  participant_email text,
  participant_phone text,
  date_of_birth date,
  original_signed_at timestamptz,
  field_values jsonb not null default '{}',
  source_evidence jsonb not null default '{}',
  original_filename text,
  pdf_path text,
  pdf_sha256 text,
  signature_path text,
  signature_sha256 text,
  unique(org_id,source_provider,dedupe_key),
  check ((pdf_path is null and pdf_sha256 is null) or coalesce(pdf_path like org_id::text || '/imported/%' and pdf_sha256 ~ '^[a-f0-9]{64}$',false)),
  check ((signature_path is null and signature_sha256 is null) or coalesce(signature_path like org_id::text || '/imported/%' and signature_sha256 ~ '^[a-f0-9]{64}$',false))
);
create index imported_waivers_org_date on public.imported_waivers(org_id,original_signed_at,id);
create index imported_waivers_template on public.imported_waivers(org_id,template_id);
create trigger imported_waivers_immutable before update or delete on public.imported_waivers
  for each row execute function public.forbid_change();
alter table public.waiver_templates add column import_key text;
create unique index waiver_template_import_key on public.waiver_templates(org_id,import_key) where import_key is not null;

alter table public.data_jobs enable row level security;
alter table public.data_job_files enable row level security;
alter table public.data_import_items enable row level security;
alter table public.imported_waivers enable row level security;
revoke all on public.data_jobs, public.data_job_files, public.data_import_items, public.imported_waivers from public, anon, authenticated;
grant select on public.data_jobs, public.data_job_files, public.data_import_items, public.imported_waivers to authenticated;
grant all on public.data_jobs, public.data_job_files, public.data_import_items, public.imported_waivers to service_role;
create policy data_jobs_owner on public.data_jobs for select to authenticated using (
  exists(select 1 from public.profiles p where p.id = auth.uid() and p.org_id = data_jobs.org_id and p.role = 'owner')
);
create policy data_files_owner on public.data_job_files for select to authenticated using (
  exists(select 1 from public.data_jobs j where j.id = job_id)
);
create policy data_items_owner on public.data_import_items for select to authenticated using (
  exists(select 1 from public.data_jobs j where j.id = job_id)
);
create policy imported_owner on public.imported_waivers for select to authenticated using (
  exists(select 1 from public.profiles p where p.id = auth.uid() and p.org_id = imported_waivers.org_id and p.role = 'owner')
);

-- Worker lease, retried jobs are idempotent. No client may call this function.
create function public.claim_data_job() returns setof public.data_jobs
language sql security definer set search_path = '' as $$
  with picked as (
    select id from public.data_jobs
    where status in ('queued','ready','processing') and expires_at > now()
      and (leased_until is null or leased_until < now()) and attempts < 5
    order by created_at limit 1 for update skip locked
  )
  update public.data_jobs j set lease_token = gen_random_uuid(), leased_until = now() + interval '2 minutes',
    attempts = attempts + 1, status = case when confirmed_at is not null or direction = 'export' then 'processing' else 'queued' end
  from picked where j.id = picked.id returning j.*;
$$;
revoke all on function public.claim_data_job() from public, anon, authenticated;
grant execute on function public.claim_data_job() to service_role;

-- Commit a bounded batch and its results in one transaction, guarded by lease.
create function public.commit_data_import(p_job uuid, p_lease uuid, p_items jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare j public.data_jobs; i jsonb; d jsonb; item public.data_import_items; inserted integer; n integer := 0;
begin
  select * into j from public.data_jobs where id = p_job and lease_token = p_lease
    and leased_until > now() and expires_at > now() and confirmed_at is not null and status = 'processing' and direction='import' for update;
  if not found then raise exception 'Invalid job lease'; end if;
  if not exists(select 1 from public.profiles where id = j.user_id and org_id = j.org_id and role = 'owner') then
    raise exception 'Owner access required'; end if;
  if jsonb_array_length(p_items) > 100 then raise exception 'Batch too large'; end if;
  for i in select value from jsonb_array_elements(p_items) loop
    select * into item from public.data_import_items where id = (i->>'id')::uuid and job_id = j.id and status = 'valid' for update;
    if not found then continue; end if;
    d := i->'data';
    if item.kind = 'template' then
      if not exists(select 1 from public.subscriptions where org_id = j.org_id and
        (status = 'active' or (status = 'trialing' and trial_ends_at > now()))) then
        raise exception 'An active subscription or trial is required to create templates'; end if;
      insert into public.waiver_templates(org_id,slug,name,status,draft_content,import_key,expiry_months,photo_mode)
        values(j.org_id, gen_random_uuid()::text, d->>'name', 'draft', d->'content', d->>'dedupe_key',
          (d->'settings'->>'expiry_months')::integer,coalesce(d->'settings'->>'photo_mode','off'))
        on conflict (org_id,import_key) where import_key is not null do nothing;
    else
      if nullif(d->>'template_id','') is not null and not exists(select 1 from public.waiver_templates where id = (d->>'template_id')::uuid and org_id = j.org_id) then
        raise exception 'Template does not belong to organization'; end if;
      insert into public.imported_waivers(id,org_id,import_job_id,imported_by,source_provider,external_id,dedupe_key,
        template_id,waiver_title,participant_name,participant_email,participant_phone,date_of_birth,original_signed_at,
        field_values,source_evidence,original_filename,pdf_path,pdf_sha256,signature_path,signature_sha256)
      values(item.id,j.org_id,j.id,j.user_id,d->>'source_provider',d->>'external_id',d->>'dedupe_key',
        nullif(d->>'template_id','')::uuid,d->>'waiver_title',d->>'participant_name',d->>'participant_email',d->>'participant_phone',
        nullif(d->>'date_of_birth','')::date,nullif(d->>'original_signed_at','')::timestamptz,
        coalesce(d->'field_values','{}'),coalesce(d->'source_evidence','{}'),d->>'original_filename',d->>'pdf_path',d->>'pdf_sha256',d->>'signature_path',d->>'signature_sha256')
      on conflict do nothing;
    end if;
    get diagnostics inserted = row_count;
    update public.data_import_items set status = case when inserted = 1 then 'imported' else 'skipped' end,
      error = case when inserted = 0 then 'Duplicate record' else null end where id = item.id;
    n := n + inserted;
  end loop;
  return n;
end;
$$;
revoke all on function public.commit_data_import(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.commit_data_import(uuid,uuid,jsonb) to service_role;

create function public.data_import_summary(p_job uuid) returns jsonb
language sql security definer set search_path = '' as $$
  select jsonb_build_object(
    'valid',count(*) filter(where status = 'valid'), 'invalid',count(*) filter(where status = 'invalid'),
    'skipped',count(*) filter(where status = 'skipped'), 'imported',count(*) filter(where status = 'imported'),
    'warnings',count(*) filter(where cardinality(warnings)>0), 'templates',count(*) filter(where kind='template'),
    'records',count(*) filter(where kind='record'), 'pdfs',count(*) filter(where data->>'pdf_filename' is not null),
    'missingPdfs',count(*) filter(where kind='record' and data->>'pdf_filename' is null)
  ) from public.data_import_items where job_id = p_job;
$$;
revoke all on function public.data_import_summary(uuid) from public,anon,authenticated;
grant execute on function public.data_import_summary(uuid) to service_role;

create function public.stage_data_import(p_job uuid,p_lease uuid,p_items jsonb,p_reset boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.data_jobs where id=p_job and lease_token=p_lease and leased_until>now()
    and expires_at>now() and status='queued' and confirmed_at is null and direction='import' for update;
  if not found then raise exception 'Invalid preview lease'; end if;
  if jsonb_array_length(p_items)>100 then raise exception 'Batch too large'; end if;
  if p_reset then delete from public.data_import_items where job_id=p_job; end if;
  insert into public.data_import_items(id,job_id,row_number,kind,status,data,error,warnings)
  select (i->>'id')::uuid,p_job,(i->>'row_number')::integer,i->>'kind',i->>'status',i->'data',i->>'error',
    array(select jsonb_array_elements_text(i->'warnings')) from jsonb_array_elements(p_items) i;
end;
$$;
revoke all on function public.stage_data_import(uuid,uuid,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.stage_data_import(uuid,uuid,jsonb,boolean) to service_role;

create function public.recover_data_jobs() returns void
language sql security definer set search_path = '' as $$
  update public.data_jobs set status='failed',error='Worker attempts exhausted or transfer expired. Retry an unexpired transfer to resume safely.',
    lease_token=null,leased_until=null
  where status in ('queued','ready','processing') and (leased_until is null or leased_until < now())
    and (attempts >= 5 or expires_at <= now());
$$;
revoke all on function public.recover_data_jobs() from public,anon,authenticated;
grant execute on function public.recover_data_jobs() to service_role;

-- Fence database commits before deleting expired artifacts. Never clean an
-- actively leased transfer, even if a worker has not yet noticed its expiry.
create function public.begin_data_cleanup(p_job uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.data_jobs set status='expired',lease_token=null,leased_until=null
    where id=p_job and expires_at < now()-interval '2 hours'
      and (leased_until is null or leased_until < now())
      and output_path is distinct from 'cleaned';
  return found;
end;
$$;
revoke all on function public.begin_data_cleanup(uuid) from public,anon,authenticated;
grant execute on function public.begin_data_cleanup(uuid) to service_role;

-- Transfer artifacts use the existing private uploads bucket. Original imported
-- PDFs/images use signed-pdfs/signatures with immutable, unique object paths.
