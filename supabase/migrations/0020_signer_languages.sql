-- Interface language is pinned to each new version; old signatures stay unchanged.
-- The six-argument publish RPC remains available to older clients.
alter table public.template_versions add column signer_language text not null default 'en'
  check (signer_language in ('en','fr','es','pt','zh','hi','ar','bn','ru','ur'));

create or replace function publish_template_version(
  p_template_id uuid,
  p_body jsonb,
  p_fields jsonb,
  p_consent_text text,
  p_minor_mode text,
  p_content_sha256 text,
  p_signer_language text
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
    signer_language
  )
  values (
    p_template_id,
    v_next_version,
    p_body,
    p_fields,
    p_consent_text,
    p_minor_mode,
    p_content_sha256,
    p_signer_language
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

revoke all on function publish_template_version(uuid, jsonb, jsonb, text, text, text, text)
  from public, anon;
grant execute on function publish_template_version(uuid, jsonb, jsonb, text, text, text, text)
  to authenticated;
