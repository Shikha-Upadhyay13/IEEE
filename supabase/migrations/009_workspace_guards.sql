-- One personal workspace per user, even when two tabs set it up at once,
-- and no blank workspace names.

create unique index if not exists workspaces_one_personal_per_user
  on public.workspaces (created_by) where personal;

create or replace function public.ensure_personal_workspace()
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ws uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select id into ws from workspaces where personal and created_by = uid;
  if ws is null then
    begin
      insert into workspaces (name, personal, created_by) values ('Personal', true, uid) returning id into ws;
      insert into workspace_members (workspace_id, user_id, role) values (ws, uid, 'owner');
    exception when unique_violation then
      select id into ws from workspaces where personal and created_by = uid;
    end;
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
  clean_name text := trim(workspace_name);
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if clean_name = '' or clean_name is null then raise exception 'Give the workspace a name'; end if;
  if length(clean_name) > 80 then raise exception 'Workspace names can be at most 80 characters'; end if;
  insert into workspaces (name, created_by) values (clean_name, auth.uid()) returning id into ws;
  insert into workspace_members (workspace_id, user_id, role) values (ws, auth.uid(), 'owner');
  return ws;
end;
$$;
