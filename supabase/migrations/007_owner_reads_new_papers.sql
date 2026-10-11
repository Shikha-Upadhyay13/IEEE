-- `insert ... returning` checks the new row against the select policy, but
-- can_read_document() looks the row up by id and can't see a row that is
-- still being inserted — so creating a paper and reading back its id failed.
-- Checking ownership on the row itself fixes that (and skips a lookup).

drop policy if exists "members read documents" on public.documents;
create policy "members read documents" on public.documents for select
  using (owner_id = auth.uid() or public.can_read_document(id));
