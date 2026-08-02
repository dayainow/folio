-- P41 실시간 협업 (선택)
-- Presence/Yjs 동기화는 Supabase Realtime Broadcast·Presence 채널을 사용하므로
-- 별도 테이블 없이도 동작합니다. 아래는 주석·활동의 클라우드 보관용(옵션).

-- 주석
create table if not exists public.doc_comments (
  id uuid primary key default gen_random_uuid(),
  target_kind text not null check (target_kind in ('doc', 'journal')),
  target_id text not null,
  body text not null,
  mentions text[] not null default '{}',
  author_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null,
  resolved boolean not null default false,
  anchor_start int,
  anchor_end int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists doc_comments_target_idx
  on public.doc_comments (target_kind, target_id, created_at desc);

alter table public.doc_comments enable row level security;

create policy "doc_comments_select_authenticated"
  on public.doc_comments for select
  to authenticated
  using (true);

create policy "doc_comments_insert_own"
  on public.doc_comments for insert
  to authenticated
  with check (auth.uid() = author_id);

create policy "doc_comments_update_own"
  on public.doc_comments for update
  to authenticated
  using (auth.uid() = author_id);

create policy "doc_comments_delete_own"
  on public.doc_comments for delete
  to authenticated
  using (auth.uid() = author_id);

-- 활동 스트림 (팀 스코프 선택)
create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams (id) on delete cascade,
  type text not null,
  actor_id uuid not null references auth.users (id) on delete cascade,
  actor_name text not null,
  target_kind text,
  target_id text,
  summary text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_events_created_idx
  on public.activity_events (created_at desc);

create index if not exists activity_events_team_idx
  on public.activity_events (team_id, created_at desc);

alter table public.activity_events enable row level security;

create policy "activity_select_authenticated"
  on public.activity_events for select
  to authenticated
  using (true);

create policy "activity_insert_own"
  on public.activity_events for insert
  to authenticated
  with check (auth.uid() = actor_id);

-- Realtime: Dashboard → Replication 에서
--   broadcast / presence 는 채널 API로 동작 (테이블 publication 불필요)
-- 주석·활동을 Realtime postgres_changes 로 받을 경우:
--   alter publication supabase_realtime add table public.doc_comments;
--   alter publication supabase_realtime add table public.activity_events;
