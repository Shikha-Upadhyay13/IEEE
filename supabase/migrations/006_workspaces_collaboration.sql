-- Migration: 006_workspaces_collaboration.sql
-- Workspaces, per-paper roles, invitations, comments and suggestions.
-- Run in the Supabase SQL Editor before deploying the app version that uses
-- workspaces or sharing by email. Safe to run on a live database: existing
-- papers keep their owner, move into the owner's personal workspace and stay
-- private.

-- ── Workspaces ───────────────────────────────────────────────────
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  personal boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index if not exists idx_workspace_members_user on public.workspace_members (user_id);

create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  role text not null check (role in ('admin', 'member')),
  token uuid not null unique default gen_random_uuid(),
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_workspace_invitations_email on public.workspace_invitations (lower(email));

-- ── Papers: workspace, sharing level, version, archive and trash ─
alter table public.documents
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null,
  -- private: owner and invited members only; view/edit: every workspace member.
  add column if not exists workspace_access text not null default 'private'
    check (workspace_access in ('private', 'view', 'edit')),
  -- Bumped on every content change; saves send the version they started from.
  add column if not exists version integer not null default 1,
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz;
create index if not exists idx_documents_workspace on public.documents (workspace_id);

create table if not exists public.document_members (
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('editor', 'reviewer', 'viewer')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (document_id, user_id)
);
create index if not exists idx_document_members_user on public.document_members (user_id);

create table if not exists public.document_invitations (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  role text not null check (role in ('editor', 'reviewer', 'viewer')),
  token uuid not null unique default gen_random_uuid(),
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_document_invitations_email on public.document_invitations (lower(email));

-- ── Comments and suggestions ─────────────────────────────────────
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  -- Body block the thread is anchored to; null for paper-level comments.
  block_id text,
  parent_id uuid references public.comments(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null default auth.uid(),
  body text not null check (char_length(body) between 1 and 10000),
  mentions uuid[] not null default '{}',
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_comments_document on public.comments (document_id, created_at);

create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  block_id text not null,
  author_id uuid references auth.users(id) on delete set null default auth.uid(),
  -- Proposed replacement content for the block (InlineNode[] for paragraphs).
  proposed jsonb not null,
  -- The block's text when the suggestion was made, to detect stale suggestions.
  base_text text not null default '',
  note text check (note is null or char_length(note) <= 2000),
  status text not null default 'open' check (status in ('open', 'accepted', 'rejected')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_suggestions_document on public.suggestions (document_id, status);

-- ── Access helpers ───────────────────────────────────────────────
-- security definer so policies can consult membership tables without
-- recursing through their own row-level security.
create or replace function public.workspace_role(ws uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select role from workspace_members where workspace_id = ws and user_id = auth.uid();
$$;

create or replace function public.document_role(doc uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select case
    when d.owner_id = auth.uid() then 'owner'
    when m.role is not null then m.role
    when d.workspace_access = 'edit' and wm.user_id is not null then 'editor'
    when d.workspace_access = 'view' and wm.user_id is not null then 'viewer'
  end
  from documents d
  left join document_members m on m.document_id = d.id and m.user_id = auth.uid()
  left join workspace_members wm on wm.workspace_id = d.workspace_id and wm.user_id = auth.uid()
  where d.id = doc;
$$;

create or replace function public.can_read_document(doc uuid)
returns boolean
language sql stable security definer set search_path = public
as $$ select public.document_role(doc) is not null; $$;

create or replace function public.can_edit_document(doc uuid)
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.document_role(doc) in ('owner', 'editor'), false); $$;

create or replace function public.can_comment_document(doc uuid)
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.document_role(doc) in ('owner', 'editor', 'reviewer'), false); $$;

revoke all on function public.workspace_role(uuid) from public;
revoke all on function public.document_role(uuid) from public;
revoke all on function public.can_read_document(uuid) from public;
revoke all on function public.can_edit_document(uuid) from public;
revoke all on function public.can_comment_document(uuid) from public;
-- anon too: policies call these for signed-out requests, where they return no access.
grant execute on function public.workspace_role(uuid) to anon, authenticated;
grant execute on function public.document_role(uuid) to anon, authenticated;
grant execute on function public.can_read_document(uuid) to anon, authenticated;
grant execute on function public.can_edit_document(uuid) to anon, authenticated;
grant execute on function public.can_comment_document(uuid) to anon, authenticated;

-- ── Row-level security ───────────────────────────────────────────
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invitations enable row level security;
alter table public.document_members enable row level security;
alter table public.document_invitations enable row level security;
alter table public.comments enable row level security;
alter table public.suggestions enable row level security;

-- Workspaces: members read; creating goes through create_workspace().
create policy "members read workspaces" on public.workspaces for select
  using (public.workspace_role(id) is not null);
create policy "admins rename workspaces" on public.workspaces for update
  using (public.workspace_role(id) in ('owner', 'admin'));
create policy "owners delete shared workspaces" on public.workspaces for delete
  using (public.workspace_role(id) = 'owner' and not personal);

create policy "members read members" on public.workspace_members for select
  using (public.workspace_role(workspace_id) is not null);
create policy "admins change member roles" on public.workspace_members for update
  using (public.workspace_role(workspace_id) in ('owner', 'admin') and role <> 'owner')
  with check (role in ('admin', 'member'));
create policy "admins remove members or members leave" on public.workspace_members for delete
  using (
    role <> 'owner'
    and (user_id = auth.uid() or public.workspace_role(workspace_id) in ('owner', 'admin'))
  );

create policy "admins read workspace invitations" on public.workspace_invitations for select
  using (public.workspace_role(workspace_id) in ('owner', 'admin'));
create policy "admins revoke workspace invitations" on public.workspace_invitations for delete
  using (public.workspace_role(workspace_id) in ('owner', 'admin'));

-- Papers: replace the owner-only policies.
drop policy if exists "select own documents" on public.documents;
drop policy if exists "insert own documents" on public.documents;
drop policy if exists "update own documents" on public.documents;
drop policy if exists "delete own documents" on public.documents;

create policy "users create papers in their workspaces" on public.documents for insert
  with check (
    owner_id = auth.uid()
    and (workspace_id is null or public.workspace_role(workspace_id) is not null)
  );
create policy "members read documents" on public.documents for select
  using (public.can_read_document(id));
create policy "editors update documents" on public.documents for update
  using (public.can_edit_document(id));
create policy "owners delete documents" on public.documents for delete
  using (owner_id = auth.uid());

-- Only the owner may change who owns a paper, who it is shared with, or
-- where it lives; editors change content and title only.
create or replace function public.guard_document_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.version := case when new.content is distinct from old.content then old.version + 1 else old.version end;
  -- No signed-in user: migrations and the service role, which are trusted.
  if auth.uid() is null then
    return new;
  end if;
  if new.owner_id is distinct from old.owner_id then
    raise exception 'The owner of a paper cannot be changed';
  end if;
  if old.owner_id <> auth.uid() and (
    new.is_public is distinct from old.is_public
    or new.workspace_id is distinct from old.workspace_id
    or new.workspace_access is distinct from old.workspace_access
    or new.archived_at is distinct from old.archived_at
    or new.deleted_at is distinct from old.deleted_at
  ) then
    raise exception 'Only the owner can change sharing, workspace, archive or trash settings';
  end if;
  if new.workspace_id is distinct from old.workspace_id
     and new.workspace_id is not null
     and public.workspace_role(new.workspace_id) is null then
    raise exception 'You are not a member of that workspace';
  end if;
  return new;
end;
$$;

drop trigger if exists documents_guard_update on public.documents;
create trigger documents_guard_update
before update on public.documents
for each row execute function public.guard_document_update();

create policy "members read document members" on public.document_members for select
  using (public.can_read_document(document_id));
create policy "owners change document roles" on public.document_members for update
  using (public.document_role(document_id) = 'owner')
  with check (role in ('editor', 'reviewer', 'viewer'));
create policy "owners remove members or members leave" on public.document_members for delete
  using (user_id = auth.uid() or public.document_role(document_id) = 'owner');

create policy "owners read document invitations" on public.document_invitations for select
  using (public.document_role(document_id) = 'owner');
create policy "owners revoke document invitations" on public.document_invitations for delete
  using (public.document_role(document_id) = 'owner');

create policy "readers read comments" on public.comments for select
  using (public.can_read_document(document_id));
create policy "reviewers add comments" on public.comments for insert
  with check (author_id = auth.uid() and public.can_comment_document(document_id));
create policy "authors edit and editors resolve comments" on public.comments for update
  using (author_id = auth.uid() or public.can_edit_document(document_id))
  with check (public.can_comment_document(document_id));
create policy "authors and owners delete comments" on public.comments for delete
  using (author_id = auth.uid() or public.document_role(document_id) = 'owner');

create policy "readers read suggestions" on public.suggestions for select
  using (public.can_read_document(document_id));
create policy "reviewers add suggestions" on public.suggestions for insert
  with check (author_id = auth.uid() and status = 'open' and public.can_comment_document(document_id));
create policy "editors decide suggestions" on public.suggestions for update
  using (public.can_edit_document(document_id));
create policy "authors and owners delete suggestions" on public.suggestions for delete
  using (author_id = auth.uid() or public.document_role(document_id) = 'owner');

-- Comment authors may edit their text; resolving is open to editors.
create or replace function public.guard_comment_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.document_id <> old.document_id or new.author_id is distinct from old.author_id
     or new.parent_id is distinct from old.parent_id or new.block_id is distinct from old.block_id then
    raise exception 'Only the text and resolved state of a comment can change';
  end if;
  if new.body <> old.body and old.author_id is distinct from auth.uid() then
    raise exception 'Only the author can edit a comment';
  end if;
  new.updated_at := now();
  if new.resolved_at is not null and old.resolved_at is null then
    new.resolved_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists comments_guard_update on public.comments;
create trigger comments_guard_update
before update on public.comments
for each row execute function public.guard_comment_update();

create or replace function public.guard_suggestion_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.document_id <> old.document_id or new.author_id is distinct from old.author_id
     or new.block_id <> old.block_id or new.proposed <> old.proposed then
    raise exception 'Only the status of a suggestion can change';
  end if;
  if new.status <> old.status then
    new.decided_by := auth.uid();
    new.decided_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists suggestions_guard_update on public.suggestions;
create trigger suggestions_guard_update
before update on public.suggestions
for each row execute function public.guard_suggestion_update();

-- Version history follows paper access.
drop policy if exists "select own document versions" on public.document_versions;
drop policy if exists "insert own document versions" on public.document_versions;
drop policy if exists "delete own document versions" on public.document_versions;
create policy "readers read versions" on public.document_versions for select
  using (public.can_read_document(document_id));
create policy "editors add versions" on public.document_versions for insert
  with check (public.can_edit_document(document_id));
create policy "owners delete versions" on public.document_versions for delete
  using (public.document_role(document_id) = 'owner');

-- ── Workspace and sharing functions ──────────────────────────────
create or replace function public.ensure_personal_workspace()
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ws uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select w.id into ws from workspaces w
    join workspace_members m on m.workspace_id = w.id and m.user_id = uid
    where w.personal and w.created_by = uid
    limit 1;
  if ws is null then
    insert into workspaces (name, personal, created_by) values ('Personal', true, uid) returning id into ws;
    insert into workspace_members (workspace_id, user_id, role) values (ws, uid, 'owner');
  end if;
  update documents set workspace_id = ws where owner_id = uid and workspace_id is null;
  return ws;
end;
$$;

create or replace function public.create_workspace(workspace_name text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  ws uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  insert into workspaces (name, created_by) values (trim(workspace_name), auth.uid()) returning id into ws;
  insert into workspace_members (workspace_id, user_id, role) values (ws, auth.uid(), 'owner');
  return ws;
end;
$$;

-- Adds an existing user straight away, or leaves an invitation for an email
-- that has no account yet. Returns 'added' or 'invited'.
create or replace function public.invite_to_document(doc_id uuid, invitee_email text, invitee_role text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  invitee uuid;
  clean_email text := lower(trim(invitee_email));
begin
  if coalesce(public.document_role(doc_id) = 'owner', false) is false then
    raise exception 'Only the owner can share this paper';
  end if;
  if invitee_role not in ('editor', 'reviewer', 'viewer') then
    raise exception 'Unknown role %', invitee_role;
  end if;
  select id into invitee from auth.users where lower(email) = clean_email;
  if invitee = auth.uid() then
    raise exception 'You already own this paper';
  end if;
  if invitee is not null then
    insert into document_members (document_id, user_id, role, invited_by)
    values (doc_id, invitee, invitee_role, auth.uid())
    on conflict (document_id, user_id) do update set role = excluded.role;
    return 'added';
  end if;
  delete from document_invitations where document_id = doc_id and lower(email) = clean_email and accepted_at is null;
  insert into document_invitations (document_id, email, role, invited_by)
  values (doc_id, clean_email, invitee_role, auth.uid());
  return 'invited';
end;
$$;

create or replace function public.invite_to_workspace(ws uuid, invitee_email text, invitee_role text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  invitee uuid;
  clean_email text := lower(trim(invitee_email));
begin
  if coalesce(public.workspace_role(ws) in ('owner', 'admin'), false) is false then
    raise exception 'Only workspace admins can invite people';
  end if;
  if exists (select 1 from workspaces where id = ws and personal) then
    raise exception 'Personal workspaces cannot be shared; create a team workspace instead';
  end if;
  if invitee_role not in ('admin', 'member') then
    raise exception 'Unknown role %', invitee_role;
  end if;
  select id into invitee from auth.users where lower(email) = clean_email;
  if invitee is not null then
    insert into workspace_members (workspace_id, user_id, role)
    values (ws, invitee, invitee_role)
    on conflict (workspace_id, user_id) do nothing;
    return 'added';
  end if;
  delete from workspace_invitations where workspace_id = ws and lower(email) = clean_email and accepted_at is null;
  insert into workspace_invitations (workspace_id, email, role, invited_by)
  values (ws, clean_email, invitee_role, auth.uid());
  return 'invited';
end;
$$;

-- Turns every open invitation for the signed-in user's email into membership.
-- Called after sign-in and sign-up. Returns how many were accepted.
create or replace function public.accept_my_invitations()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  my_email text;
  accepted integer := 0;
  n integer;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select lower(email) into my_email from auth.users where id = uid and email_confirmed_at is not null;
  if my_email is null then return 0; end if;

  insert into document_members (document_id, user_id, role, invited_by)
  select document_id, uid, role, invited_by from document_invitations
  where lower(email) = my_email and accepted_at is null and expires_at > now()
  on conflict (document_id, user_id) do nothing;
  get diagnostics n = row_count;
  accepted := accepted + n;
  update document_invitations set accepted_at = now()
  where lower(email) = my_email and accepted_at is null and expires_at > now();

  insert into workspace_members (workspace_id, user_id, role)
  select workspace_id, uid, role from workspace_invitations
  where lower(email) = my_email and accepted_at is null and expires_at > now()
  on conflict (workspace_id, user_id) do nothing;
  get diagnostics n = row_count;
  accepted := accepted + n;
  update workspace_invitations set accepted_at = now()
  where lower(email) = my_email and accepted_at is null and expires_at > now();

  return accepted;
end;
$$;

-- Owner and members of one paper, with emails, for the share dialog and
-- comment author names. Only callable by someone who can read the paper.
create or replace function public.document_people(doc_id uuid)
returns table (user_id uuid, email text, role text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.can_read_document(doc_id) then
    raise exception 'Not authorized';
  end if;
  return query
    select u.id, u.email::text, 'owner'::text
    from documents d join auth.users u on u.id = d.owner_id
    where d.id = doc_id
    union all
    select u.id, u.email::text, m.role
    from document_members m join auth.users u on u.id = m.user_id
    where m.document_id = doc_id;
end;
$$;

create or replace function public.workspace_people(ws uuid)
returns table (user_id uuid, email text, role text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if public.workspace_role(ws) is null then
    raise exception 'Not authorized';
  end if;
  return query
    select u.id, u.email::text, m.role
    from workspace_members m join auth.users u on u.id = m.user_id
    where m.workspace_id = ws;
end;
$$;

revoke all on function public.ensure_personal_workspace() from public;
revoke all on function public.create_workspace(text) from public;
revoke all on function public.invite_to_document(uuid, text, text) from public;
revoke all on function public.invite_to_workspace(uuid, text, text) from public;
revoke all on function public.accept_my_invitations() from public;
revoke all on function public.document_people(uuid) from public;
revoke all on function public.workspace_people(uuid) from public;
grant execute on function public.ensure_personal_workspace() to authenticated;
grant execute on function public.create_workspace(text) to authenticated;
grant execute on function public.invite_to_document(uuid, text, text) to authenticated;
grant execute on function public.invite_to_workspace(uuid, text, text) to authenticated;
grant execute on function public.accept_my_invitations() to authenticated;
grant execute on function public.document_people(uuid) to authenticated;
grant execute on function public.workspace_people(uuid) to authenticated;

-- Collaborators can export papers they can read.
create or replace function public.create_export_token(doc_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  new_token uuid;
begin
  if not public.can_read_document(doc_id) then
    raise exception 'not authorized to export this document';
  end if;
  delete from export_tokens where expires_at < now();
  insert into export_tokens (document_id, expires_at)
  values (doc_id, now() + interval '60 seconds')
  returning token into new_token;
  return new_token;
end;
$$;

-- Account deletion also removes the user's personal workspace.
create or replace function public.delete_own_account()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  delete from export_tokens
    where document_id in (select id from documents where owner_id = uid);
  delete from exports where owner_id = uid;
  delete from generated_images where owner_id = uid;
  delete from conversations where owner_id = uid;
  delete from projects where owner_id = uid;
  delete from documents where owner_id = uid;
  delete from workspaces where personal and created_by = uid;
  delete from auth.users where id = uid;
end;
$$;

-- ── Backfill: a personal workspace for every existing user ───────
do $$
declare
  u record;
  ws uuid;
begin
  for u in select id from auth.users loop
    select w.id into ws from workspaces w where w.personal and w.created_by = u.id limit 1;
    if ws is null then
      insert into workspaces (name, personal, created_by) values ('Personal', true, u.id) returning id into ws;
      insert into workspace_members (workspace_id, user_id, role) values (ws, u.id, 'owner');
    end if;
    update documents set workspace_id = ws where owner_id = u.id and workspace_id is null;
  end loop;
end;
$$;
