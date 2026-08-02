/**
 * v2.0 — XSS 완화용 문자열 sanitization (표시/파일명/속성)
 */

/** HTML 특수문자 이스케이프 (텍스트 노드용) */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** 속성값에 넣을 문자열 — 제어문자·따옴표 제거 */
export function sanitizeAttr(input: string, max = 200): string {
  return input
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[<>"'`]/g, '')
    .trim()
    .slice(0, max)
}

/** javascript: / data: 등 위험 스킴 차단 */
export function sanitizeUrl(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null
  try {
    const u = new URL(raw, 'https://folio.local')
    const protocol = u.protocol.toLowerCase()
    if (protocol === 'http:' || protocol === 'https:' || protocol === 'mailto:') {
      return raw.startsWith('/') ? raw : u.href
    }
    if (raw.startsWith('/') && !raw.startsWith('//')) return raw
    return null
  } catch {
    return null
  }
}

/** 사용자 입력 한 줄 요약 (알림/토스트) */
export function sanitizeUserFacingMessage(input: unknown, fallback = '요청을 처리하지 못했습니다.'): string {
  if (input instanceof Error && input.message.trim()) {
    return input.message.replace(/[\u0000-\u001F]/g, '').trim().slice(0, 200)
  }
  if (typeof input === 'string' && input.trim()) {
    return input.replace(/[\u0000-\u001F]/g, '').trim().slice(0, 200)
  }
  return fallback
}
