-- Publish an immutable template version and move the live pointer atomically.
-- The caller saves draft_content before invoking this function so editing work
-- remains recoverable even when this transaction fails.

-- Replace the original organization-only write policies. Every organization
-- member may continue to read templates, but only roles that can manage
-- waivers may mutate template shells or append versions.
drop policy if exists tpl_all on waiver_templates;
drop policy if exists tpl_select on waiver_templates;
drop policy if exists tpl_insert on waiver_templates;
drop policy if exists tpl_update on waiver_templates;
drop policy if exists tpl_delete on waiver_templates;

create policy tpl_select on waiver_templates for select
  using (org_id = auth_org_id());
create policy tpl_insert on waiver_templates for insert
  with check (
    org_id = auth_org_id()
    and exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.org_id = waiver_templates.org_id
        and p.role in ('owner', 'admin', 'staff')
    )
  );
create policy tpl_update on waiver_templates for update
  using (
    org_id = auth_org_id()
    and exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.org_id = waiver_templates.org_id
        and p.role in ('owner', 'admin', 'staff')
    )
  )
  with check (
    org_id = auth_org_id()
    and exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.org_id = waiver_templates.org_id
        and p.role in ('owner', 'admin', 'staff')
    )
  );
create policy tpl_delete on waiver_templates for delete
  using (
    org_id = auth_org_id()
    and exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.org_id = waiver_templates.org_id
        and p.role in ('owner', 'admin', 'staff')
    )
  );

drop policy if exists ver_insert on template_versions;
create policy ver_insert on template_versions for insert
  with check (
    exists (
      select 1
      from waiver_templates wt
      join profiles p on p.id = auth.uid() and p.org_id = wt.org_id
      where wt.id = template_versions.template_id
        and wt.org_id = auth_org_id()
        and p.role in ('owner', 'admin', 'staff')
    )
  );

create or replace function publish_template_version(
  p_template_id uuid,
  p_body jsonb,
  p_fields jsonb,
  p_consent_text text,
  p_minor_mode text,
  p_content_sha256 text
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
    content_sha256
  )
  values (
    p_template_id,
    v_next_version,
    p_body,
    p_fields,
    p_consent_text,
    p_minor_mode,
    p_content_sha256
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

revoke all on function publish_template_version(uuid, jsonb, jsonb, text, text, text)
  from public, anon;
grant execute on function publish_template_version(uuid, jsonb, jsonb, text, text, text)
  to authenticated;
