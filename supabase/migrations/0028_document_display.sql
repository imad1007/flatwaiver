-- Presentation only; existing templates retain full display. Legal versions are untouched.
alter table public.waiver_templates
  add column document_display text not null default 'full'
  check (document_display in ('full', 'collapsed'));
