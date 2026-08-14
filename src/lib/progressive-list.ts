export type ProgressiveWindow<T> = {
  items: T[]
  visibleCount: number
  remainingCount: number
}

/**
 * 큰 목록을 한 번에 렌더링하지 않고 사용자가 필요할 때만 확장한다.
 * 검색과 정렬은 전체 데이터에 적용하고, 화면 출력만 제한한다.
 */
export function progressiveWindow<T>(items: T[], limit: number): ProgressiveWindow<T> {
  const safeLimit = Math.max(0, Math.floor(limit))
  const visibleCount = Math.min(items.length, safeLimit)
  return {
    items: items.slice(0, visibleCount),
    visibleCount,
    remainingCount: Math.max(0, items.length - visibleCount),
  }
}
