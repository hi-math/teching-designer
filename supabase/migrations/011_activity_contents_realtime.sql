-- activity_contents Realtime 활성화
alter table public.activity_contents replica identity full;
alter publication supabase_realtime add table public.activity_contents;
