-- ============================================================
-- 초기화 — 기존 테이블 전체 삭제 후 재생성 전 실행
-- ============================================================

drop table if exists public.ai_messages       cascade;
drop table if exists public.team_messages     cascade;
drop table if exists public.activity_versions cascade;
drop table if exists public.activity_contents cascade;
drop table if exists public.lesson_members    cascade;
drop table if exists public.lessons           cascade;
drop table if exists public.folders           cascade;
drop table if exists public.profiles          cascade;

drop function if exists public.set_updated_at()    cascade;
drop function if exists public.add_lesson_owner()  cascade;
drop function if exists public.handle_new_user()   cascade;
