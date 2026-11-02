-- Read-only search; no signed evidence or existing search projections are changed.
-- Invoker security preserves organization RLS on signatures and signed versions.
create function public.search_front_desk_waivers(p_query text)
returns setof public.signed_waivers
-- Existing auth_org_id() RLS helper resolves profiles through public.
language sql stable security invoker set search_path = public as $$
  with search as (
    select '%' || replace(replace(replace(left(btrim(p_query), 100),
      E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' as pattern
    where nullif(btrim(p_query), '') is not null
  )
  select s.* from public.signed_waivers s cross join search
  where s.signer_name ilike search.pattern
    or s.guardian_name ilike search.pattern
    or exists (
      select 1 from jsonb_array_elements(coalesce(s.participants, '[]'::jsonb)) p
      where p->>'full_name' ilike search.pattern
         or p->>'guardian_name' ilike search.pattern
    )
    or exists (
      select 1 from public.template_versions v,
        lateral jsonb_array_elements(v.fields) f
      where v.id = s.template_version_id
        and (f->>'type' = 'name'
          or (f->>'type' = 'text' and
            (f->>'key' ~* '(^|_)name(_|$)' or f->>'label' ~* '\mname\M')))
        and jsonb_typeof(s.field_values->(f->>'key')) = 'string'
        and s.field_values->>(f->>'key') ilike search.pattern
    )
$$;
revoke all on function public.search_front_desk_waivers(text) from public, anon;
grant execute on function public.search_front_desk_waivers(text) to authenticated;
