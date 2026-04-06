-- ── is_lesson_member: 재귀 없이 멤버십 확인 (security definer) ──
create or replace function public.is_lesson_member(p_lesson_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.lesson_members
    where lesson_id = p_lesson_id and user_id = p_user_id
  ) or exists (
    select 1 from public.lessons
    where id = p_lesson_id and owner_id = p_user_id
  )
$$;

-- 기존 제한 정책 교체 (본인 row만 → 같은 레슨 전체 row)
drop policy if exists "lesson_members: members can read" on public.lesson_members;

create policy "lesson_members: members can read all"
  on public.lesson_members for select
  using (public.is_lesson_member(lesson_id, auth.uid()));

-- Realtime 활성화
alter table public.lesson_members replica identity full;
alter publication supabase_realtime add table public.lesson_members;
