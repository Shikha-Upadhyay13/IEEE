-- Accounts with a verified authenticator app must finish two-factor sign-in
-- (aal2) before reading or changing anything; a stolen password alone gets an
-- aal1 session that sees nothing. Accounts without one are unaffected.

create or replace function public.second_factor_ok()
returns boolean
language sql stable security definer set search_path = public
as $$
  select auth.uid() is null
    or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified');
$$;
revoke all on function public.second_factor_ok() from public;
grant execute on function public.second_factor_ok() to anon, authenticated;

-- Restrictive: combined with AND, on top of each table's existing policies.
do $$
declare
  t text;
begin
  foreach t in array array[
    'documents', 'document_versions', 'document_members', 'document_invitations', 'comments', 'suggestions',
    'workspaces', 'workspace_members', 'workspace_invitations', 'workspace_templates',
    'notifications', 'notification_preferences', 'paper_notification_levels', 'email_settings',
    'profiles', 'projects', 'conversations', 'generated_images', 'exports', 'export_tokens'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists "second factor when enrolled" on public.%I', t);
      execute format(
        'create policy "second factor when enrolled" on public.%I as restrictive for all to authenticated
           using ((select public.second_factor_ok())) with check ((select public.second_factor_ok()))', t);
    end if;
  end loop;
end;
$$;

-- The role helpers behind sharing, comments, presence and the share view
-- report no access until the second factor is done.
create or replace function public.workspace_role(ws uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select role from workspace_members
  where workspace_id = ws and user_id = auth.uid() and public.second_factor_ok();
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
  where d.id = doc and public.second_factor_ok();
$$;

-- Public links keep working; everything else needs the second factor.
create or replace function public.get_shared_document(doc_id uuid)
returns table (id uuid, title text, content jsonb, is_public boolean, is_owner boolean, role text)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, d.title, d.content, d.is_public, d.owner_id = auth.uid(), public.document_role(d.id)
  from documents d
  where d.id = doc_id
    and (
      (d.owner_id = auth.uid() and public.second_factor_ok())
      or (d.deleted_at is null and (d.is_public or public.document_role(d.id) is not null))
    );
$$;

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
  if not public.second_factor_ok() then
    raise exception 'Enter the code from your authenticator app first';
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
