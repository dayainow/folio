'use client';

/**
 * 팀 · 초대 · 문서/보드 공유 (Supabase RLS).
 */
import { requireAuthUser } from '@/lib/supabase';

export type TeamRole = 'owner' | 'admin' | 'editor' | 'viewer' | 'guest' | 'member'
export type SharePermission = 'view' | 'edit'
export type InviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired'

/** UI용 역할 — legacy `member`는 editor로 취급 */
export type TeamRoleUi = 'owner' | 'admin' | 'editor' | 'viewer' | 'guest'

export function normalizeTeamRole(role: TeamRole | string): TeamRoleUi {
  if (
    role === 'owner' ||
    role === 'admin' ||
    role === 'editor' ||
    role === 'viewer' ||
    role === 'guest'
  ) {
    return role
  }
  if (role === 'member') return 'editor'
  return 'viewer'
}

export function canEditWithRole(role: TeamRole | string): boolean {
  const r = normalizeTeamRole(role)
  return r === 'owner' || r === 'admin' || r === 'editor'
}

export function canAdminWithRole(role: TeamRole | string): boolean {
  const r = normalizeTeamRole(role)
  return r === 'owner' || r === 'admin'
}

/** viewer 이상 주석 가능 · guest는 읽기만 */
export function canCommentWithRole(role: TeamRole | string): boolean {
  const r = normalizeTeamRole(role)
  return r === 'owner' || r === 'admin' || r === 'editor' || r === 'viewer'
}

export const TEAM_ROLE_LABELS: Record<TeamRoleUi, string> = {
  owner: 'Owner',
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
  guest: 'Guest',
}

export interface Team {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

export interface TeamMember {
  teamId: string;
  userId: string;
  role: TeamRole;
  joinedAt: string;
  email?: string | null;
}

export interface Invitation {
  id: string;
  teamId: string;
  email: string;
  role: Exclude<TeamRole, 'owner'>;
  token: string;
  status: InviteStatus;
  expiresAt: string;
  createdAt?: string;
}

export interface SharedDoc {
  teamId: string;
  docId: string;
  permission: SharePermission;
  sharedAt: string;
}

export interface SharedBoard {
  teamId: string;
  boardId: string;
  permission: SharePermission;
  sharedAt: string;
}

const ACTIVE_TEAM_KEY = 'folio_active_team';

export function getActiveTeamId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(ACTIVE_TEAM_KEY);
  } catch {
    return null;
  }
}

export function setActiveTeamId(teamId: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (!teamId) localStorage.removeItem(ACTIVE_TEAM_KEY);
    else localStorage.setItem(ACTIVE_TEAM_KEY, teamId);
    window.dispatchEvent(new CustomEvent('folio-active-team'));
  } catch {
    /* ignore */
  }
}

type TeamRow = {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
};

type MemberRow = {
  team_id: string;
  user_id: string;
  role: TeamRole;
  joined_at: string;
};

type InviteRow = {
  id: string;
  team_id: string;
  email: string;
  role: Exclude<TeamRole, 'owner'>;
  token: string;
  status: InviteStatus;
  expires_at: string;
  created_at: string;
};

function rowToTeam(row: TeamRow): Team {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    createdAt: row.created_at,
  };
}

function rowToMember(row: MemberRow): TeamMember {
  return {
    teamId: row.team_id,
    userId: row.user_id,
    role: row.role,
    joinedAt: row.joined_at,
  };
}

function rowToInvite(row: InviteRow): Invitation {
  return {
    id: row.id,
    teamId: row.team_id,
    email: row.email,
    role: row.role,
    token: row.token,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

/** 팀 생성 + owner 멤버 등록 */
export async function createTeam(name: string): Promise<Team> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('팀 이름을 입력하세요.');

  const { supabase, userId } = await requireAuthUser();
  const { data, error } = await supabase
    .from('teams')
    .insert({ name: trimmed, owner_id: userId })
    .select('id, name, owner_id, created_at')
    .single();

  if (error) throw error;

  const { error: memberError } = await supabase.from('team_members').insert({
    team_id: data.id,
    user_id: userId,
    role: 'owner',
  });

  if (memberError) throw memberError;
  return rowToTeam(data as TeamRow);
}

/** 이메일 초대 (admin/owner) — expiresInDays 기본 7일 */
export async function inviteMember(
  teamId: string,
  email: string,
  role: Exclude<TeamRole, 'owner'> = 'editor',
  expiresInDays = 7,
): Promise<Invitation> {
  const normalized = email.trim().toLowerCase()
  if (!normalized.includes('@')) throw new Error('유효한 이메일을 입력하세요.')

  const days = Math.min(90, Math.max(1, Math.floor(expiresInDays)))
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
  // DB: guest/viewer/editor/admin · legacy member
  const dbRole =
    role === 'member' ? 'member' : role === 'guest' ? 'viewer' : role

  const { supabase, userId } = await requireAuthUser()
  const { data, error } = await supabase
    .from('invitations')
    .insert({
      team_id: teamId,
      email: normalized,
      role: dbRole,
      invited_by: userId,
      status: 'pending',
      expires_at: expiresAt,
    })
    .select('id, team_id, email, role, token, status, expires_at, created_at')
    .single()

  if (error) throw error
  const invite = rowToInvite(data as InviteRow)
  // UI에는 요청한 guest 역할 반영 (DB는 viewer로 저장될 수 있음)
  if (role === 'guest') invite.role = 'guest'
  return invite
}

/** 초대 링크 (토큰 기반) */
export function buildInviteLink(token: string): string {
  if (typeof window === 'undefined') return `/?invite=${encodeURIComponent(token)}`
  const url = new URL(window.location.origin)
  url.searchParams.set('invite', token)
  return url.toString()
}

/** 초대 만료 여부 */
export function isInviteExpired(invite: Pick<Invitation, 'expiresAt' | 'status'>): boolean {
  if (invite.status === 'expired') return true
  const t = Date.parse(invite.expiresAt)
  if (Number.isNaN(t)) return false
  return t <= Date.now()
}

/** 멤버 역할 변경 (owner/admin) */
export async function updateMemberRole(
  teamId: string,
  userId: string,
  role: Exclude<TeamRole, 'owner'>,
): Promise<void> {
  const { supabase } = await requireAuthUser()
  const { error } = await supabase
    .from('team_members')
    .update({ role })
    .eq('team_id', teamId)
    .eq('user_id', userId)
  if (error) throw error
}

/** 초대 토큰 수락 (RPC) */
export async function acceptInvite(token: string): Promise<string> {
  let trimmed = token.trim()
  // 전체 초대 링크에서 토큰 추출
  try {
    if (trimmed.includes('invite=')) {
      const u = new URL(trimmed, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
      trimmed = u.searchParams.get('invite')?.trim() || trimmed
    }
  } catch {
    const m = /invite=([^&\s]+)/.exec(trimmed)
    if (m?.[1]) trimmed = decodeURIComponent(m[1])
  }
  if (!trimmed) throw new Error('초대 토큰을 입력하세요.')

  const { supabase } = await requireAuthUser()
  const { data, error } = await supabase.rpc('accept_team_invite', {
    invite_token: trimmed,
  })

  if (error) throw error
  const teamId = data as string
  setActiveTeamId(teamId)
  return teamId
}

/** 내가 속한 팀 목록 */
export async function listTeams(): Promise<Team[]> {
  const { supabase } = await requireAuthUser();
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, owner_id, created_at')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return ((data ?? []) as TeamRow[]).map(rowToTeam);
}

/** 팀 멤버 목록 */
export async function listMembers(teamId: string): Promise<TeamMember[]> {
  const { supabase } = await requireAuthUser();
  const { data, error } = await supabase
    .from('team_members')
    .select('team_id, user_id, role, joined_at')
    .eq('team_id', teamId)
    .order('joined_at', { ascending: true });

  if (error) throw error;
  return ((data ?? []) as MemberRow[]).map(rowToMember);
}

/** 팀의 pending 초대 목록 */
export async function listInvitations(teamId: string): Promise<Invitation[]> {
  const { supabase } = await requireAuthUser();
  const { data, error } = await supabase
    .from('invitations')
    .select('id, team_id, email, role, token, status, expires_at, created_at')
    .eq('team_id', teamId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return ((data ?? []) as InviteRow[]).map(rowToInvite);
}

/** 멤버 제거 (본인 탈퇴 또는 admin) */
export async function removeMember(teamId: string, userId: string): Promise<void> {
  const { supabase } = await requireAuthUser();
  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', userId);

  if (error) throw error;
}

/** 문서 팀 공유 */
export async function shareDoc(
  docId: string,
  teamId: string,
  permission: SharePermission = 'view',
): Promise<SharedDoc> {
  const { supabase, userId } = await requireAuthUser();
  const { data, error } = await supabase
    .from('shared_docs')
    .upsert(
      {
        team_id: teamId,
        doc_id: docId,
        permission,
        shared_by: userId,
      },
      { onConflict: 'team_id,doc_id' },
    )
    .select('team_id, doc_id, permission, shared_at')
    .single();

  if (error) throw error;
  return {
    teamId: data.team_id,
    docId: data.doc_id,
    permission: data.permission,
    sharedAt: data.shared_at,
  };
}

/** 보드 카드 팀 공유 */
export async function shareBoard(
  boardId: string,
  teamId: string,
  permission: SharePermission = 'view',
): Promise<SharedBoard> {
  const { supabase, userId } = await requireAuthUser();
  const { data, error } = await supabase
    .from('shared_boards')
    .upsert(
      {
        team_id: teamId,
        board_id: boardId,
        permission,
        shared_by: userId,
      },
      { onConflict: 'team_id,board_id' },
    )
    .select('team_id, board_id, permission, shared_at')
    .single();

  if (error) throw error;
  return {
    teamId: data.team_id,
    boardId: data.board_id,
    permission: data.permission,
    sharedAt: data.shared_at,
  };
}

/** 팀의 공유 문서 목록 */
export async function listSharedDocs(teamId: string): Promise<SharedDoc[]> {
  const { supabase } = await requireAuthUser();
  const { data, error } = await supabase
    .from('shared_docs')
    .select('team_id, doc_id, permission, shared_at')
    .eq('team_id', teamId);

  if (error) throw error;
  return (data ?? []).map(row => ({
    teamId: row.team_id,
    docId: row.doc_id,
    permission: row.permission,
    sharedAt: row.shared_at,
  }));
}

/** 팀의 공유 보드 목록 */
export async function listSharedBoards(teamId: string): Promise<SharedBoard[]> {
  const { supabase } = await requireAuthUser();
  const { data, error } = await supabase
    .from('shared_boards')
    .select('team_id, board_id, permission, shared_at')
    .eq('team_id', teamId);

  if (error) throw error;
  return (data ?? []).map(row => ({
    teamId: row.team_id,
    boardId: row.board_id,
    permission: row.permission,
    sharedAt: row.shared_at,
  }));
}
