-- Workspace templates: admins publish a paper as a starting point that every
-- member can create new papers from.

create table if not exists public.workspace_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  content jsonb not null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists idx_workspace_templates_workspace on public.workspace_templates (workspace_id, created_at);

alter table public.workspace_templates enable row level security;

drop policy if exists "members read templates" on public.workspace_templates;
create policy "members read templates" on public.workspace_templates for select
  using (public.workspace_role(workspace_id) is not null);
drop policy if exists "admins delete templates" on public.workspace_templates;
create policy "admins delete templates" on public.workspace_templates for delete
  using (public.workspace_role(workspace_id) in ('owner', 'admin'));
-- Inserts go through publish_workspace_template, which copies the paper server-side.

create or replace function public.publish_workspace_template(doc_id uuid, ws uuid, template_name text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  template_id uuid;
begin
  if coalesce(public.workspace_role(ws) in ('owner', 'admin'), false) is false then
    raise exception 'Only workspace admins can publish templates';
  end if;
  if exists (select 1 from workspaces where id = ws and personal) then
    raise exception 'Templates are for team workspaces';
  end if;
  if not public.can_read_document(doc_id) then
    raise exception 'Not authorized';
  end if;
  insert into workspace_templates (workspace_id, name, content, created_by)
  select ws, trim(template_name), d.content, auth.uid() from documents d where d.id = doc_id
  returning id into template_id;
  return template_id;
end;
$$;

revoke all on function public.publish_workspace_template(uuid, uuid, text) from public;
grant execute on function public.publish_workspace_template(uuid, uuid, text) to authenticated;
