/**
 * P49 — 통합 RBAC · 리소스 ACL · 팀/프로젝트 격리
 */
'use client'

import {
  accessAtLeast,
  resolveResourceAccess,
  type ResourceAccess,
  type ResourceKind,
} from '@/lib/resource-acl'
import {
  canAdminWithRole,
  canCommentWithRole,
  canEditWithRole,
  normalizeTeamRole,
  type TeamRole,
} from '@/lib/team'

export type PermissionAction = 'read' | 'write' | 'admin' | 'owner' | 'comment'

export type AccessContext = {
  userId: string
  email?: string | null
  /** 활성 팀 역할 */
  teamRole?: TeamRole | string | null
  teamId?: string | null
  /** 리소스 소유자 */
  ownerId?: string | null
  /** 프로젝트 격리 키 (팀/워크스페이스) */
  projectId?: string | null
  resourceProjectId?: string | null
}

const ACTION_TO_ACCESS: Record<PermissionAction, ResourceAccess> = {
  read: 'view',
  comment: 'comment',
  write: 'edit',
  admin: 'admin',
  owner: 'admin',
}

/**
 * 팀 역할 → 기본 권한
 * guest: read · viewer: read+comment · editor: write · admin/owner: admin
 */
export function roleGrants(role: TeamRole | string | null | undefined, action: PermissionAction): boolean {
  if (!role) return false
  if (action === 'owner') return normalizeTeamRole(role) === 'owner'
  if (action === 'admin') return canAdminWithRole(role)
  if (action === 'write') return canEditWithRole(role)
  if (action === 'comment') return canCommentWithRole(role)
  // read
  return true // 팀 멤버면 읽기 (guest 포함)
}

/** 프로젝트 격리 — projectId가 다르면 거부 */
export function assertProjectIsolation(ctx: AccessContext): boolean {
  if (!ctx.projectId || !ctx.resourceProjectId) return true
  return ctx.projectId === ctx.resourceProjectId
}

/**
 * 통합 권한 검사:
 * 1) 소유자 → 전부 허용
 * 2) 프로젝트 격리
 * 3) 리소스 ACL (있으면 우선)
 * 4) 팀 역할 폴백
 */
export function canAccessResource(input: {
  kind: ResourceKind
  resourceId: string
  action: PermissionAction
  ctx: AccessContext
}): boolean {
  const { kind, resourceId, action, ctx } = input

  if (!assertProjectIsolation(ctx)) return false

  if (ctx.ownerId && ctx.ownerId === ctx.userId) return true

  const subjects = [
    ctx.userId,
    ctx.email ?? '',
    ctx.teamId ? `team:${ctx.teamId}` : '',
    'guest',
  ].filter(Boolean)

  const acl = resolveResourceAccess(kind, resourceId, subjects)
  if (acl) {
    return accessAtLeast(acl, ACTION_TO_ACCESS[action])
  }

  return roleGrants(ctx.teamRole, action)
}

export function requireAccess(input: Parameters<typeof canAccessResource>[0]): void {
  if (!canAccessResource(input)) {
    throw new Error(`권한 없음: ${input.action} on ${input.kind}:${input.resourceId}`)
  }
}
