-- ============================================================
-- lesson-files: 프로젝트별 파일 업로드 스토리지
-- ============================================================

-- 1) 버킷 생성 (비공개)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lesson-files',
  'lesson-files',
  false,
  52428800,  -- 50MB
  null       -- 모든 파일 타입 허용
)
on conflict (id) do nothing;

-- 2) storage.objects RLS 정책
-- 경로 구조: {lesson_id}/{filename}
-- (storage.foldername(name))[1] = lesson_id

create policy "lesson-files: members can read"
  on storage.objects for select
  using (
    bucket_id = 'lesson-files' and
    (
      public.is_lesson_owner((storage.foldername(name))[1]::uuid, auth.uid()) or
      public.is_lesson_member((storage.foldername(name))[1]::uuid, auth.uid())
    )
  );

create policy "lesson-files: members can upload"
  on storage.objects for insert
  with check (
    bucket_id = 'lesson-files' and
    (
      public.is_lesson_owner((storage.foldername(name))[1]::uuid, auth.uid()) or
      public.is_lesson_rw_member((storage.foldername(name))[1]::uuid, auth.uid())
    )
  );

create policy "lesson-files: members can update"
  on storage.objects for update
  using (
    bucket_id = 'lesson-files' and
    (
      public.is_lesson_owner((storage.foldername(name))[1]::uuid, auth.uid()) or
      public.is_lesson_rw_member((storage.foldername(name))[1]::uuid, auth.uid())
    )
  );

create policy "lesson-files: members can delete"
  on storage.objects for delete
  using (
    bucket_id = 'lesson-files' and
    (
      public.is_lesson_owner((storage.foldername(name))[1]::uuid, auth.uid()) or
      public.is_lesson_rw_member((storage.foldername(name))[1]::uuid, auth.uid())
    )
  );
