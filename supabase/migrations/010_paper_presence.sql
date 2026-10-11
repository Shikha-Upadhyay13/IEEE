-- "Who else is editing" uses Realtime presence on private channels named
-- paper:<document id>. Only people who can read the paper may join, so a
-- leaked paper id doesn't reveal who is working on it.

create or replace function public.paper_topic_id(topic text)
returns uuid
language sql immutable
as $$
  select case
    when topic ~ '^paper:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then substr(topic, 7)::uuid
  end;
$$;

grant execute on function public.paper_topic_id(text) to authenticated;

do $$
begin
  if to_regclass('realtime.messages') is null then
    return;
  end if;
  execute 'drop policy if exists "paper readers receive presence" on realtime.messages';
  execute 'drop policy if exists "paper readers send presence" on realtime.messages';
  execute $p$
    create policy "paper readers receive presence" on realtime.messages for select to authenticated
    using (
      realtime.messages.extension = 'presence'
      and public.can_read_document(public.paper_topic_id(realtime.topic()))
    )
  $p$;
  execute $p$
    create policy "paper readers send presence" on realtime.messages for insert to authenticated
    with check (
      realtime.messages.extension = 'presence'
      and public.can_read_document(public.paper_topic_id(realtime.topic()))
    )
  $p$;
end;
$$;
