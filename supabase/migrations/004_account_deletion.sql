-- Migration: 004_account_deletion.sql
-- Lets a signed-in user permanently delete their own account and every row
-- they own. Storage files (figures/{uid}/..., exports/{uid}/...) are removed
-- by the client through the Storage API first, since Supabase blocks direct
-- deletes from storage.objects in SQL.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  delete from export_tokens
    where document_id in (select id from documents where owner_id = uid);
  delete from exports where owner_id = uid;
  delete from generated_images where owner_id = uid;
  delete from conversations where owner_id = uid;
  delete from projects where owner_id = uid;
  -- document_versions cascade from documents.
  delete from documents where owner_id = uid;
  -- profiles cascade from auth.users.
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
