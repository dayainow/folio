/**
 * P16/P55 — 접근성 훅 · 라이브 리전 · 키보드 헬퍼
 */
'use client'

import { useEffect, useRef, type RefObject } from 'react'

/** Escape로 닫기 — 드롭다운·모달용 */
export function useEscapeToClose(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
}

/** 열린 컨테이너 안에서 Tab 포커스 트랩 + 최초 포커스 */
export function useFocusTrap(open: boolean, containerRef: RefObject<HTMLElement | null>) {
  const previousFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    previousFocus.current = document.activeElement as HTMLElement | null
    const root = containerRef.current
    if (!root) return

    const focusables = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null)

    const first = focusables()[0]
    first?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) return
      const firstEl = items[0]!
      const lastEl = items[items.length - 1]!
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }

    root.addEventListener('keydown', onKey)
    return () => {
      root.removeEventListener('keydown', onKey)
      previousFocus.current?.focus?.()
    }
  }, [open, containerRef])
}

/** P55 — 스크린 리더용 polite 안내 */
export function announceToScreenReader(message: string, politeness: 'polite' | 'assertive' = 'polite') {
  if (typeof document === 'undefined' || !message.trim()) return
  let region = document.getElementById('folio-a11y-live')
  if (!region) {
    region = document.createElement('div')
    region.id = 'folio-a11y-live'
    region.setAttribute('aria-live', politeness)
    region.setAttribute('aria-atomic', 'true')
    region.className = 'sr-only'
    document.body.appendChild(region)
  } else {
    region.setAttribute('aria-live', politeness)
  }
  region.textContent = ''
  window.setTimeout(() => {
    if (region) region.textContent = message
  }, 30)
}

/** 포커스 가능 요소로 이동 (탭 전환 후) */
export function focusFirstIn(container: HTMLElement | null) {
  if (!container) return
  const el = container.querySelector<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )
  el?.focus()
}
