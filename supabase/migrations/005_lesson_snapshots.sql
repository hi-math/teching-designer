-- ============================================================
-- lesson_snapshots: 전체 상태 스냅샷 (버전 관리)
-- ============================================================

create table public.lesson_snapshots (
  id          uuid primary key default gen_random_uuid(),
  lesson_id   uuid not null references public.lessons(id) on delete cascade,
  version_num int  not null,
  contents    jsonb not null default '{}',
  trigger     text not null default 'auto'
                check (trigger in ('auto', 'session_end', 'manual')),
  saved_by    uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (lesson_id, version_num)
);

create index lesson_snapshots_lookup
  on public.lesson_snapshots (lesson_id, version_num desc);

alter table public.lesson_snapshots enable row level security;

create policy "lesson_snapshots: members can read"
  on public.lesson_snapshots for select
  using (
    public.is_lesson_owner(lesson_id, auth.uid()) or
    public.is_lesson_member(lesson_id, auth.uid())
  );

create policy "lesson_snapshots: members can insert"
  on public.lesson_snapshots for insert
  with check (
    public.is_lesson_owner(lesson_id, auth.uid()) or
    public.is_lesson_rw_member(lesson_id, auth.uid())
  );
