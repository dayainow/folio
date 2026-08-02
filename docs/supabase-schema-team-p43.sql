-- Folio P43 — 팀 역할 확장 (editor / viewer) + 초대 만료 커스텀
-- 적용: Supabase SQL Editor에서 실행 (기존 P10 스키마 이후)

-- team_members.role: member 유지(레거시) + editor/viewer 추가
alter table public.team_members
  drop constraint if exists team_members_role_check;

alter table public.team_members
  add constraint team_members_role_check
  check (role in ('owner', 'admin', 'editor', 'viewer', 'member'));

-- invitations.role
alter table public.invitations
  drop constraint if exists invitations_role_check;

alter table public.invitations
  add constraint invitations_role_check
  check (role in ('admin', 'editor', 'viewer', 'member'));

-- 레거시 member → editor 권장 (선택)
-- update public.team_members set role = 'editor' where role = 'member';
-- update public.invitations set role = 'editor' where role = 'member' and status = 'pending';

comment on column public.team_members.role is 'P43: owner | admin | editor | viewer (member=legacy editor)';
comment on column public.invitations.expires_at is 'P43: 초대 링크 만료 (기본 7일, 클라이언트에서 커스텀)';
