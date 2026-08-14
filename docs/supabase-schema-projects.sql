-- Folio project hub schema
-- Supabase SQL Editor에서 1회 실행하세요.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text not null default '',
  status text not null default 'active'
    check (status in ('planned', 'active', 'on_hold', 'completed')),
  color text not null default 'teal',
  start_date date,
  due_date date,
  journal_keys text[] not null default '{}',
  doc_ids uuid[] not null default '{}',
  task_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_user_id_idx on public.projects (user_id);
create index if not exists projects_status_idx on public.projects (status);

alter table public.projects enable row level security;

drop policy if exists "projects_select_own" on public.projects;
drop policy if exists "projects_insert_own" on public.projects;
drop policy if exists "projects_update_own" on public.projects;
drop policy if exists "projects_delete_own" on public.projects;

create policy "projects_select_own" on public.projects
  for select to authenticated using (auth.uid() = user_id);
create policy "projects_insert_own" on public.projects
  for insert to authenticated with check (auth.uid() = user_id);
create policy "projects_update_own" on public.projects
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "projects_delete_own" on public.projects
  for delete to authenticated using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();
