-- Folio P6: multi-user isolation migration
-- 기존 P4-2 스키마에 user_id가 없거나 RLS를 다시 맞춰야 할 때 실행하세요.
-- Supabase SQL Editor에서 실행.

-- 1) user_id 컬럼 추가 (이미 있으면 테이블은 스킵)
alter table if exists public.journals
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table if exists public.docs
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table if exists public.boards
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

-- 2) 인덱스
create index if not exists journals_user_id_idx on public.journals (user_id);
create index if not exists docs_user_id_idx on public.docs (user_id);
create index if not exists boards_user_id_idx on public.boards (user_id);

-- journals: (user_id, date) 유니크 (컬럼이 준비된 뒤)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'journals_user_id_date_key'
  ) then
    alter table public.journals
      add constraint journals_user_id_date_key unique (user_id, date);
  end if;
exception
  when others then
    -- 기존 unique 이름/구성이 다를 수 있음 — 수동 확인
    null;
end $$;

-- 3) RLS 재적용
alter table public.journals enable row level security;
alter table public.docs enable row level security;
alter table public.boards enable row level security;

-- journals policies
drop policy if exists "journals_select_own" on public.journals;
drop policy if exists "journals_insert_own" on public.journals;
drop policy if exists "journals_update_own" on public.journals;
drop policy if exists "journals_delete_own" on public.journals;

create policy "journals_select_own"
  on public.journals for select
  to authenticated
  using (auth.uid() = user_id);

create policy "journals_insert_own"
  on public.journals for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "journals_update_own"
  on public.journals for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "journals_delete_own"
  on public.journals for delete
  to authenticated
  using (auth.uid() = user_id);

-- docs policies
drop policy if exists "docs_select_own" on public.docs;
drop policy if exists "docs_insert_own" on public.docs;
drop policy if exists "docs_update_own" on public.docs;
drop policy if exists "docs_delete_own" on public.docs;

create policy "docs_select_own"
  on public.docs for select
  to authenticated
  using (auth.uid() = user_id);

create policy "docs_insert_own"
  on public.docs for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "docs_update_own"
  on public.docs for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "docs_delete_own"
  on public.docs for delete
  to authenticated
  using (auth.uid() = user_id);

-- boards policies
drop policy if exists "boards_select_own" on public.boards;
drop policy if exists "boards_insert_own" on public.boards;
drop policy if exists "boards_update_own" on public.boards;
drop policy if exists "boards_delete_own" on public.boards;

create policy "boards_select_own"
  on public.boards for select
  to authenticated
  using (auth.uid() = user_id);

create policy "boards_insert_own"
  on public.boards for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "boards_update_own"
  on public.boards for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "boards_delete_own"
  on public.boards for delete
  to authenticated
  using (auth.uid() = user_id);

-- 4) (선택) 로그인 사용자가 소유자 없는(guest) 레코드를 한 번 인수
--    앱의 migrateGuestOrphanRows()와 동일한 의도. 필요 시 주석 해제 후 user uuid 교체.
-- update public.journals set user_id = '<YOUR_USER_UUID>' where user_id is null;
-- update public.docs set user_id = '<YOUR_USER_UUID>' where user_id is null;
-- update public.boards set user_id = '<YOUR_USER_UUID>' where user_id is null;
