-- ============================================================
-- Minerva — 수업정보 컬럼 추가
-- lessons 테이블에 target_grade, related_subjects 추가
-- ============================================================

alter table public.lessons
  add column if not exists target_grade    text,
  add column if not exists related_subjects text;
