-- Papers in Trash are restorable for 30 days, then deleted for good.

create or replace function public.purge_trashed_documents()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  purged integer;
begin
  delete from documents where deleted_at < now() - interval '30 days';
  get diagnostics purged = row_count;
  return purged;
end;
$$;

revoke all on function public.purge_trashed_documents() from public, anon, authenticated;

-- Daily at 03:17 UTC where pg_cron is available (Supabase: Database →
-- Extensions). Without it, run `select public.purge_trashed_documents();`
-- from a scheduled job of your choice.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('purge-trashed-documents', '17 3 * * *', 'select public.purge_trashed_documents()');
  end if;
end;
$$;
