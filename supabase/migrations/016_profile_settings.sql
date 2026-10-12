-- Profile details and per-account preferences for the Settings page. New
-- papers start from these (author block, format, paper size, mode), so they
-- live in the database and follow the account across devices.

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists orcid text,
  add column if not exists affiliation text,
  add column if not exists paper_defaults jsonb not null default '{}',
  add column if not exists editor_preferences jsonb not null default '{}';

alter table public.profiles drop constraint if exists profiles_details_reasonable;
alter table public.profiles add constraint profiles_details_reasonable check (
  coalesce(char_length(full_name), 0) <= 120
  and coalesce(char_length(affiliation), 0) <= 300
  and (orcid is null or orcid ~ '^[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{3}[0-9X]$')
  and jsonb_typeof(paper_defaults) = 'object' and pg_column_size(paper_defaults) <= 2048
  and jsonb_typeof(editor_preferences) = 'object' and pg_column_size(editor_preferences) <= 2048
);

-- Accounts created before 001 ran have no profile row; Settings upserts one.
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);
