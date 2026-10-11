-- The read-only view now serves everyone with access, not just owners and
-- public links: reviewers and viewers are sent there from the editor. It
-- also returns the caller's role so the page can offer Edit or Comment, and
-- hides trashed papers from everyone but their owner.

drop function if exists public.get_shared_document(uuid);

create function public.get_shared_document(doc_id uuid)
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
      d.owner_id = auth.uid()
      or (d.deleted_at is null and (d.is_public or public.document_role(d.id) is not null))
    );
$$;

revoke all on function public.get_shared_document(uuid) from public;
grant execute on function public.get_shared_document(uuid) to anon, authenticated;
