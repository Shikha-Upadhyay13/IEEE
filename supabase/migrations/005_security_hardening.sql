-- Migration: 005_security_hardening.sql
-- Run in the Supabase SQL Editor before deploying the app version that calls
-- get_shared_document (ViewPage and the /api/share link-preview function).

-- ── Shared papers: lookup by id only ─────────────────────────────
-- The old policy let anyone holding the anon key list every public paper
-- (and the author emails inside them) with one unfiltered select. Shared
-- papers are now readable only one at a time, by someone who has the link.
drop policy if exists "anyone can view public documents" on public.documents;

drop function if exists public.get_shared_document(uuid);
create function public.get_shared_document(doc_id uuid)
returns table (id uuid, title text, content jsonb, is_public boolean, is_owner boolean)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, d.title, d.content, d.is_public, d.owner_id = auth.uid()
  from documents d
  where d.id = doc_id
    and (d.is_public or d.owner_id = auth.uid());
$$;

revoke all on function public.get_shared_document(uuid) from public;
grant execute on function public.get_shared_document(uuid) to anon, authenticated;

-- ── Export tokens follow their paper ─────────────────────────────
-- Without the cascade, deleting a paper with a live export token failed.
alter table public.export_tokens
  drop constraint if exists export_tokens_document_id_fkey;
alter table public.export_tokens
  add constraint export_tokens_document_id_fkey
  foreign key (document_id) references public.documents(id) on delete cascade;

-- ── Figures bucket ───────────────────────────────────────────────
-- The bucket stays public, so image URLs keep working in previews and PDF
-- export without a select policy. The old blanket select policy also let
-- anyone list every user's uploaded files; listing is now owner-only.
drop policy if exists "anyone can view figures" on storage.objects;

drop policy if exists "users list their own figures" on storage.objects;
create policy "users list their own figures"
on storage.objects for select
using (
  bucket_id = 'figures'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- SVG is excluded because it can carry script.
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/gif', 'image/webp']
where id = 'figures';

update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array['application/pdf']
where id = 'exports';
