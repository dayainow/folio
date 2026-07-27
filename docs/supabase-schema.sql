-- Folio Supabase schema (P4-2)
-- Supabase SQL Editor에서 실행하세요.

-- Extensions
create extension if not exists "pgcrypto";

-- journals ---------------------------------------------------------------
create table if not exists public.journals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  content text not null default '',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists journals_date_idx on public.journals (date);
create index if not exists journals_created_at_idx on public.journals (created_at);
create index if not exists journals_user_id_idx on public.journals (user_id);

alter table public.journals enable row level security;

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

-- docs -------------------------------------------------------------------
create table if not exists public.docs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  content text not null default '',
  category text not null default 'Dev Guide',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists docs_category_idx on public.docs (category);
create index if not exists docs_created_at_idx on public.docs (created_at);
create index if not exists docs_user_id_idx on public.docs (user_id);

alter table public.docs enable row level security;

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

-- boards (칸반 카드) -----------------------------------------------------
create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  description text not null default '',
  status text not null default 'backlog'
    check (status in ('backlog', 'in_progress', 'review', 'done')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high')),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists boards_status_idx on public.boards (status);
create index if not exists boards_created_at_idx on public.boards (created_at);
create index if not exists boards_user_id_idx on public.boards (user_id);

alter table public.boards enable row level security;

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

-- updated_at 자동 갱신 ----------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists journals_set_updated_at on public.journals;
create trigger journals_set_updated_at
  before update on public.journals
  for each row execute function public.set_updated_at();

drop trigger if exists docs_set_updated_at on public.docs;
create trigger docs_set_updated_at
  before update on public.docs
  for each row execute function public.set_updated_at();

drop trigger if exists boards_set_updated_at on public.boards;
create trigger boards_set_updated_at
  before update on public.boards
  for each row execute function public.set_updated_at();
