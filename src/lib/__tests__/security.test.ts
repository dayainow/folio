import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearSecurityAudit,
  listSecurityAudit,
  recordSecurityAudit,
} from '@/lib/security-audit'
import { canAccessResource } from '@/lib/rbac'
import { removeResourceAcl, setResourceAcl, listResourceAcl } from '@/lib/resource-acl'
import {
  createCsrfToken,
  parseCookieHeader,
  verifyCsrfTokens,
  CSRF_COOKIE,
  CSRF_HEADER,
} from '@/lib/csrf'
import { listFolioLocalKeys } from '@/lib/gdpr'

describe('security-audit', () => {
  beforeEach(() => {
    localStorage.clear()
    clearSecurityAudit()
  })

  it('records CRUD and auth events', () => {
    recordSecurityAudit({
      userId: 'u1',
      action: 'crud.update',
      resource: 'doc:1',
      detail: 'title',
    })
    recordSecurityAudit({ userId: 'u1', action: 'auth.login' })
    const logs = listSecurityAudit()
    expect(logs.length).toBeGreaterThanOrEqual(2)
    expect(logs.some((l) => l.action === 'crud.update')).toBe(true)
  })
})

describe('rbac + resource acl', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('allows owner always', () => {
    expect(
      canAccessResource({
        kind: 'doc',
        resourceId: 'd1',
        action: 'admin',
        ctx: { userId: 'u1', ownerId: 'u1' },
      }),
    ).toBe(true)
  })

  it('enforces project isolation', () => {
    expect(
      canAccessResource({
        kind: 'doc',
        resourceId: 'd1',
        action: 'read',
        ctx: {
          userId: 'u1',
          teamRole: 'editor',
          projectId: 'p1',
          resourceProjectId: 'p2',
        },
      }),
    ).toBe(false)
  })

  it('uses resource ACL over team role', () => {
    setResourceAcl({
      kind: 'doc',
      resourceId: 'd1',
      subject: 'u1',
      access: 'view',
    })
    expect(
      canAccessResource({
        kind: 'doc',
        resourceId: 'd1',
        action: 'write',
        ctx: { userId: 'u1', teamRole: 'editor' },
      }),
    ).toBe(false)
    expect(
      canAccessResource({
        kind: 'doc',
        resourceId: 'd1',
        action: 'read',
        ctx: { userId: 'u1', teamRole: 'guest' },
      }),
    ).toBe(true)
    const rows = listResourceAcl('doc', 'd1')
    for (const r of rows) removeResourceAcl(r.id)
  })
})

describe('csrf', () => {
  it('parses cookie and verifies header match', () => {
    const token = createCsrfToken()
    expect(token.length).toBeGreaterThan(8)
    expect(parseCookieHeader(`${CSRF_COOKIE}=${encodeURIComponent(token)}`, CSRF_COOKIE)).toBe(
      token,
    )

    // Fetch Request는 Cookie를 forbidden header로 막아 헤더 기반 검증이 불가 → 토큰 API 직접 검증
    expect(verifyCsrfTokens('POST', token, token).ok).toBe(true)
    expect(verifyCsrfTokens('POST', token, 'nope').ok).toBe(false)
    expect(verifyCsrfTokens('POST', null, token).reason).toBe('missing_csrf')
    expect(verifyCsrfTokens('GET', null, null).ok).toBe(true)
    expect(CSRF_HEADER).toBe('x-folio-csrf')
  })
})

describe('gdpr local keys', () => {
  beforeEach(() => localStorage.clear())

  it('lists folio-prefixed keys', () => {
    localStorage.setItem('folio_theme', 'dark')
    localStorage.setItem('workspace_docs', '[]')
    localStorage.setItem('other', '1')
    const keys = listFolioLocalKeys()
    expect(keys).toContain('folio_theme')
    expect(keys).toContain('workspace_docs')
    expect(keys).not.toContain('other')
  })
})
