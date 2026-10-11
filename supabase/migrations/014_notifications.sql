-- In-app notifications. Rows are written only by the triggers below (security
-- definer); users read, mark read and delete their own.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in (
    'paper_shared', 'workspace_added', 'mention', 'reply', 'comment', 'suggestion', 'suggestion_decided'
  )),
  document_id uuid references public.documents(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user on public.notifications (user_id, created_at desc);
create index if not exists idx_notifications_unread on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications" on public.notifications for select using (user_id = auth.uid());
drop policy if exists "users mark own notifications" on public.notifications;
create policy "users mark own notifications" on public.notifications for update using (user_id = auth.uid());
drop policy if exists "users delete own notifications" on public.notifications;
create policy "users delete own notifications" on public.notifications for delete using (user_id = auth.uid());

create or replace function public.guard_notification_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (to_jsonb(new) - 'read_at') <> (to_jsonb(old) - 'read_at') then
    raise exception 'Only the read state of a notification can change';
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_guard_update on public.notifications;
create trigger notifications_guard_update
before update on public.notifications
for each row execute function public.guard_notification_update();

-- Whether a given user (not the caller) can read a paper; mirrors document_role().
create or replace function public.user_can_read_document(doc uuid, uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from documents d
    where d.id = doc and (
      d.owner_id = uid
      or exists (select 1 from document_members m where m.document_id = d.id and m.user_id = uid)
      or (d.workspace_access <> 'private'
          and exists (select 1 from workspace_members w where w.workspace_id = d.workspace_id and w.user_id = uid))
    )
  );
$$;
revoke all on function public.user_can_read_document(uuid, uuid) from public, anon, authenticated;

create or replace function public.push_notification(
  recipient uuid, notification_kind text, doc uuid, ws uuid, actor uuid, details jsonb
) returns void
language sql security definer set search_path = public
as $$
  insert into notifications (user_id, kind, document_id, workspace_id, actor_id, payload)
  select recipient, notification_kind, doc, ws, actor,
    details || jsonb_build_object('actor', (select email from auth.users where id = actor))
  where recipient is not null and recipient is distinct from actor;
$$;
revoke all on function public.push_notification(uuid, text, uuid, uuid, uuid, jsonb) from public, anon, authenticated;

create or replace function public.paper_title(doc uuid)
returns text
language sql stable security definer set search_path = public
as $$ select coalesce(nullif(trim(title), ''), 'Untitled paper') from documents where id = doc; $$;
revoke all on function public.paper_title(uuid) from public, anon, authenticated;

-- ── Triggers ─────────────────────────────────────────────────────
create or replace function public.notify_paper_shared()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform push_notification(new.user_id, 'paper_shared', new.document_id, null, coalesce(new.invited_by, auth.uid()),
    jsonb_build_object('title', paper_title(new.document_id), 'role', new.role));
  return new;
end;
$$;
drop trigger if exists document_members_notify on public.document_members;
create trigger document_members_notify after insert on public.document_members
for each row execute function public.notify_paper_shared();

create or replace function public.notify_workspace_added()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.role <> 'owner' then
    perform push_notification(new.user_id, 'workspace_added', null, new.workspace_id, auth.uid(),
      jsonb_build_object('workspace', (select name from workspaces where id = new.workspace_id), 'role', new.role));
  end if;
  return new;
end;
$$;
drop trigger if exists workspace_members_notify on public.workspace_members;
create trigger workspace_members_notify after insert on public.workspace_members
for each row execute function public.notify_workspace_added();

-- Mentions first; then replies go to everyone in the thread and new threads
-- to the paper owner. Nobody gets two notifications for one comment.
create or replace function public.notify_comment()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  details jsonb := jsonb_build_object('title', paper_title(new.document_id), 'excerpt', left(new.body, 140), 'comment_id', new.id);
  notified uuid[] := array[new.author_id];
  recipient uuid;
begin
  foreach recipient in array coalesce(new.mentions, '{}') loop
    if not (recipient = any(notified)) and user_can_read_document(new.document_id, recipient) then
      perform push_notification(recipient, 'mention', new.document_id, null, new.author_id, details);
      notified := notified || recipient;
    end if;
  end loop;

  if new.parent_id is not null then
    for recipient in
      select distinct author_id from comments
      where (id = new.parent_id or parent_id = new.parent_id) and author_id is not null
    loop
      if not (recipient = any(notified)) and user_can_read_document(new.document_id, recipient) then
        perform push_notification(recipient, 'reply', new.document_id, null, new.author_id, details);
        notified := notified || recipient;
      end if;
    end loop;
  else
    select owner_id into recipient from documents where id = new.document_id;
    if not (recipient = any(notified)) then
      perform push_notification(recipient, 'comment', new.document_id, null, new.author_id, details);
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists comments_notify on public.comments;
create trigger comments_notify after insert on public.comments
for each row execute function public.notify_comment();

create or replace function public.notify_suggestion()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform push_notification((select owner_id from documents where id = new.document_id), 'suggestion', new.document_id, null,
      new.author_id, jsonb_build_object('title', paper_title(new.document_id), 'excerpt', left(coalesce(new.note, ''), 140)));
  elsif new.status <> old.status and new.status in ('accepted', 'rejected') then
    perform push_notification(new.author_id, 'suggestion_decided', new.document_id, null, new.decided_by,
      jsonb_build_object('title', paper_title(new.document_id), 'status', new.status));
  end if;
  return new;
end;
$$;
drop trigger if exists suggestions_notify on public.suggestions;
create trigger suggestions_notify after insert or update on public.suggestions
for each row execute function public.notify_suggestion();

-- Live inbox updates where Supabase Realtime is set up.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
