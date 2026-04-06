-- ============================================================
-- Minerva — Profiles Table
-- auth.users와 1:1 연동되는 공개 프로필
-- ============================================================

create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  display_name  text,
  school        text,
  subject       text,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- 본인만 수정 가능
create policy "profiles: owner can update"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- 로그인한 사용자는 모두 읽기 가능 (팀원 이름 표시용)
create policy "profiles: authenticated can read"
  on public.profiles for select
  using (auth.role() = 'authenticated');

-- 본인만 insert (회원가입 시 1회)
create policy "profiles: owner can insert"
  on public.profiles for insert
  with check (id = auth.uid());


-- ──────────────────────────────────────────────────────────────
-- updated_at 트리거
-- ──────────────────────────────────────────────────────────────
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();


-- ──────────────────────────────────────────────────────────────
-- 회원가입 시 profiles 자동 생성 트리거
-- (auth.users에 새 유저가 생성되면 자동 실행)
-- ──────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, display_name, school, subject, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    ),
    new.raw_user_meta_data->>'school',
    new.raw_user_meta_data->>'subject',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ──────────────────────────────────────────────────────────────
-- 기존 유저 백필 (이미 가입된 유저들)
-- ──────────────────────────────────────────────────────────────
insert into public.profiles (id, email, display_name, school, subject, avatar_url)
select
  id,
  email,
  coalesce(
    raw_user_meta_data->>'display_name',
    raw_user_meta_data->>'full_name',
    raw_user_meta_data->>'name'
  ),
  raw_user_meta_data->>'school',
  raw_user_meta_data->>'subject',
  raw_user_meta_data->>'avatar_url'
from auth.users
on conflict (id) do nothing;
