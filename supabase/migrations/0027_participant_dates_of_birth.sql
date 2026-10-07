-- Apply before deploying participant-DOB writes. Requires 0026.
-- Additive JSON contract: no historical UPDATE, PDF rewrite, RLS or grant changes.
-- Retains existing group evidence validation and trigger wiring.

create or replace function public.validate_group_waiver() returns trigger
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
       or (p - array['date_of_birth','full_name','signature_path','is_minor','guardian_name','guardian_relationship','guardian_signature_path']) <> '{}'::jsonb
       or jsonb_typeof(p->'full_name') <> 'string'
       or length(btrim(p->>'full_name')) not between 1 and 200
       or jsonb_typeof(p->'is_minor') <> 'boolean'
       or jsonb_typeof(p->'signature_path') <> 'string'
       or p->>'signature_path' <> new.org_id::text || '/' || new.id::text || '/' ||
          (case when n = 1 then 'signature.png' else 'participant-' || n || '.png' end) then
      raise exception 'invalid participant evidence';
    end if;
    -- Absence/null is accepted for legacy writers; the new API requires DOB.
    if p ? 'date_of_birth' and p->'date_of_birth' <> 'null'::jsonb then
      if jsonb_typeof(p->'date_of_birth') <> 'string'
         or p->>'date_of_birth' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
        raise exception 'invalid participant date of birth';
      end if;
      begin
        if to_char((p->>'date_of_birth')::date, 'YYYY-MM-DD') <> p->>'date_of_birth'
           or (p->>'date_of_birth')::date > (now() at time zone 'UTC')::date then
          raise exception 'invalid participant date of birth';
        end if;
      exception when datetime_field_overflow or invalid_datetime_format then
        raise exception 'invalid participant date of birth';
      end;
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
