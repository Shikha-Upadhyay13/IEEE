-- Migration: 002_shareable_links.sql
-- Adds is_public flag to documents and enables public read-only access for shared papers

alter table public.documents
  add column if not exists is_public boolean not null default false;

-- Allow anyone (including unauthenticated visitors) to read public documents
create policy "anyone can view public documents"
  on public.documents for select
  using (is_public = true);
