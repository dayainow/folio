import { describe, expect, it, vi } from 'vitest'
import { announceToScreenReader, focusFirstIn } from '@/lib/a11y'

describe('a11y helpers (P55)', () => {
  it('announceToScreenReader creates live region', () => {
    vi.useFakeTimers()
    announceToScreenReader('저장됨')
    const region = document.getElementById('folio-a11y-live')
    expect(region).toBeTruthy()
    expect(region?.getAttribute('aria-live')).toBe('polite')
    vi.advanceTimersByTime(50)
    expect(region?.textContent).toBe('저장됨')
    vi.useRealTimers()
  })

  it('announceToScreenReader ignores empty', () => {
    document.getElementById('folio-a11y-live')?.remove()
    announceToScreenReader('   ')
    expect(document.getElementById('folio-a11y-live')).toBeNull()
  })

  it('focusFirstIn focuses first button', () => {
    const root = document.createElement('div')
    const btn = document.createElement('button')
    btn.textContent = 'go'
    root.appendChild(btn)
    document.body.appendChild(root)
    focusFirstIn(root)
    expect(document.activeElement).toBe(btn)
    root.remove()
  })

  it('focusFirstIn no-ops on null', () => {
    expect(() => focusFirstIn(null)).not.toThrow()
  })
})
