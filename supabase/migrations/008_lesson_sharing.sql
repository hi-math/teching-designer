-- ── 초대 링크 테이블 ──────────────────────────────────────────────
create table if not exists public.lesson_invites (
  id          uuid primary key default gen_random_uuid(),
  lesson_id   uuid not null references public.lessons(id) on delete cascade,
  email       text,                              -- null = 누구나 사용 가능
  token       text unique not null,              -- URL에 사용되는 고유 토큰
  created_by  uuid not null references auth.users(id),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz,                       -- null = 만료 없음
  used_by     uuid references auth.users(id),
  used_at     timestamptz
);

alter table public.lesson_invites enable row level security;

-- 소유자는 자신의 레슨에 대한 초대를 관리
create policy "lesson_invites: owner can manage"
  on public.lesson_invites for all
  using (
    exists (
      select 1 from public.lessons
      where id = lesson_invites.lesson_id and owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.lessons
      where id = lesson_invites.lesson_id and owner_id = auth.uid()
    )
  );

-- 이미 참여한 멤버는 초대 읽기 가능 (초대 목록 확인용)
create policy "lesson_invites: members can read"
  on public.lesson_invites for select
  using (
    exists (
      select 1 from public.lesson_members
      where lesson_id = lesson_invites.lesson_id and user_id = auth.uid()
    )
  );
