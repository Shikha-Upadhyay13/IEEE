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

-- ── AI Assistant: projects + conversations ───────────────────────
-- "Projects" here are a lightweight folder a user can file chats under —
-- unrelated to the `documents` table (an IEEE paper); a project has no
-- content of its own beyond a name, it just groups conversations.
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) not null,
  name text not null,
  -- The paper this project is "about" — every new chat started inside the
  -- project auto-attaches this paper as context (see AssistantPage's
  -- handleNewChat). Nullable: a project with no default paper just behaves
  -- like a plain folder.
  default_document_id uuid references documents(id) on delete set null,
  created_at timestamptz default now()
);

alter table projects enable row level security;

create policy "select own projects"
  on projects for select
  using (auth.uid() = owner_id);

create policy "insert own projects"
  on projects for insert
  with check (auth.uid() = owner_id);

create policy "update own projects"
  on projects for update
  using (auth.uid() = owner_id);

create policy "delete own projects"
  on projects for delete
  using (auth.uid() = owner_id);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) not null,
  -- Deleting a project keeps its conversations (moved to "no project"),
  -- rather than cascading — losing chat history as a side effect of
  -- deleting a folder would be a nasty surprise.
  project_id uuid references projects(id) on delete set null,
  title text not null default 'New chat',
  -- Full message history as a JSON array of {role, content} — same
  -- "just store the JSON, derive nothing else persistently" shape as
  -- documents.content, for the same reason (no migration on schema tweaks).
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table conversations enable row level security;

create policy "select own conversations"
  on conversations for select
  using (auth.uid() = owner_id);

create policy "insert own conversations"
  on conversations for insert
  with check (auth.uid() = owner_id);

create policy "update own conversations"
  on conversations for update
  using (auth.uid() = owner_id);

create policy "delete own conversations"
  on conversations for delete
  using (auth.uid() = owner_id);

create trigger conversations_set_updated_at
before update on conversations
for each row
execute function set_updated_at();

-- ── AI Assistant: image generation gallery ───────────────────────
-- Images themselves are generated by Pollinations.ai (a free, keyless API —
-- see ai-service's rationale for why no proxy/secret is needed here) and
-- served straight from its CDN; this table only remembers the prompt/seed/
-- URL so a user's past generations survive a page refresh, the same
-- "just store enough to redisplay it" shape as everything else here.
create table if not exists generated_images (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) not null,
  prompt text not null,
  image_url text not null,
  created_at timestamptz default now()
);

alter table generated_images enable row level security;

create policy "select own generated images"
  on generated_images for select
  using (auth.uid() = owner_id);

create policy "insert own generated images"
  on generated_images for insert
  with check (auth.uid() = owner_id);

create policy "delete own generated images"
  on generated_images for delete
  using (auth.uid() = owner_id);

-- ── Downloads: persisted copies of every PDF export ──────────────
-- Exporting still triggers an immediate browser download as before — this
-- additionally keeps a copy in Storage so past exports live somewhere
-- durable, not just "wherever your OS Downloads folder put it". title is
-- denormalized (copied at export time) so a later paper rename/deletion
-- doesn't change or break what this row shows.
create table if not exists exports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) not null,
  document_id uuid references documents(id) on delete set null,
  title text not null,
  storage_path text not null,
  created_at timestamptz default now()
);

alter table exports enable row level security;

create policy "select own exports"
  on exports for select
  using (auth.uid() = owner_id);

create policy "insert own exports"
  on exports for insert
  with check (auth.uid() = owner_id);

create policy "delete own exports"
  on exports for delete
  using (auth.uid() = owner_id);

-- Private (not public like the figures bucket) — a paper's full exported
-- text is more sensitive than a figure image, so downloads go through a
-- short-lived signed URL (mirroring the existing export_tokens pattern)
-- rather than being world-readable by URL.
insert into storage.buckets (id, name, public)
values ('exports', 'exports', false)
on conflict (id) do nothing;

create policy "users read their own exported pdfs"
on storage.objects for select
using (
  bucket_id = 'exports'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users upload their own exported pdfs"
on storage.objects for insert
with check (
  bucket_id = 'exports'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users delete their own exported pdfs"
on storage.objects for delete
using (
  bucket_id = 'exports'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- ── Migration: per-project default paper ───────────────────────────
-- Lets a Project carry a default attached paper, so every new chat
-- started inside it automatically has that paper's context - the
-- point of "projects" is working on separate papers separately.
-- Run this once for existing databases; new ones get it from the
-- create table above already (if recreating from scratch).
alter table projects
  add column if not exists default_document_id uuid references documents(id) on delete set null;
