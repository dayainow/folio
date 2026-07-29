/** 디바운스 헬퍼 (localStorage 등) */
export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  waitMs: number,
): T & { flush: () => void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastArgs: Parameters<T> | null = null

  const wrapped = ((...args: Parameters<T>) => {
    lastArgs = args
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      if (lastArgs) fn(...lastArgs)
      lastArgs = null
    }, waitMs)
  }) as T & { flush: () => void; cancel: () => void }

  wrapped.flush = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (lastArgs) {
      fn(...lastArgs)
      lastArgs = null
    }
  }

  wrapped.cancel = () => {
    if (timer) clearTimeout(timer)
    timer = null
    lastArgs = null
  }

  return wrapped
}
