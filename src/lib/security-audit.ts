/**
 * P49 — 보안 감사 로그 (CRUD · auth · ACL · GDPR)
 * localStorage 보관 · 저장 관측 audit-log 와 별도
 */
'use client'

export type SecurityAuditAction =
  | 'auth.login'
  | 'auth.logout'
  | 'auth.mfa'
  | 'auth.sso'
  | 'auth.session_revoke'
  | 'crud.create'
  | 'crud.read'
  | 'crud.update'
  | 'crud.delete'
  | 'acl.grant'
  | 'acl.revoke'
  | 'team.invite'
  | 'team.role'
  | 'export'
  | 'gdpr.delete'
  | 'gdpr.anonymize'
  | 'security.scan'

export type SecurityAuditEntry = {
  id: string
  ts: string
  userId: string
  action: SecurityAuditAction
  resource?: string
  detail?: string
  ipHint?: string
  ok: boolean
}

const KEY = 'folio_security_audit_v1'
const EVENT = 'folio-security-audit'
const MAX = 3000
const RETENTION_DAYS = 90

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function prune(entries: SecurityAuditEntry[]): SecurityAuditEntry[] {
  const cutoff = Date.now() - RETENTION_DAYS * 86400_000
  return entries
    .filter((e) => {
      const t = Date.parse(e.ts)
      return Number.isFinite(t) && t >= cutoff
    })
    .slice(-MAX)
}

function readAll(): SecurityAuditEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SecurityAuditEntry[]
    return Array.isArray(parsed) ? prune(parsed) : []
  } catch {
    return []
  }
}

function writeAll(entries: SecurityAuditEntry[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(KEY, JSON.stringify(prune(entries)))
    window.dispatchEvent(new CustomEvent(EVENT))
  } catch {
    /* ignore */
  }
}

export function listSecurityAudit(limit = 100): SecurityAuditEntry[] {
  return readAll().slice(-limit).reverse()
}

export function clearSecurityAudit(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(KEY)
  window.dispatchEvent(new CustomEvent(EVENT))
}

export function recordSecurityAudit(input: {
  userId?: string | null
  action: SecurityAuditAction
  resource?: string
  detail?: string
  ok?: boolean
}): SecurityAuditEntry {
  const entry: SecurityAuditEntry = {
    id: uid(),
    ts: new Date().toISOString(),
    userId: input.userId?.trim() || 'anonymous',
    action: input.action,
    resource: input.resource,
    detail: input.detail,
    ok: input.ok !== false,
  }
  writeAll([...readAll(), entry])
  return entry
}

export function subscribeSecurityAudit(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) listener()
  }
  window.addEventListener(EVENT, listener)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(EVENT, listener)
    window.removeEventListener('storage', onStorage)
  }
}

export { KEY as SECURITY_AUDIT_KEY, EVENT as SECURITY_AUDIT_EVENT }
