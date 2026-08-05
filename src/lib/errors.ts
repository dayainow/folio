/**
 * v2.0/P55 — 일관된 에러 로깅 + 사용자 친화 메시지
 */
import { sanitizeUserFacingMessage } from '@/lib/sanitize'

const FRIENDLY: Array<{ match: RegExp; message: string }> = [
  {
    match: /network|fetch failed|failed to fetch|ECONNREFUSED|ETIMEDOUT/i,
    message: '네트워크에 연결할 수 없습니다. 인터넷 상태를 확인한 뒤 다시 시도해 주세요.',
  },
  {
    match: /unauthorized|401|not authenticated|JWT|session/i,
    message: '로그인이 필요하거나 세션이 만료되었습니다. 다시 로그인해 주세요.',
  },
  {
    match: /forbidden|403|permission|권한/i,
    message: '이 작업을 수행할 권한이 없습니다.',
  },
  {
    match: /not found|404/i,
    message: '요청한 항목을 찾을 수 없습니다.',
  },
  {
    match: /quota|storage|localStorage|exceeded/i,
    message: '저장 공간이 부족합니다. 일부 데이터를 내보내거나 삭제한 뒤 다시 시도해 주세요.',
  },
  {
    match: /timeout/i,
    message: '요청 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.',
  },
  {
    match: /csrf/i,
    message: '보안 검증에 실패했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.',
  },
]

export function logError(scope: string, err: unknown, extra?: Record<string, unknown>): void {
  const message = err instanceof Error ? err.message : String(err)
  const payload = {
    scope,
    message,
    ...(err instanceof Error && err.stack ? { stack: err.stack.split('\n').slice(0, 6) } : {}),
    ...extra,
  }
  console.error(`[Folio:${scope}]`, payload)
}

/** 기술 메시지를 사용자용 한국어 안내로 변환 */
export function friendlyErrorMessage(err: unknown): string | null {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : ''
  if (!raw.trim()) return null
  for (const rule of FRIENDLY) {
    if (rule.match.test(raw)) return rule.message
  }
  return null
}

export function toUserErrorMessage(err: unknown, fallback?: string): string {
  const friendly = friendlyErrorMessage(err)
  if (friendly) return friendly
  if (fallback) return fallback
  return sanitizeUserFacingMessage(
    err,
    '일시적인 오류가 발생했습니다. 다시 시도해 주세요.',
  )
}
