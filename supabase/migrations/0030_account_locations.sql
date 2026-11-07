-- Latest authenticated account connection, separate from immutable signer evidence.
create table public.account_locations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ip inet not null,
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  observed_at timestamptz not null default now()
);
alter table public.account_locations enable row level security;
-- No anon/authenticated policies or grants: only the server service role may access.
revoke all on public.account_locations from public, anon, authenticated;
grant select, insert, update, delete on public.account_locations to service_role;
