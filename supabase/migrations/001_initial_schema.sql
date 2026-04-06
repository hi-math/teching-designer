-- ============================================================
-- Minerva — Initial Schema Migration (v2)
-- 실행 순서: 000_reset.sql → 이 파일 → 002_profiles.sql → 003_last_accessed.sql
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- STEP 1: 테이블 생성 (외래키 순서대로)
-- ──────────────────────────────────────────────────────────────

create table public.folders (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  parent_id   uuid references public.folders(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table public.lessons (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  title           text not null default '새 수업설계',
  subject         text,
  folder_id       uuid references public.folders(id) on delete set null,
  status          text not null default 'ongoing'
                    check (status in ('ongoing', 'ended')),
  current_phase   text not null default 'T'
                    check (current_phase in ('T','A','Ds','DI','E')),
  bookmarked      boolean not null default false,
  last_accessed_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create table public.lesson_members (
  id          uuid primary key default gen_random_uuid(),
  lesson_id   uuid not null references public.lessons(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  -- 'owner' = 팀장, 'member' = 팀원, 'viewer' = 참고
  role        text not null default 'member'
                check (role in ('owner','member','viewer')),
  joined_at   timestamptz not null default now(),
  unique (lesson_id, user_id)
);

create table public.activity_contents (
  id              uuid primary key default gen_random_uuid(),
  lesson_id       uuid not null references public.lessons(id) on delete cascade,
  activity_code   text not null,
  content         jsonb not null default '{}',
  version_number  int  not null default 1,
  updated_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (lesson_id, activity_code)
);

create table public.activity_versions (
  id              uuid primary key default gen_random_uuid(),
  lesson_id       uuid not null references public.lessons(id) on delete cascade,
  activity_code   text not null,
  content         jsonb not null,
  version_number  int  not null,
  saved_by        uuid references auth.users(id) on delete set null,
  note            text,
  saved_at        timestamptz not null default now()
);

create table public.team_messages (
  id          uuid primary key default gen_random_uuid(),
  lesson_id   uuid not null references public.lessons(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  content     text not null,
  reply_to    uuid references public.team_messages(id) on delete set null,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table public.ai_messages (
  id                    uuid primary key default gen_random_uuid(),
  lesson_id             uuid not null references public.lessons(id) on delete cascade,
  user_id               uuid not null references auth.users(id) on delete cascade,
  role                  text not null check (role in ('user','assistant')),
  content               text not null,
  context_activity_code text,
  created_at            timestamptz not null default now()
);


-- ──────────────────────────────────────────────────────────────
-- STEP 2: 인덱스
-- ──────────────────────────────────────────────────────────────

create index activity_versions_lookup
  on public.activity_versions (lesson_id, activity_code, version_number desc);

create index team_messages_lesson_time
  on public.team_messages (lesson_id, created_at);

create index ai_messages_lesson_user
  on public.ai_messages (lesson_id, user_id, created_at);


-- ──────────────────────────────────────────────────────────────
-- STEP 3: RLS 활성화
-- ──────────────────────────────────────────────────────────────

alter table public.folders           enable row level security;
alter table public.lessons            enable row level security;
alter table public.lesson_members     enable row level security;
alter table public.activity_contents  enable row level security;
alter table public.activity_versions  enable row level security;
alter table public.team_messages      enable row level security;
alter table public.ai_messages        enable row level security;


-- ──────────────────────────────────────────────────────────────
-- STEP 4: RLS 정책
-- (lesson_members가 이미 존재하므로 lessons 정책에서 참조 가능)
-- ──────────────────────────────────────────────────────────────

-- folders
create policy "folders: owner full access"
  on public.folders for all
  using  (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- lessons: 소유자
create policy "lessons: owner full access"
  on public.lessons for all
  using  (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- lessons: 팀원 읽기 (lesson_members 생성 후이므로 참조 가능)
create policy "lessons: members can read"
  on public.lessons for select
  using (
    deleted_at is null and
    exists (
      select 1 from public.lesson_members
      where lesson_id = lessons.id and user_id = auth.uid()
    )
  );

-- lessons: 팀원 업데이트
create policy "lessons: members can update"
  on public.lessons for update
  using (
    deleted_at is null and
    exists (
      select 1 from public.lesson_members
      where lesson_id = lessons.id
        and user_id = auth.uid()
        and role in ('owner','member')
    )
  );

-- lesson_members: 같은 lesson 멤버끼리 열람
create policy "lesson_members: members can read"
  on public.lesson_members for select
  using (
    user_id = auth.uid() or
    exists (
      select 1 from public.lesson_members m2
      where m2.lesson_id = lesson_members.lesson_id
        and m2.user_id = auth.uid()
    )
  );

-- lesson_members: lesson 소유자만 관리
create policy "lesson_members: owner can manage"
  on public.lesson_members for all
  using (
    exists (
      select 1 from public.lessons
      where id = lesson_members.lesson_id and owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.lessons
      where id = lesson_members.lesson_id and owner_id = auth.uid()
    )
  );

-- activity_contents
create policy "activity_contents: members can read"
  on public.activity_contents for select
  using (
    exists (select 1 from public.lessons where id = activity_contents.lesson_id and owner_id = auth.uid()) or
    exists (select 1 from public.lesson_members where lesson_id = activity_contents.lesson_id and user_id = auth.uid())
  );

create policy "activity_contents: members can write"
  on public.activity_contents for insert
  with check (
    exists (select 1 from public.lessons where id = activity_contents.lesson_id and owner_id = auth.uid()) or
    exists (
      select 1 from public.lesson_members
      where lesson_id = activity_contents.lesson_id and user_id = auth.uid() and role in ('owner','member')
    )
  );

create policy "activity_contents: members can update"
  on public.activity_contents for update
  using (
    exists (select 1 from public.lessons where id = activity_contents.lesson_id and owner_id = auth.uid()) or
    exists (
      select 1 from public.lesson_members
      where lesson_id = activity_contents.lesson_id and user_id = auth.uid() and role in ('owner','member')
    )
  );

-- activity_versions
create policy "activity_versions: members can read"
  on public.activity_versions for select
  using (
    exists (select 1 from public.lessons where id = activity_versions.lesson_id and owner_id = auth.uid()) or
    exists (select 1 from public.lesson_members where lesson_id = activity_versions.lesson_id and user_id = auth.uid())
  );

create policy "activity_versions: members can insert"
  on public.activity_versions for insert
  with check (
    exists (select 1 from public.lessons where id = activity_versions.lesson_id and owner_id = auth.uid()) or
    exists (
      select 1 from public.lesson_members
      where lesson_id = activity_versions.lesson_id and user_id = auth.uid() and role in ('owner','member')
    )
  );

-- team_messages
create policy "team_messages: members can read"
  on public.team_messages for select
  using (
    exists (select 1 from public.lessons where id = team_messages.lesson_id and owner_id = auth.uid()) or
    exists (select 1 from public.lesson_members where lesson_id = team_messages.lesson_id and user_id = auth.uid())
  );

create policy "team_messages: members can send"
  on public.team_messages for insert
  with check (
    user_id = auth.uid() and (
      exists (select 1 from public.lessons where id = team_messages.lesson_id and owner_id = auth.uid()) or
      exists (
        select 1 from public.lesson_members
        where lesson_id = team_messages.lesson_id and user_id = auth.uid() and role in ('owner','member')
      )
    )
  );

create policy "team_messages: user can soft-delete own"
  on public.team_messages for update
  using (user_id = auth.uid());

-- ai_messages
create policy "ai_messages: user can read own"
  on public.ai_messages for select
  using (user_id = auth.uid());

create policy "ai_messages: user can insert"
  on public.ai_messages for insert
  with check (user_id = auth.uid());


-- ──────────────────────────────────────────────────────────────
-- STEP 5: 함수 & 트리거
-- ──────────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger folders_updated_at
  before update on public.folders
  for each row execute function public.set_updated_at();

create trigger lessons_updated_at
  before update on public.lessons
  for each row execute function public.set_updated_at();

create trigger activity_contents_updated_at
  before update on public.activity_contents
  for each row execute function public.set_updated_at();

-- lesson 생성 시 소유자를 lesson_members에 자동 등록
create or replace function public.add_lesson_owner()
returns trigger language plpgsql security definer as $$
begin
  insert into public.lesson_members (lesson_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger lessons_add_owner
  after insert on public.lessons
  for each row execute function public.add_lesson_owner();
