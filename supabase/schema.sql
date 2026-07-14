-- IEEE Paper Builder — Milestone 6 schema
-- Run this once in the Supabase Dashboard: SQL Editor -> New query -> paste -> Run.

-- ── documents table ─────────────────────────────────────────────
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) not null,
  title text,                -- denormalized from titleBlock.title, for dashboard listing
  content jsonb not null,     -- the full Document JSON (src/types/document.ts)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table documents enable row level security;

create policy "select own documents"
  on documents for select
  using (auth.uid() = owner_id);

create policy "insert own documents"
  on documents for insert
  with check (auth.uid() = owner_id);

create policy "update own documents"
  on documents for update
  using (auth.uid() = owner_id);

create policy "delete own documents"
  on documents for delete
  using (auth.uid() = owner_id);

-- keep updated_at current on every edit
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger documents_set_updated_at
before update on documents
for each row
execute function set_updated_at();

-- ── figures storage bucket ──────────────────────────────────────
-- Public read (so exported PDFs and the print route can load images by URL
-- with no auth token juggling); writes restricted to the owning user, matched
-- by the first path segment being their own user id
-- (figures/{owner_id}/{documentId}/{imageId}.{ext}).
insert into storage.buckets (id, name, public)
values ('figures', 'figures', true)
on conflict (id) do nothing;

create policy "anyone can view figures"
on storage.objects for select
using (bucket_id = 'figures');

create policy "users upload their own figures"
on storage.objects for insert
with check (
  bucket_id = 'figures'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users update their own figures"
on storage.objects for update
using (
  bucket_id = 'figures'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users delete their own figures"
on storage.objects for delete
using (
  bucket_id = 'figures'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- ── export tokens (for the headless PDF export path) ────────────
-- The Playwright-driven pdf-service has no user session, so the print route
-- can't rely on RLS via auth.uid() the way a normal logged-in page view can.
-- Instead: the frontend (while the user IS logged in) mints a short-lived
-- token scoped to one document, hands it to the export service, which passes
-- it through as a query param — the print route exchanges the token for the
-- document content via get_document_by_export_token, never seeing the raw
-- table. This keeps documents from needing to be world-readable just to
-- support export. See ARCHITECTURE.md §5.3.
create table if not exists export_tokens (
  token uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) not null,
  expires_at timestamptz not null
);

alter table export_tokens enable row level security;
-- No direct select/insert policies for regular clients — only reachable
-- through the two SECURITY DEFINER functions below.

create or replace function create_export_token(doc_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_token uuid;
begin
  if not exists (select 1 from documents where id = doc_id and owner_id = auth.uid()) then
    raise exception 'not authorized to export this document';
  end if;
  delete from export_tokens where expires_at < now(); -- opportunistic cleanup
  insert into export_tokens (document_id, expires_at)
  values (doc_id, now() + interval '60 seconds')
  returning token into new_token;
  return new_token;
end;
$$;

create or replace function get_document_by_export_token(export_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  doc_content jsonb;
begin
  select d.content into doc_content
  from export_tokens t
  join documents d on d.id = t.document_id
  where t.token = export_token and t.expires_at > now();
  return doc_content; -- null if the token is missing/expired
end;
$$;

grant execute on function create_export_token(uuid) to authenticated;
grant execute on function get_document_by_export_token(uuid) to anon, authenticated;
