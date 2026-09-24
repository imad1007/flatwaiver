-- Per-user read receipts for announcements and current workspace alerts.
create table public.notification_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_id text not null check (length(notification_id) between 1 and 200),
  read_at timestamptz not null default now(),
  primary key(user_id, notification_id)
);
alter table public.notification_reads enable row level security;
revoke all on public.notification_reads from public, anon, authenticated;
grant select, insert on public.notification_reads to authenticated;
grant all on public.notification_reads to service_role;
create policy notification_reads_own_select on public.notification_reads
  for select to authenticated using (user_id = (select auth.uid()));
create policy notification_reads_own_insert on public.notification_reads
  for insert to authenticated with check (user_id = (select auth.uid()));
