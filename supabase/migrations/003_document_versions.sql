-- Migration: 003_document_versions.sql
-- Document version history: snapshots of paper content at specific points in time

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.documents(id) on delete cascade not null,
  title text,
  content jsonb not null,
  created_at timestamptz default now()
);

-- Index for fast lookup by document ordered by creation date
create index if not exists idx_document_versions_doc_id_created 
  on public.document_versions (document_id, created_at desc);

alter table public.document_versions enable row level security;

create policy "select own document versions"
  on public.document_versions for select
  using (
    exists (
      select 1 from public.documents
      where public.documents.id = document_versions.document_id
        and public.documents.owner_id = auth.uid()
    )
  );

create policy "insert own document versions"
  on public.document_versions for insert
  with check (
    exists (
      select 1 from public.documents
      where public.documents.id = document_versions.document_id
        and public.documents.owner_id = auth.uid()
    )
  );

create policy "delete own document versions"
  on public.document_versions for delete
  using (
    exists (
      select 1 from public.documents
      where public.documents.id = document_versions.document_id
        and public.documents.owner_id = auth.uid()
    )
  );
