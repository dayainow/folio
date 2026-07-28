-- Folio Phase 3 / P10 — 팀 초대·공유
-- Supabase SQL Editor에서 실행하세요.
-- 선행: docs/supabase-schema.sql (또는 migration) 적용 완료

create extension if not exists "pgcrypto";

-- teams ------------------------------------------------------------------
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists teams_owner_id_idx on public.teams (owner_id);

-- team_members -----------------------------------------------------------
create table if not exists public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create index if not exists team_members_user_id_idx on public.team_members (user_id);

-- invitations ------------------------------------------------------------
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  email text not null,
  role text not null default 'member'
    check (role in ('admin', 'member')),
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  invited_by uuid references auth.users (id) on delete set null
);

create index if not exists invitations_team_id_idx on public.invitations (team_id);
create index if not exists invitations_email_idx on public.invitations (lower(email));
create index if not exists invitations_token_idx on public.invitations (token);

-- shared_docs ------------------------------------------------------------
create table if not exists public.shared_docs (
  team_id uuid not null references public.teams (id) on delete cascade,
  doc_id uuid not null references public.docs (id) on delete cascade,
  permission text not null default 'view'
    check (permission in ('view', 'edit')),
  shared_by uuid references auth.users (id) on delete set null,
  shared_at timestamptz not null default now(),
  primary key (team_id, doc_id)
);

create index if not exists shared_docs_doc_id_idx on public.shared_docs (doc_id);

-- shared_boards ----------------------------------------------------------
create table if not exists public.shared_boards (
  team_id uuid not null references public.teams (id) on delete cascade,
  board_id uuid not null references public.boards (id) on delete cascade,
  permission text not null default 'view'
    check (permission in ('view', 'edit')),
  shared_by uuid references auth.users (id) on delete set null,
  shared_at timestamptz not null default now(),
  primary key (team_id, board_id)
);

create index if not exists shared_boards_board_id_idx on public.shared_boards (board_id);

-- helpers (security definer — RLS 재귀 방지) -----------------------------
create or replace function public.is_team_member(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where team_id = tid and user_id = auth.uid()
  );
$$;

create or replace function public.team_member_role(tid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.team_members
  where team_id = tid and user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_team_admin(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where team_id = tid
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

-- 초대 수락 RPC ----------------------------------------------------------
create or replace function public.accept_team_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invitations%rowtype;
  uid uuid := auth.uid();
  uemail text;
begin
  if uid is null then
    raise exception 'authentication required';
  end if;

  select email into uemail from auth.users where id = uid;

  select * into inv
  from public.invitations
  where token = invite_token
    and status = 'pending'
    and expires_at > now()
  for update;

  if not found then
    raise exception 'invalid or expired invitation';
  end if;

  if lower(inv.email) <> lower(coalesce(uemail, '')) then
    raise exception 'invitation email does not match signed-in user';
  end if;

  insert into public.team_members (team_id, user_id, role)
  values (inv.team_id, uid, inv.role)
  on conflict (team_id, user_id) do update
    set role = excluded.role;

  update public.invitations
  set status = 'accepted'
  where id = inv.id;

  return inv.team_id;
end;
$$;

grant execute on function public.accept_team_invite(text) to authenticated;
grant execute on function public.is_team_member(uuid) to authenticated;
grant execute on function public.is_team_admin(uuid) to authenticated;
grant execute on function public.team_member_role(uuid) to authenticated;

-- RLS --------------------------------------------------------------------
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.invitations enable row level security;
alter table public.shared_docs enable row level security;
alter table public.shared_boards enable row level security;

-- teams
drop policy if exists "teams_select_member" on public.teams;
create policy "teams_select_member"
  on public.teams for select to authenticated
  using (public.is_team_member(id) or owner_id = auth.uid());

drop policy if exists "teams_insert_auth" on public.teams;
create policy "teams_insert_auth"
  on public.teams for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "teams_update_admin" on public.teams;
create policy "teams_update_admin"
  on public.teams for update to authenticated
  using (public.is_team_admin(id))
  with check (public.is_team_admin(id));

drop policy if exists "teams_delete_owner" on public.teams;
create policy "teams_delete_owner"
  on public.teams for delete to authenticated
  using (owner_id = auth.uid());

-- team_members
drop policy if exists "team_members_select" on public.team_members;
create policy "team_members_select"
  on public.team_members for select to authenticated
  using (public.is_team_member(team_id) or user_id = auth.uid());

drop policy if exists "team_members_insert_admin" on public.team_members;
create policy "team_members_insert_admin"
  on public.team_members for insert to authenticated
  with check (
    public.is_team_admin(team_id)
    or (
      -- 팀 생성 직후 owner 자기 자신 등록
      user_id = auth.uid()
      and role = 'owner'
      and exists (
        select 1 from public.teams t
        where t.id = team_id and t.owner_id = auth.uid()
      )
    )
  );

drop policy if exists "team_members_update_admin" on public.team_members;
create policy "team_members_update_admin"
  on public.team_members for update to authenticated
  using (public.is_team_admin(team_id))
  with check (public.is_team_admin(team_id));

drop policy if exists "team_members_delete" on public.team_members;
create policy "team_members_delete"
  on public.team_members for delete to authenticated
  using (
    public.is_team_admin(team_id)
    or user_id = auth.uid()
  );

-- invitations
drop policy if exists "invitations_select" on public.invitations;
create policy "invitations_select"
  on public.invitations for select to authenticated
  using (
    public.is_team_member(team_id)
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "invitations_insert_admin" on public.invitations;
create policy "invitations_insert_admin"
  on public.invitations for insert to authenticated
  with check (public.is_team_admin(team_id) and invited_by = auth.uid());

drop policy if exists "invitations_update_admin" on public.invitations;
create policy "invitations_update_admin"
  on public.invitations for update to authenticated
  using (public.is_team_admin(team_id))
  with check (public.is_team_admin(team_id));

drop policy if exists "invitations_delete_admin" on public.invitations;
create policy "invitations_delete_admin"
  on public.invitations for delete to authenticated
  using (public.is_team_admin(team_id));

-- shared_docs
drop policy if exists "shared_docs_select" on public.shared_docs;
create policy "shared_docs_select"
  on public.shared_docs for select to authenticated
  using (public.is_team_member(team_id));

drop policy if exists "shared_docs_insert" on public.shared_docs;
create policy "shared_docs_insert"
  on public.shared_docs for insert to authenticated
  with check (
    public.is_team_admin(team_id)
    and exists (
      select 1 from public.docs d
      where d.id = doc_id and d.user_id = auth.uid()
    )
  );

drop policy if exists "shared_docs_update" on public.shared_docs;
create policy "shared_docs_update"
  on public.shared_docs for update to authenticated
  using (public.is_team_admin(team_id))
  with check (public.is_team_admin(team_id));

drop policy if exists "shared_docs_delete" on public.shared_docs;
create policy "shared_docs_delete"
  on public.shared_docs for delete to authenticated
  using (public.is_team_admin(team_id));

-- shared_boards
drop policy if exists "shared_boards_select" on public.shared_boards;
create policy "shared_boards_select"
  on public.shared_boards for select to authenticated
  using (public.is_team_member(team_id));

drop policy if exists "shared_boards_insert" on public.shared_boards;
create policy "shared_boards_insert"
  on public.shared_boards for insert to authenticated
  with check (
    public.is_team_admin(team_id)
    and exists (
      select 1 from public.boards b
      where b.id = board_id and b.user_id = auth.uid()
    )
  );

drop policy if exists "shared_boards_update" on public.shared_boards;
create policy "shared_boards_update"
  on public.shared_boards for update to authenticated
  using (public.is_team_admin(team_id))
  with check (public.is_team_admin(team_id));

drop policy if exists "shared_boards_delete" on public.shared_boards;
create policy "shared_boards_delete"
  on public.shared_boards for delete to authenticated
  using (public.is_team_admin(team_id));

-- 공유된 docs/boards 읽기 확장 (기존 own 정책과 OR) ----------------------
drop policy if exists "docs_select_shared" on public.docs;
create policy "docs_select_shared"
  on public.docs for select to authenticated
  using (
    exists (
      select 1 from public.shared_docs sd
      where sd.doc_id = docs.id
        and public.is_team_member(sd.team_id)
    )
  );

drop policy if exists "docs_update_shared" on public.docs;
create policy "docs_update_shared"
  on public.docs for update to authenticated
  using (
    exists (
      select 1 from public.shared_docs sd
      where sd.doc_id = docs.id
        and sd.permission = 'edit'
        and public.is_team_member(sd.team_id)
    )
  )
  with check (
    exists (
      select 1 from public.shared_docs sd
      where sd.doc_id = docs.id
        and sd.permission = 'edit'
        and public.is_team_member(sd.team_id)
    )
  );

drop policy if exists "boards_select_shared" on public.boards;
create policy "boards_select_shared"
  on public.boards for select to authenticated
  using (
    exists (
      select 1 from public.shared_boards sb
      where sb.board_id = boards.id
        and public.is_team_member(sb.team_id)
    )
  );

drop policy if exists "boards_update_shared" on public.boards;
create policy "boards_update_shared"
  on public.boards for update to authenticated
  using (
    exists (
      select 1 from public.shared_boards sb
      where sb.board_id = boards.id
        and sb.permission = 'edit'
        and public.is_team_member(sb.team_id)
    )
  )
  with check (
    exists (
      select 1 from public.shared_boards sb
      where sb.board_id = boards.id
        and sb.permission = 'edit'
        and public.is_team_member(sb.team_id)
    )
  );
