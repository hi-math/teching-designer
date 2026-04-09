-- lesson_members Realtime 활성화
-- 새 멤버가 합류할 때 소유자에게 즉시 알림 전달을 위해 필요
alter table public.lesson_members replica identity full;
alter publication supabase_realtime add table public.lesson_members;
