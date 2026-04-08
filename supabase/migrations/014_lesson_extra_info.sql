-- ============================================================
-- Minerva — 수업 기본정보 추가 컬럼
-- 학급수, 학생수, 총 차시
-- ============================================================

alter table public.lessons
  add column if not exists num_classes   int,
  add column if not exists num_students  int,
  add column if not exists total_sessions int;
