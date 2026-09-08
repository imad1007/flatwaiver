-- Only the server-authorized platform admin can distribute messages.
create table public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  title text not null check (char_length(title) between 1 and 120),
  message text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index user_notifications_inbox on public.user_notifications(recipient_id, created_at desc);
alter table public.user_notifications enable row level security;
revoke all on public.user_notifications from anon, authenticated;
grant select on public.user_notifications to authenticated;
grant all on public.user_notifications to service_role;
create policy "Read own notifications" on public.user_notifications
  for select to authenticated using (recipient_id = (select auth.uid()));

create function public.send_admin_notification(p_sender uuid, p_title text, p_message text, p_all boolean, p_recipients uuid[])
returns integer language plpgsql security definer set search_path = '' as $$
declare sent integer;
begin
  if not p_all and (p_recipients is null or cardinality(p_recipients) = 0) then
    raise exception 'Select at least one recipient';
  end if;
  insert into public.user_notifications(recipient_id, sender_id, title, message)
    select id, p_sender, p_title, p_message from public.profiles
    where p_all or id = any(p_recipients);
  get diagnostics sent = row_count;
  return sent;
end;
$$;
revoke all on function public.send_admin_notification(uuid, text, text, boolean, uuid[]) from public, anon, authenticated;
grant execute on function public.send_admin_notification(uuid, text, text, boolean, uuid[]) to service_role;
