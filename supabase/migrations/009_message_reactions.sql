create table if not exists public.team_message_reactions (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references public.team_messages(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  emoji       text not null,
  created_at  timestamptz not null default now(),
  constraint team_message_reactions_unique unique (message_id, user_id, emoji)
);

-- DELETE 이벤트에서 old record 전체 컬럼을 Realtime으로 받으려면 필요
alter table public.team_message_reactions replica identity full;

alter table public.team_message_reactions enable row level security;

create policy "reactions: members can read"
  on public.team_message_reactions for select
  using (
    exists (
      select 1 from public.team_messages tm
      where tm.id = team_message_reactions.message_id
        and (
          exists (select 1 from public.lessons where id = tm.lesson_id and owner_id = auth.uid())
          or exists (select 1 from public.lesson_members where lesson_id = tm.lesson_id and user_id = auth.uid())
        )
    )
  );

create policy "reactions: members can insert"
  on public.team_message_reactions for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.team_messages tm
      where tm.id = message_id
        and (
          exists (select 1 from public.lessons where id = tm.lesson_id and owner_id = auth.uid())
          or exists (
            select 1 from public.lesson_members
            where lesson_id = tm.lesson_id and user_id = auth.uid() and role in ('owner', 'member')
          )
        )
    )
  );

create policy "reactions: users can delete own"
  on public.team_message_reactions for delete
  using (user_id = auth.uid());
