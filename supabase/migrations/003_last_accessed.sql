-- lessons에 last_accessed_at 추가 (최근 뷰용)
alter table public.lessons
  add column if not exists last_accessed_at timestamptz;
