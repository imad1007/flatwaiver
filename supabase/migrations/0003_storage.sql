-- Private storage buckets. No public buckets; files are served via
-- short-lived signed URLs (10 min) generated server-side after an
-- org-membership check.

insert into storage.buckets (id, name, public)
values
  ('uploads', 'uploads', false),
  ('signatures', 'signatures', false),
  ('signed-pdfs', 'signed-pdfs', false)
on conflict (id) do nothing;

-- No storage RLS policies for anon or authenticated: all reads/writes go
-- through the server with the service role.
