-- lessons 테이블 Realtime 활성화 (제목 동기화용)
alter table public.lessons replica identity full;
alter publication supabase_realtime add table public.lessons;
