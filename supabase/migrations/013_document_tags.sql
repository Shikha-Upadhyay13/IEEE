-- Free-form tags for organizing papers on the dashboard (e.g. "ICRA 2027", "thesis").

alter table public.documents
  add column if not exists tags text[] not null default '{}';

alter table public.documents drop constraint if exists documents_tags_reasonable;
alter table public.documents add constraint documents_tags_reasonable
  check (cardinality(tags) <= 20 and array_to_string(tags, '') !~ '[\n\r]' and coalesce(length(array_to_string(tags, ',')), 0) <= 1000);
