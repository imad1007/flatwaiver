-- Group evidence shares the existing append-only row and tenant RLS.
alter table public.template_versions add column group_signing_enabled boolean not null default false;
alter table public.signed_waivers add column participants jsonb;

create or replace function publish_template_version(
  p_template_id uuid,
  p_body jsonb,
  p_fields jsonb,
  p_consent_text text,
  p_minor_mode text,
  p_content_sha256 text,
  p_signer_language text,
  p_group_signing_enabled boolean
)
returns table (version_id uuid, version_number integer)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_template_org_id uuid;
  v_next_version integer;
  v_version_id uuid;
begin
  -- Resolve through the caller's SELECT policy first, then independently
  -- enforce the member role inside the RPC. This prevents direct RPC callers
  -- from bypassing the application-side role check.
  select wt.org_id
  into v_template_org_id
  from waiver_templates wt
  where wt.id = p_template_id;

  if not found then
    raise exception 'waiver template not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from profiles p
    where p.id = auth.uid()
      and p.org_id = v_template_org_id
      and p.role in ('owner', 'admin', 'staff')
  ) then
    raise exception 'not authorized to publish waiver template'
      using errcode = '42501';
  end if;

  -- Serialize legitimate concurrent publish attempts for this template.
  perform 1
  from waiver_templates
  where id = p_template_id
  for update;

  if not found then
    raise exception 'waiver template not found' using errcode = 'P0002';
  end if;

  select coalesce(max(tv.version_number), 0) + 1
  into v_next_version
  from template_versions tv
  where tv.template_id = p_template_id;

  insert into template_versions (
    template_id,
    version_number,
    body,
    fields,
    consent_text,
    minor_mode,
    content_sha256,
    signer_language,
    group_signing_enabled
  )
  values (
    p_template_id,
    v_next_version,
    p_body,
    p_fields,
    p_consent_text,
    p_minor_mode,
    p_content_sha256,
    p_signer_language,
    p_group_signing_enabled
  )
  returning id into v_version_id;

  update waiver_templates
  set current_version_id = v_version_id,
      status = 'published',
      updated_at = now()
  where id = p_template_id;

  return query select v_version_id, v_next_version;
end
$$;

revoke all on function publish_template_version(uuid, jsonb, jsonb, text, text, text, text, boolean)
  from public, anon;
grant execute on function publish_template_version(uuid, jsonb, jsonb, text, text, text, text, boolean)
  to authenticated;

-- Validate new evidence only: no UPDATE of any historical row.
create function public.validate_group_waiver() returns trigger
language plpgsql security invoker set search_path = public as $$
declare
  v_enabled boolean;
  v_minor_mode text;
  v_org uuid;
  v_template uuid;
  p jsonb;
  n integer := 0;
begin
  select tv.group_signing_enabled, tv.minor_mode, wt.org_id, tv.template_id
  into v_enabled, v_minor_mode, v_org, v_template
  from template_versions tv join waiver_templates wt on wt.id = tv.template_id
  where tv.id = new.template_version_id;
  if not found or v_org <> new.org_id or v_template <> new.template_id then
    raise exception 'invalid waiver version or organization';
  end if;
  if new.participants is null then
    if v_enabled then raise exception 'group participants required'; end if;
    return new;
  end if;
  if not v_enabled or jsonb_typeof(new.participants) <> 'array' then
    raise exception 'group signing disabled or invalid participants';
  end if;
  if jsonb_array_length(new.participants) not between 1 and 10 then
    raise exception 'participant count must be 1 to 10';
  end if;
  for p in select value from jsonb_array_elements(new.participants) loop
    n := n + 1;
    if jsonb_typeof(p) <> 'object' or not (p ?& array['full_name','signature_path','is_minor','guardian_name','guardian_relationship','guardian_signature_path'])
       or (p - array['full_name','signature_path','is_minor','guardian_name','guardian_relationship','guardian_signature_path']) <> '{}'::jsonb
       or jsonb_typeof(p->'full_name') <> 'string'
       or length(btrim(p->>'full_name')) not between 1 and 200
       or jsonb_typeof(p->'is_minor') <> 'boolean'
       or jsonb_typeof(p->'signature_path') <> 'string'
       or p->>'signature_path' <> new.org_id::text || '/' || new.id::text || '/' ||
          (case when n = 1 then 'signature.png' else 'participant-' || n || '.png' end) then
      raise exception 'invalid participant evidence';
    end if;
    if (p->>'is_minor')::boolean then
      if v_minor_mode <> 'allowed' or jsonb_typeof(p->'guardian_name') <> 'string'
         or length(btrim(p->>'guardian_name')) not between 1 and 200
         or jsonb_typeof(p->'guardian_relationship') <> 'string'
         or length(btrim(p->>'guardian_relationship')) not between 2 and 100
         or jsonb_typeof(p->'guardian_signature_path') <> 'string'
         or p->>'guardian_signature_path' <> new.org_id::text || '/' || new.id::text || '/participant-' || n || '-guardian.png' then
        raise exception 'invalid guardian evidence';
      end if;
    elsif p->'guardian_name' <> 'null'::jsonb or p->'guardian_relationship' <> 'null'::jsonb or p->'guardian_signature_path' <> 'null'::jsonb then
      raise exception 'unexpected guardian evidence';
    end if;
  end loop;
  if new.signer_name <> new.participants->0->>'full_name'
     or new.signature_path <> new.participants->0->>'signature_path'
     or new.is_minor <> (new.participants->0->>'is_minor')::boolean
     or new.guardian_name is distinct from (new.participants->0->>'guardian_name')
     or new.guardian_relationship is distinct from (new.participants->0->>'guardian_relationship')
     or new.guardian_signature_path is distinct from (new.participants->0->>'guardian_signature_path')
     then raise exception 'primary participant mismatch'; end if;
  return new;
end $$;
revoke all on function public.validate_group_waiver() from public, anon, authenticated;
create trigger signed_waivers_group_validation before insert on public.signed_waivers
for each row execute function public.validate_group_waiver();

-- Derived search projection: does not change any signed evidence.
create function public.group_participant_names(p_participants jsonb) returns text
language sql immutable strict set search_path = public as $$
  select string_agg(value->>'full_name', ' ' order by ordinal)
  from jsonb_array_elements(p_participants) with ordinality as p(value, ordinal)
$$;
revoke all on function public.group_participant_names(jsonb) from public, anon;
grant execute on function public.group_participant_names(jsonb) to authenticated, service_role;
alter table public.signed_waivers add column participant_search text
  generated always as (signer_name || ' ' || coalesce(public.group_participant_names(participants), '')) stored;
create index idx_signed_participant_search_trgm on public.signed_waivers
  using gin (participant_search gin_trgm_ops);
