-- Who hears about what: an event × channel (in-app, email) matrix per user, a
-- level per paper, and a master switch for notification email with a
-- one-click unsubscribe token. Missing rows mean the defaults: everything on.

create table if not exists public.notification_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in (
    'paper_shared', 'workspace_added', 'mention', 'reply', 'comment', 'suggestion', 'suggestion_decided'
  )),
  in_app boolean not null default true,
  email boolean not null default true,
  primary key (user_id, kind)
);

alter table public.notification_preferences enable row level security;

drop policy if exists "users read own preferences" on public.notification_preferences;
create policy "users read own preferences" on public.notification_preferences for select using (user_id = auth.uid());
drop policy if exists "users add own preferences" on public.notification_preferences;
create policy "users add own preferences" on public.notification_preferences for insert with check (user_id = auth.uid());
drop policy if exists "users change own preferences" on public.notification_preferences;
create policy "users change own preferences" on public.notification_preferences for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- all: everything about the paper; mentions: only mentions and replies to you; none: nothing.
create table if not exists public.paper_notification_levels (
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  level text not null check (level in ('all', 'mentions', 'none')),
  primary key (user_id, document_id)
);

alter table public.paper_notification_levels enable row level security;

drop policy if exists "users read own paper levels" on public.paper_notification_levels;
create policy "users read own paper levels" on public.paper_notification_levels for select using (user_id = auth.uid());
drop policy if exists "readers set own paper levels" on public.paper_notification_levels;
create policy "readers set own paper levels" on public.paper_notification_levels for insert
  with check (user_id = auth.uid() and public.can_read_document(document_id));
drop policy if exists "readers change own paper levels" on public.paper_notification_levels;
create policy "readers change own paper levels" on public.paper_notification_levels for update
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.can_read_document(document_id));

-- Rows are created by the functions below, so the token is always random.
create table if not exists public.email_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  notification_emails boolean not null default true,
  unsubscribe_token uuid not null unique default gen_random_uuid()
);

alter table public.email_settings enable row level security;

drop policy if exists "users read own email settings" on public.email_settings;
create policy "users read own email settings" on public.email_settings for select using (user_id = auth.uid());

create or replace function public.set_notification_emails(enabled boolean)
returns void
language sql security definer set search_path = public
as $$
  insert into email_settings (user_id, notification_emails) values (auth.uid(), enabled)
  on conflict (user_id) do update set notification_emails = excluded.notification_emails;
$$;
revoke all on function public.set_notification_emails(boolean) from public, anon;
grant execute on function public.set_notification_emails(boolean) to authenticated;

-- The token is the credential: unsubscribe links work without signing in.
create or replace function public.unsubscribe_notification_emails(token uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  update email_settings set notification_emails = false where unsubscribe_token = token;
  return found;
end;
$$;
revoke all on function public.unsubscribe_notification_emails(uuid) from public;
grant execute on function public.unsubscribe_notification_emails(uuid) to anon, authenticated;

-- ── Notifications carry their delivery ───────────────────────────
-- email_state: none (no email wanted), pending (send if still unread later), sent.
alter table public.notifications
  add column if not exists show_in_app boolean not null default true,
  add column if not exists email_state text not null default 'none' check (email_state in ('none', 'pending', 'sent'));
create index if not exists idx_notifications_email_pending on public.notifications (created_at) where email_state = 'pending';

drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications" on public.notifications for select
  using (user_id = auth.uid() and show_in_app);
drop policy if exists "users mark own notifications" on public.notifications;
create policy "users mark own notifications" on public.notifications for update
  using (user_id = auth.uid() and show_in_app);
drop policy if exists "users delete own notifications" on public.notifications;
create policy "users delete own notifications" on public.notifications for delete
  using (user_id = auth.uid() and show_in_app);

-- Users change only the read state; the email sender (no signed-in user) also moves email_state.
create or replace function public.guard_notification_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (to_jsonb(new) - 'read_at' - 'email_state') <> (to_jsonb(old) - 'read_at' - 'email_state')
     or (new.email_state is distinct from old.email_state and auth.uid() is not null) then
    raise exception 'Only the read state of a notification can change';
  end if;
  return new;
end;
$$;

create or replace function public.push_notification(
  recipient uuid, notification_kind text, doc uuid, ws uuid, actor uuid, details jsonb
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  want_in_app boolean := true;
  want_email boolean := true;
  paper_level text;
begin
  if recipient is null or recipient is not distinct from actor then
    return;
  end if;
  select p.in_app, p.email into want_in_app, want_email
  from notification_preferences p where p.user_id = recipient and p.kind = notification_kind;
  if not found then
    want_in_app := true;
    want_email := true;
  end if;
  -- Being given access is news even on a paper you have muted.
  if doc is not null and notification_kind <> 'paper_shared' then
    select l.level into paper_level from paper_notification_levels l where l.user_id = recipient and l.document_id = doc;
    if paper_level = 'none' or (paper_level = 'mentions' and notification_kind not in ('mention', 'reply')) then
      return;
    end if;
  end if;
  if not (want_in_app or want_email) then
    return;
  end if;
  insert into notifications (user_id, kind, document_id, workspace_id, actor_id, payload, show_in_app, email_state)
  values (recipient, notification_kind, doc, ws, actor,
    details || jsonb_build_object('actor', (select email from auth.users where id = actor)),
    want_in_app, case when want_email then 'pending' else 'none' end);
end;
$$;
revoke all on function public.push_notification(uuid, text, uuid, uuid, uuid, jsonb) from public, anon, authenticated;

-- ── Email digests (called by the notification-emails Edge Function) ──
-- Claims everything still unread after min_age, one row per recipient, and
-- marks it sent so concurrent runs never email the same item twice.
create or replace function public.claim_notification_emails(min_age interval default interval '10 minutes', max_items integer default 500)
returns table (recipient uuid, address text, token uuid, items jsonb)
language plpgsql security definer set search_path = public
as $$
begin
  update notifications n set email_state = 'none'
  where n.email_state = 'pending'
    and (n.read_at is not null
      or exists (select 1 from email_settings s where s.user_id = n.user_id and not s.notification_emails));

  insert into email_settings (user_id)
  select distinct n.user_id from notifications n
  where n.email_state = 'pending' and n.created_at <= now() - min_age
  on conflict (user_id) do nothing;

  return query
  with due as (
    select n.id from notifications n
    where n.email_state = 'pending' and n.created_at <= now() - min_age
    order by n.created_at
    limit max_items
    for update skip locked
  ), claimed as (
    update notifications n set email_state = 'sent'
    from due where n.id = due.id
    returning n.id, n.user_id, n.kind, n.document_id, n.workspace_id, n.payload, n.created_at
  )
  select c.user_id, u.email::text, s.unsubscribe_token,
    jsonb_agg(jsonb_build_object(
      'id', c.id, 'kind', c.kind, 'document_id', c.document_id, 'workspace_id', c.workspace_id,
      'payload', c.payload, 'created_at', c.created_at
    ) order by c.created_at)
  from claimed c
  join auth.users u on u.id = c.user_id
  join email_settings s on s.user_id = c.user_id
  where u.email is not null
  group by c.user_id, u.email, s.unsubscribe_token;
end;
$$;
revoke all on function public.claim_notification_emails(interval, integer) from public, anon, authenticated;

-- A failed send puts its items back for the next run.
create or replace function public.requeue_notification_emails(ids uuid[])
returns void
language sql security definer set search_path = public
as $$
  update notifications set email_state = 'pending' where id = any(ids) and email_state = 'sent';
$$;
revoke all on function public.requeue_notification_emails(uuid[]) from public, anon, authenticated;
