/**
 * v2.0 — 일관된 에러 로깅 + 사용자 메시지
 */
import { sanitizeUserFacingMessage } from '@/lib/sanitize'

export function logError(scope: string, err: unknown, extra?: Record<string, unknown>): void {
  const message = err instanceof Error ? err.message : String(err)
  const payload = {
    scope,
    message,
    ...(err instanceof Error && err.stack ? { stack: err.stack.split('\n').slice(0, 6) } : {}),
    ...extra,
  }
  // 개발/서버 콘솔 — 프로덕션에서도 구조화 로그로 남김
  console.error(`[Folio:${scope}]`, payload)
}

export function toUserErrorMessage(err: unknown, fallback?: string): string {
  return sanitizeUserFacingMessage(err, fallback ?? '일시적인 오류가 발생했습니다. 다시 시도해 주세요.')
}
