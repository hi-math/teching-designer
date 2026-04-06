-- ============================================================
-- RLS 무한 재귀 수정
-- lesson_members 정책이 자기 자신을 참조해서 500 에러 발생
-- security definer 헬퍼 함수로 해결
-- ============================================================

-- 1) 헬퍼 함수 (security definer = postgres 권한으로 실행 → RLS 우회, 재귀 없음)
create or replace function public.is_lesson_member(p_lesson_id uuid, p_user_id uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.lesson_members
    where lesson_id = p_lesson_id and user_id = p_user_id
  );
$$;

create or replace function public.is_lesson_rw_member(p_lesson_id uuid, p_user_id uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.lesson_members
    where lesson_id = p_lesson_id
      and user_id = p_user_id
      and role in ('owner', 'member')
  );
$$;

create or replace function public.is_lesson_owner(p_lesson_id uuid, p_user_id uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.lessons
    where id = p_lesson_id and owner_id = p_user_id
  );
$$;

-- 2) 기존 재귀 문제 정책 삭제
drop policy if exists "lesson_members: members can read"   on public.lesson_members;
drop policy if exists "lesson_members: owner can manage"   on public.lesson_members;
drop policy if exists "lessons: members can read"          on public.lessons;
drop policy if exists "lessons: members can update"        on public.lessons;
drop policy if exists "activity_contents: members can read"   on public.activity_contents;
drop policy if exists "activity_contents: members can write"  on public.activity_contents;
drop policy if exists "activity_contents: members can update" on public.activity_contents;
drop policy if exists "activity_versions: members can read"   on public.activity_versions;
drop policy if exists "activity_versions: members can insert" on public.activity_versions;
drop policy if exists "team_messages: members can read"    on public.team_messages;
drop policy if exists "team_messages: members can send"    on public.team_messages;

-- 3) lesson_members 정책 재생성 (함수 사용 → 재귀 없음)
create policy "lesson_members: members can read"
  on public.lesson_members for select
  using (user_id = auth.uid());  -- 자신의 membership row만 조회 가능 (재귀 제거)

create policy "lesson_members: owner can manage"
  on public.lesson_members for all
  using (public.is_lesson_owner(lesson_id, auth.uid()))
  with check (public.is_lesson_owner(lesson_id, auth.uid()));

-- 4) lessons 정책 재생성
create policy "lessons: members can read"
  on public.lessons for select
  using (
    deleted_at is null and
    public.is_lesson_member(id, auth.uid())
  );

create policy "lessons: members can update"
  on public.lessons for update
  using (
    deleted_at is null and
    public.is_lesson_rw_member(id, auth.uid())
  );

-- 5) activity_contents 정책 재생성
create policy "activity_contents: members can read"
  on public.activity_contents for select
  using (
    public.is_lesson_owner(lesson_id, auth.uid()) or
    public.is_lesson_member(lesson_id, auth.uid())
  );

create policy "activity_contents: members can write"
  on public.activity_contents for insert
  with check (
    public.is_lesson_owner(lesson_id, auth.uid()) or
    public.is_lesson_rw_member(lesson_id, auth.uid())
  );

create policy "activity_contents: members can update"
  on public.activity_contents for update
  using (
    public.is_lesson_owner(lesson_id, auth.uid()) or
    public.is_lesson_rw_member(lesson_id, auth.uid())
  );

-- 6) activity_versions 정책 재생성
create policy "activity_versions: members can read"
  on public.activity_versions for select
  using (
    public.is_lesson_owner(lesson_id, auth.uid()) or
    public.is_lesson_member(lesson_id, auth.uid())
  );

create policy "activity_versions: members can insert"
  on public.activity_versions for insert
  with check (
    public.is_lesson_owner(lesson_id, auth.uid()) or
    public.is_lesson_rw_member(lesson_id, auth.uid())
  );

-- 7) team_messages 정책 재생성
create policy "team_messages: members can read"
  on public.team_messages for select
  using (
    public.is_lesson_owner(lesson_id, auth.uid()) or
    public.is_lesson_member(lesson_id, auth.uid())
  );

create policy "team_messages: members can send"
  on public.team_messages for insert
  with check (
    user_id = auth.uid() and (
      public.is_lesson_owner(lesson_id, auth.uid()) or
      public.is_lesson_rw_member(lesson_id, auth.uid())
    )
  );
