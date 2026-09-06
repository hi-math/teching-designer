-- ============================================================
-- 누락된 DELETE RLS 정책 추가
--
-- 증상 1: 의견묻기를 삭제하면 화면에서는 사라지는데, 세션을 끝내고 다시
--         들어오면 되살아난다.
-- 증상 2: 스냅샷을 "최대 10개 유지"하도록 정리하는 코드가 있는데도
--         lesson_snapshots 행이 계속 쌓인다.
--
-- 원인: 두 테이블 모두 RLS 가 켜져 있는데 select / insert (/update) 정책만 있고
--       delete 정책이 없었다. Postgres 는 RLS 가 켜진 테이블에서 해당 명령의
--       정책이 하나도 없으면 그 명령을 모든 행에 대해 거부한다. 이때 DELETE 는
--       에러가 아니라 "0 행 삭제 성공"으로 돌아오기 때문에, 클라이언트는 성공한
--       줄 알고 로컬 상태만 지운다. 그래서 새로 고치면 데이터가 되돌아온다.
--
-- 읽기/쓰기 정책과 같은 기준(소유자 또는 rw 멤버)을 적용한다.
-- ============================================================

-- ── activity_contents: 의견묻기 질문/응답 행 삭제 ───────────────
drop policy if exists "activity_contents: members can delete" on public.activity_contents;

create policy "activity_contents: members can delete"
  on public.activity_contents for delete
  using (
    public.is_lesson_owner(lesson_id, auth.uid()) or
    public.is_lesson_rw_member(lesson_id, auth.uid())
  );

-- ── lesson_snapshots: 오래된 버전 정리 ──────────────────────────
drop policy if exists "lesson_snapshots: members can delete" on public.lesson_snapshots;

create policy "lesson_snapshots: members can delete"
  on public.lesson_snapshots for delete
  using (
    public.is_lesson_owner(lesson_id, auth.uid()) or
    public.is_lesson_rw_member(lesson_id, auth.uid())
  );

-- 주의: ai_messages / team_messages / activity_versions / profiles 에도 delete
-- 정책이 없지만, 현재 애플리케이션 코드에서 이들을 하드 삭제하는 경로가 없다
-- (team_messages 는 deleted_at 소프트 삭제를 쓴다). 실제로 필요해질 때
-- 별도 마이그레이션으로 추가한다 — 쓰지 않는 권한을 미리 열어 두지 않는다.
